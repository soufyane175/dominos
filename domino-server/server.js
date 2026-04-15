const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ======= HELPER FUNCTIES =======

function allTiles() {
  const tiles = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push([i, j]);
    }
  }
  return tiles;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getEnds(board) {
  if (board.length === 0) return [-1, -1];
  const first = board[0];
  const last = board[board.length - 1];
  const leftEnd = first.flipped ? first.tile[1] : first.tile[0];
  const rightEnd = last.flipped ? last.tile[0] : last.tile[1];
  return [leftEnd, rightEnd];
}

function canPlay(tile, board, ends) {
  if (board.length === 0) return "right";
  const [leftEnd, rightEnd] = ends;
  if (tile[0] === leftEnd || tile[1] === leftEnd) return "left";
  if (tile[0] === rightEnd || tile[1] === rightEnd) return "right";
  return null;
}

// ======= ROOMS =======

const rooms = {};

// Health check
app.get("/", (req, res) => {
  const roomList = Object.keys(rooms).map((code) => ({
    code,
    players: rooms[code].players.length,
    started: rooms[code].started,
  }));
  res.json({
    status: "✅ Domino server online!",
    roomCount: Object.keys(rooms).length,
    rooms: roomList,
  });
});

// Debug endpoint
app.get("/room/:code", (req, res) => {
  const room = rooms[req.params.code.toUpperCase()];
  if (!room) return res.json({ error: "Room not found" });
  res.json({
    code: room.code,
    players: room.players.map((p) => ({
      name: p.name,
      handCount: p.hand.length,
      connected: !!io.sockets.sockets.get(p.id),
    })),
    started: room.started,
    turn: room.turn,
    boardCount: room.board.length,
    pileCount: room.pile.length,
  });
});

// ======= GAME STATE SENDER =======

function sendGameState(room) {
  console.log(`📤 Sending game state for room ${room.code}`);
  console.log(`   Players: ${room.players.map((p) => p.name + "(" + p.hand.length + " tiles)").join(", ")}`);
  console.log(`   Turn: ${room.turn}, Board: ${room.board.length}, Pile: ${room.pile.length}`);

  room.players.forEach((player, idx) => {
    const otherIdx = idx === 0 ? 1 : 0;
    const other = room.players[otherIdx];

    const state = {
      board: room.board,
      hand: player.hand,
      turn: room.turn,
      pileCount: room.pile.length,
      opponentHandCount: other ? other.hand.length : 0,
      opponentName: other ? other.name : "Wacht...",
      playerIndex: idx,
      started: room.started,
      winner: room.winner || null,
    };

    console.log(`   → Sending to ${player.name} (idx ${idx}): hand=${player.hand.length}, turn=${room.turn}, myIdx=${idx}, isMyTurn=${room.turn === idx}`);

    io.to(player.id).emit("gameState", state);
  });
}

// ======= SOCKET EVENTS =======

