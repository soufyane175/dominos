const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.get("/", (req, res) => res.json({ status: "✅ Domino server online!", rooms: Object.keys(rooms).length }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

function allTiles() {
  const t = [];
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) t.push([i, j]);
  return t;
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function genCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 5; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

function getEnds(board) {
  if (!board.length) return [-1, -1];
  const f = board[0], l = board[board.length - 1];
  return [f.flipped ? f.tile[1] : f.tile[0], l.flipped ? l.tile[0] : l.tile[1]];
}

function canPlay(tile, board, ends) {
  if (!board.length) return "right";
  const [le, re] = ends;
  if (tile[0] === le || tile[1] === le) return "left";
  if (tile[0] === re || tile[1] === re) return "right";
  return null;
}

const rooms = {};

function sendGameState(room) {
  room.players.forEach((p, idx) => {
    const other = room.players[idx === 0 ? 1 : 0];
    io.to(p.id).emit("gameState", {
      board: room.board,
      hand: p.hand,
      turn: room.turn,
      pileCount: room.pile.length,
      opponentHandCount: other ? other.hand.length : 0,
      opponentName: other ? other.name : "Wacht...",
      playerIndex: idx,
      started: room.started,
      winner: room.winner,
    });
  });
}

io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  socket.on("createRoom", ({ playerName }) => {
    let code = genCode();
    while (rooms[code]) code = genCode();

    const all = shuffle(allTiles());
    rooms[code] = {
      code,
      players: [{ id: socket.id, name: playerName || "Speler 1", hand: all.slice(0, 7) }],
      pile: all.slice(14),
      board: [],
      turn: 0,
      started: false,
      p2Tiles: all.slice(7, 14),
      winner: null,
      createdAt: Date.now(),
    };

    socket.join(code);
    socket.roomCode = code;
    socket.playerIndex = 0;

    socket.emit("roomCreated", { code });
    sendGameState(rooms[code]);
    console.log(`🏠 Room ${code} by ${playerName}`);
  });

  socket.on("joinRoom", ({ code, playerName }) => {
    const room = rooms[code];
    if (!room) return socket.emit("joinError", "Kamer niet gevonden!");
    if (room.players.length >= 2) return socket.emit("joinError", "Kamer is vol!");

    room.players.push({ id: socket.id, name: playerName || "Speler 2", hand: room.p2Tiles });
    socket.join(code);
    socket.roomCode = code;
    socket.playerIndex = 1;
    room.started = true;

    io.to(code).emit("gameStarted", {
      p1: room.players[0].name,
      p2: room.players[1].name,
    });

    sendGameState(room);
    console.log(`🚪 ${playerName} joined ${code}`);
  });

  socket.on("playTile", ({ tileIndex, side }) => {
    const room = rooms[socket.roomCode];
    if (!room || !room.started || room.winner) return;
    if (room.turn !== socket.playerIndex) return;

    const player = room.players[socket.playerIndex];
    const tile = player.hand[tileIndex];
    if (!tile) return;

    const ends = getEnds(room.board);
    let playSide = side || canPlay(tile, room.board, ends);
    if (!playSide && room.board.length > 0) return socket.emit("playError", "Past niet!");

    let flipped = false;
    if (room.board.length > 0) {
      if (playSide === "left") flipped = tile[1] !== ends[0];
      else flipped = tile[0] !== ends[1];
    }

    const entry = { tile, flipped };
    if (playSide === "left") room.board.unshift(entry);
    else room.board.push(entry);

    player.hand.splice(tileIndex, 1);

    if (player.hand.length === 0) {
      room.winner = { index: socket.playerIndex, name: player.name };
    }

    room.turn = room.turn === 0 ? 1 : 0;

    io.to(socket.roomCode).emit("tilePlayed", {
      playerName: player.name,
      tile,
      side: playSide,
    });

    sendGameState(room);
  });

  socket.on("drawTile", () => {
    const room = rooms[socket.roomCode];
    if (!room || !room.started || room.winner) return;
    if (room.turn !== socket.playerIndex) return;
    if (!room.pile.length) return socket.emit("drawError", "Pot is leeg!");

    const drawn = room.pile.pop();
    room.players[socket.playerIndex].hand.push(drawn);

    sendGameState(room);
  });

  socket.on("passTurn", () => {
    const room = rooms[socket.roomCode];
    if (!room || !room.started || room.winner) return;
    if (room.turn !== socket.playerIndex) return;

    room.turn = room.turn === 0 ? 1 : 0;
    io.to(socket.roomCode).emit("playerPassed", {
      name: room.players[socket.playerIndex].name,
    });
    sendGameState(room);
  });

  socket.on("sendChat", ({ text }) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    io.to(socket.roomCode).emit("chatMsg", {
      sender: player ? player.name : "???",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  socket.on("restartGame", () => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const all = shuffle(allTiles());
    room.board = [];
    room.pile = all.slice(14);
    room.turn = 0;
    room.winner = null;
    room.players[0].hand = all.slice(0, 7);
    if (room.players[1]) room.players[1].hand = all.slice(7, 14);
    io.to(socket.roomCode).emit("gameRestarted");
    sendGameState(room);
  });

  socket.on("disconnect", () => {
    const code = socket.roomCode;
    if (code && rooms[code]) {
      rooms[code].players.forEach((p) => {
        if (p.id !== socket.id) io.to(p.id).emit("opponentLeft");
      });
      setTimeout(() => {
        if (rooms[code]) {
          const allGone = rooms[code].players.every((p) => !io.sockets.sockets.get(p.id));
          if (allGone) { delete rooms[code]; console.log(`🗑️ Room ${code} deleted`); }
        }
      }, 120000);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach((code) => {
    if (now - rooms[code].createdAt > 7200000) {
      delete rooms[code];
    }
  });
}, 300000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => console.log(`🎲 Domino server on port ${PORT}`));