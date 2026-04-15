const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// Health check voor Render
app.get("/", (req, res) => {
  res.json({ status: "Domino server draait!", rooms: Object.keys(rooms).length });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

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
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
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

const rooms = {};

io.on("connection", (socket) => {
  console.log("Verbonden:", socket.id);

  socket.on("createRoom", ({ playerName }) => {
    let code = genCode();
    while (rooms[code]) code = genCode();

    const all = shuffle(allTiles());

    rooms[code] = {
      code,
      players: [
        { id: socket.id, name: playerName || "Speler 1", hand: all.slice(0, 7) },
      ],
      pile: all.slice(14),
      board: [],
      turn: 0,
      started: false,
      tilesForP2: all.slice(7, 14),
      createdAt: Date.now(),
    };

    socket.join(code);
    socket.roomCode = code;
    socket.playerIndex = 0;

    socket.emit("roomCreated", {
      code,
      hand: all.slice(0, 7),
      playerIndex: 0,
    });

    console.log(`Kamer ${code} gemaakt door ${playerName}`);
  });

  socket.on("joinRoom", ({ code, playerName }) => {
    const room = rooms[code];

    if (!room) {
      socket.emit("joinError", "Kamer bestaat niet! Check de code.");
      return;
    }
    if (room.players.length >= 2) {
      socket.emit("joinError", "Kamer is vol! (max 2 spelers)");
      return;
    }

    room.players.push({
      id: socket.id,
      name: playerName || "Speler 2",
      hand: room.tilesForP2,
    });

    socket.join(code);
    socket.roomCode = code;
    socket.playerIndex = 1;
    room.started = true;

    socket.emit("roomJoined", {
      code,
      hand: room.tilesForP2,
      playerIndex: 1,
      board: room.board,
      turn: room.turn,
      opponentName: room.players[0].name,
      opponentHandCount: room.players[0].hand.length,
      pileCount: room.pile.length,
    });

    io.to(room.players[0].id).emit("opponentJoined", {
      opponentName: playerName || "Speler 2",
      turn: room.turn,
    });

    console.log(`${playerName} joined kamer ${code}`);
  });

  socket.on("playTile", ({ tileIndex }) => {
    const code = socket.roomCode;
    const pIdx = socket.playerIndex;
    const room = rooms[code];

    if (!room || !room.started) return;
    if (room.turn !== pIdx) return;

    const player = room.players[pIdx];
    if (!player) return;
    const tile = player.hand[tileIndex];
    if (!tile) return;

    const ends = getEnds(room.board);
    const side = canPlay(tile, room.board, ends);

    if (!side && room.board.length > 0) {
      socket.emit("playError", "Deze tegel past niet!");
      return;
    }

    let flipped = false;
    if (room.board.length === 0) {
      flipped = false;
    } else if (side === "left") {
      flipped = tile[1] !== ends[0];
    } else {
      flipped = tile[0] !== ends[1];
    }

    const boardEntry = { tile, flipped };
    if (side === "left") {
      room.board.unshift(boardEntry);
    } else {
      room.board.push(boardEntry);
    }

    player.hand.splice(tileIndex, 1);

    let winner = null;
    if (player.hand.length === 0) {
      winner = pIdx;
    }

    room.turn = room.turn === 0 ? 1 : 0;

    room.players.forEach((p, idx) => {
      io.to(p.id).emit("gameUpdate", {
        board: room.board,
        hand: p.hand,
        turn: room.turn,
        pileCount: room.pile.length,
        opponentHandCount: room.players[idx === 0 ? 1 : 0].hand.length,
        lastPlay: { playerIndex: pIdx, playerName: player.name, tile },
        winner: winner !== null ? { index: winner, name: room.players[winner].name } : null,
      });
    });
  });

  socket.on("drawTile", () => {
    const code = socket.roomCode;
    const pIdx = socket.playerIndex;
    const room = rooms[code];

    if (!room || !room.started) return;
    if (room.turn !== pIdx) return;
    if (room.pile.length === 0) {
      socket.emit("drawError", "Pot is leeg!");
      return;
    }

    const drawn = room.pile.pop();
    room.players[pIdx].hand.push(drawn);

    room.players.forEach((p, idx) => {
      io.to(p.id).emit("gameUpdate", {
        board: room.board,
        hand: p.hand,
        turn: room.turn,
        pileCount: room.pile.length,
        opponentHandCount: room.players[idx === 0 ? 1 : 0].hand.length,
        lastPlay: null,
        winner: null,
        drewTile: pIdx === idx ? drawn : null,
        opponentDrew: pIdx !== idx,
      });
    });
  });

  socket.on("passTurn", () => {
    const code = socket.roomCode;
    const pIdx = socket.playerIndex;
    const room = rooms[code];

    if (!room || !room.started) return;
    if (room.turn !== pIdx) return;

    room.turn = room.turn === 0 ? 1 : 0;

    room.players.forEach((p, idx) => {
      io.to(p.id).emit("gameUpdate", {
        board: room.board,
        hand: p.hand,
        turn: room.turn,
        pileCount: room.pile.length,
        opponentHandCount: room.players[idx === 0 ? 1 : 0].hand.length,
        lastPlay: null,
        winner: null,
        passed: { index: pIdx, name: room.players[pIdx].name },
      });
    });
  });

  socket.on("sendMessage", ({ text }) => {
    const code = socket.roomCode;
    if (!code || !rooms[code]) return;

    const room = rooms[code];
    const player = room.players.find((p) => p.id === socket.id);

    const msg = {
      sender: player ? player.name : "???",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    io.to(code).emit("chatMessage", msg);
  });

  socket.on("requestRestart", () => {
    const code = socket.roomCode;
    if (!code || !rooms[code]) return;
    const room = rooms[code];

    const all = shuffle(allTiles());
    room.board = [];
    room.pile = all.slice(14);
    room.turn = 0;
    room.players[0].hand = all.slice(0, 7);
    if (room.players[1]) {
      room.players[1].hand = all.slice(7, 14);
    }

    room.players.forEach((p, idx) => {
      io.to(p.id).emit("gameRestarted", {
        hand: p.hand,
        board: [],
        turn: 0,
        pileCount: room.pile.length,
        opponentHandCount: 7,
      });
    });
  });

  socket.on("disconnect", () => {
    const code = socket.roomCode;
    if (code && rooms[code]) {
      const room = rooms[code];
      room.players.forEach((p) => {
        if (p.id !== socket.id) {
          io.to(p.id).emit("opponentLeft");
        }
      });
      setTimeout(() => {
        if (rooms[code]) {
          const allDisconnected = room.players.every(
            (p) => !io.sockets.sockets.get(p.id)
          );
          if (allDisconnected) {
            delete rooms[code];
            console.log(`Kamer ${code} verwijderd`);
          }
        }
      }, 120000);
    }
    console.log("Disconnected:", socket.id);
  });
});

// Cleanup oude kamers elke 10 min
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach((code) => {
    if (now - rooms[code].createdAt > 3600000) {
      delete rooms[code];
      console.log(`Oude kamer ${code} verwijderd`);
    }
  });
}, 600000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Domino server draait op poort ${PORT}`);
});