io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  // ---- KAMER MAKEN ----
  socket.on("createRoom", ({ playerName }) => {
    // Genereer unieke code
    let code = genCode();
    while (rooms[code]) code = genCode();

    // Schud alle tegels
    const all = shuffle(allTiles());
    const hand1 = all.slice(0, 7);
    const hand2 = all.slice(7, 14);
    const pile = all.slice(14);

    console.log(`🏠 Creating room ${code} for ${playerName}`);
    console.log(`   Hand1 (${playerName}): ${JSON.stringify(hand1)}`);
    console.log(`   Hand2 (waiting): ${JSON.stringify(hand2)}`);
    console.log(`   Pile: ${pile.length} tiles`);

    rooms[code] = {
      code: code,
      players: [
        {
          id: socket.id,
          name: playerName || "Speler 1",
          hand: hand1,
        },
      ],
      hand2: hand2, // Bewaard voor speler 2
      pile: pile,
      board: [],
      turn: 0,
      started: false,
      winner: null,
      createdAt: Date.now(),
    };

    // Socket join room
    socket.join(code);
    socket.roomCode = code;
    socket.playerIndex = 0;

    // Stuur room created event
    socket.emit("roomCreated", { code: code });

    // Stuur game state (alleen speler 1 is er nu)
    sendGameState(rooms[code]);

    console.log(`✅ Room ${code} created successfully`);
  });

  // ---- KAMER JOINEN ----
  socket.on("joinRoom", ({ code, playerName }) => {
    const cleanCode = (code || "").trim().toUpperCase();
    console.log(`🚪 ${playerName} trying to join room: "${cleanCode}"`);
    console.log(`   Available rooms: ${Object.keys(rooms).join(", ") || "none"}`);

    const room = rooms[cleanCode];

    if (!room) {
      console.log(`   ❌ Room "${cleanCode}" not found!`);
      socket.emit("joinError", `Kamer "${cleanCode}" bestaat niet!`);
      return;
    }

    if (room.players.length >= 2) {
      console.log(`   ❌ Room "${cleanCode}" is full!`);
      socket.emit("joinError", "Kamer is vol! (max 2 spelers)");
      return;
    }

    // Check of dezelfde speler niet dubbel joint
    if (room.players[0].id === socket.id) {
      console.log(`   ❌ Same player trying to join twice!`);
      socket.emit("joinError", "Je zit al in deze kamer!");
      return;
    }

    console.log(`   ✅ Joining room ${cleanCode} as player 2`);

    // Voeg speler 2 toe met de bewaarde hand
    room.players.push({
      id: socket.id,
      name: playerName || "Speler 2",
      hand: room.hand2,
    });

    // Socket join room
    socket.join(cleanCode);
    socket.roomCode = cleanCode;
    socket.playerIndex = 1;

    // Start het spel
    room.started = true;

    console.log(`   Player 1: ${room.players[0].name} (${room.players[0].hand.length} tiles)`);
    console.log(`   Player 2: ${room.players[1].name} (${room.players[1].hand.length} tiles)`);

    // Stuur game started event naar beide spelers
    io.to(cleanCode).emit("gameStarted", {
      p1: room.players[0].name,
      p2: room.players[1].name,
    });

    // Stuur game state naar beide spelers
    sendGameState(room);

    console.log(`✅ Game started in room ${cleanCode}!`);
  });

  // ---- TEGEL SPELEN ----
  socket.on("playTile", ({ tileIndex }) => {
    const code = socket.roomCode;
    const pIdx = socket.playerIndex;
    const room = rooms[code];

    if (!room) return console.log("❌ playTile: room not found");
    if (!room.started) return console.log("❌ playTile: game not started");
    if (room.winner) return console.log("❌ playTile: game already over");
    if (room.turn !== pIdx) {
      socket.emit("playError", "Het is niet jouw beurt!");
      return;
    }

    const player = room.players[pIdx];
    if (!player) return;

    const tile = player.hand[tileIndex];
    if (!tile) {
      socket.emit("playError", "Ongeldige tegel!");
      return;
    }

    const ends = getEnds(room.board);
    const side = canPlay(tile, room.board, ends);

    if (!side && room.board.length > 0) {
      socket.emit("playError", "Deze tegel past niet!");
      return;
    }

    // Bepaal of de tegel omgedraaid moet worden
    let flipped = false;
    if (room.board.length === 0) {
      flipped = false;
    } else if (side === "left") {
      flipped = tile[1] !== ends[0];
    } else {
      flipped = tile[0] !== ends[1];
    }

    // Voeg toe aan bord
    const entry = { tile: tile, flipped: flipped };
    if (side === "left") {
      room.board.unshift(entry);
    } else {
      room.board.push(entry);
    }

    // Verwijder uit hand
    player.hand.splice(tileIndex, 1);

    console.log(`🎯 ${player.name} played [${tile[0]}|${tile[1]}] on ${side}. Hand left: ${player.hand.length}`);

    // Check win
    if (player.hand.length === 0) {
      room.winner = { index: pIdx, name: player.name };
      console.log(`🏆 ${player.name} WINS!`);
    }

    // Wissel beurt
    room.turn = room.turn === 0 ? 1 : 0;

    // Broadcast
    io.to(code).emit("tilePlayed", {
      playerName: player.name,
      tile: tile,
      side: side,
    });

    sendGameState(room);
  });

  // ---- PAK UIT POT ----
  socket.on("drawTile", () => {
    const code = socket.roomCode;
    const pIdx = socket.playerIndex;
    const room = rooms[code];

    if (!room || !room.started || room.winner) return;
    if (room.turn !== pIdx) {
      socket.emit("playError", "Het is niet jouw beurt!");
      return;
    }

    if (room.pile.length === 0) {
      socket.emit("drawError", "Pot is leeg!");
      return;
    }

    const drawn = room.pile.pop();
    room.players[pIdx].hand.push(drawn);

    console.log(`📦 ${room.players[pIdx].name} drew [${drawn[0]}|${drawn[1]}]. Hand: ${room.players[pIdx].hand.length}`);

    sendGameState(room);
  });

  // ---- PAS BEURT ----
  socket.on("passTurn", () => {
    const code = socket.roomCode;
    const pIdx = socket.playerIndex;
    const room = rooms[code];

    if (!room || !room.started || room.winner) return;
    if (room.turn !== pIdx) return;

    console.log(`⏭️ ${room.players[pIdx].name} passed`);

    room.turn = room.turn === 0 ? 1 : 0;

    io.to(code).emit("playerPassed", {
      name: room.players[pIdx].name,
    });

    sendGameState(room);
  });

  // ---- CHAT ----
  socket.on("sendChat", ({ text }) => {
    const code = socket.roomCode;
    if (!code || !rooms[code]) return;

    const room = rooms[code];
    const player = room.players.find((p) => p.id === socket.id);

    const msg = {
      sender: player ? player.name : "???",
      text: text,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    console.log(`💬 [${code}] ${msg.sender}: ${msg.text}`);

    // Stuur naar IEDEREEN in de room
    io.to(code).emit("chatMsg", msg);
  });

  // ---- RESTART ----
  socket.on("restartGame", () => {
    const code = socket.roomCode;
    const room = rooms[code];
    if (!room) return;

    console.log(`🔄 Restarting game in room ${code}`);

    const all = shuffle(allTiles());

    room.board = [];
    room.pile = all.slice(14);
    room.turn = 0;
    room.winner = null;

    room.players[0].hand = all.slice(0, 7);
    if (room.players[1]) {
      room.players[1].hand = all.slice(7, 14);
    }

    io.to(code).emit("gameRestarted");
    sendGameState(room);
  });

  // ---- DISCONNECT ----
  socket.on("disconnect", () => {
    const code = socket.roomCode;
    console.log(`🔌 Disconnected: ${socket.id} from room ${code || "none"}`);

    if (code && rooms[code]) {
      const room = rooms[code];

      // Vertel andere speler
      room.players.forEach((p) => {
        if (p.id !== socket.id) {
          io.to(p.id).emit("opponentLeft");
        }
      });

      // Cleanup na 2 minuten
      setTimeout(() => {
        if (rooms[code]) {
          const allGone = room.players.every(
            (p) => !io.sockets.sockets.get(p.id)
          );
          if (allGone) {
            delete rooms[code];
            console.log(`🗑️ Room ${code} deleted (all disconnected)`);
          }
        }
      }, 120000);
    }
  });
});

// ======= CLEANUP =======

// Verwijder oude kamers elke 5 minuten
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  Object.keys(rooms).forEach((code) => {
    // Verwijder kamers ouder dan 2 uur
    if (now - rooms[code].createdAt > 7200000) {
      delete rooms[code];
      cleaned++;
    }
  });
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} old rooms. Active: ${Object.keys(rooms).length}`);
  }
}, 300000);

// ======= START =======

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🎲 Domino server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/`);
});