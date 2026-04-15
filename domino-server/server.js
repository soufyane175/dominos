const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Alle 28 domino stenen
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
  for (let i = 0; i < 5; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
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

// Rooms opslag
const rooms = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // Kamer maken
  socket.on("createRoom", ({ playerName }) => {
    const code = genCode();
    const all = shuffle(allTiles());

    rooms[code] = {
      code,
      players: [
        {
          id: socket.id,
          name: playerName || "Speler 1",
          hand: all.slice(0, 7),
        },
      ],
      pile: all.slice(14),
      board: [],
      turn: 0, // index van speler die aan beurt is
      started: false,
      tilesForP2: all.slice(7, 14), // bewaar voor speler 2
    };

    socket.join(code);
    socket.roomCode = code;
    socket.playerIndex = 0;

    socket.emit("roomCreated", {
      code,
      hand: all.slice(0, 7),
      playerIndex: 0,
    });

    console.log(`Room ${code} created by ${playerName}`);
  });

  // Kamer joinen
  socket.on("joinRoom", ({ code, playerName }) => {
    const room = rooms[code];

    if (!room) {
      socket.emit("joinError", "Kamer bestaat niet!");
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("joinError", "Kamer is vol!");
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

    // Stuur naar de joiner
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

    // Stuur naar de maker dat iemand gejoined is
    const maker = room.players[0];
    io.to(maker.id).emit("opponentJoined", {
      opponentName: playerName || "Speler 2",
      turn: room.turn,
    });

    console.log(`${playerName} joined room ${code}`);
  });

  // Tegel spelen
  socket.on("playTile", ({ tileIndex }) => {
    const code = socket.roomCode;
    const pIdx = socket.playerIndex;
    const room = rooms[code];

    if (!room || !room.started) return;
    if (room.turn !== pIdx) return;

    const player = room.players[pIdx];
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

    // Verwijder tegel uit hand
    player.hand.splice(tileIndex, 1);

    // Check win
    let winner = null;
    if (player.hand.length === 0) {
      winner = pIdx;
    }

    // Wissel beurt
    room.turn = room.turn === 0 ? 1 : 0;

    // Stuur update naar BEIDE spelers
    room.players.forEach((p, idx) => {
      io.to(p.id).emit("gameUpdate", {
        board: room.board,
        hand: p.hand,
        turn: room.turn,
        pileCount: room.pile.length,
        opponentHandCount: room.players[idx === 0 ? 1 : 0].hand.length,
        lastPlay: {
          playerIndex: pIdx,
          playerName: player.name,
          tile,
        },
        winner:
          winner !== null
            ? { index: winner, name: room.players[winner].name }
            : null,
      });
    });
  });

  // Pak uit pot
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

    // Stuur update
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

  // Pass beurt
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

  // Chat
  socket.on("sendMessage", ({ text }) => {
    const code = socket.roomCode;
    if (!code) return;

    const room = rooms[code];
    if (!room) return;

    const player = room.players[socket.playerIndex];
    const msg = {
      sender: player ? player.name : "???",
      text,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    // Stuur naar IEDEREEN in de room (inclusief sender)
    io.to(code).emit("chatMessage", msg);
  });

  // Disconnect
  socket.on("disconnect", () => {
    const code = socket.roomCode;
    if (code && rooms[code]) {
      const room = rooms[code];
      // Vertel andere speler
      room.players.forEach((p) => {
        if (p.id !== socket.id) {
          io.to(p.id).emit("opponentLeft");
        }
      });
      // Verwijder room na 60 sec
      setTimeout(() => {
        if (rooms[code]) delete rooms[code];
      }, 60000);
    }
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});