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

function allTiles() {
  var t = [];
  for (var i = 0; i <= 6; i++)
    for (var j = i; j <= 6; j++)
      t.push([i, j]);
  return t;
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = a[i];
    a[i] = a[j];
    a[j] = temp;
  }
  return a;
}

function genCode() {
  var c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var r = "";
  for (var i = 0; i < 5; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

function getEnds(board) {
  if (board.length === 0) return [-1, -1];
  var f = board[0];
  var l = board[board.length - 1];
  return [
    f.flipped ? f.tile[1] : f.tile[0],
    l.flipped ? l.tile[0] : l.tile[1]
  ];
}

function canPlay(tile, board, ends) {
  if (board.length === 0) return "right";
  if (tile[0] === ends[0] || tile[1] === ends[0]) return "left";
  if (tile[0] === ends[1] || tile[1] === ends[1]) return "right";
  return null;
}

var rooms = {};

function isConnected(socketId) {
  var s = io.sockets.sockets.get(socketId);
  return s && s.connected;
}

function cleanRoom(room) {
  var before = room.players.length;
  var alive = [];
  for (var i = 0; i < room.players.length; i++) {
    if (isConnected(room.players[i].id)) {
      alive.push(room.players[i]);
    }
  }
  room.players = alive;
  if (room.players.length < 2) {
    room.started = false;
  }
  for (var i = 0; i < room.players.length; i++) {
    var s = io.sockets.sockets.get(room.players[i].id);
    if (s) s.playerIndex = i;
  }
  if (before !== room.players.length) {
    console.log("Cleaned room " + room.code + ": " + before + " -> " + room.players.length);
  }
}

function sendState(room) {
  for (var i = 0; i < room.players.length; i++) {
    var player = room.players[i];
    var otherIdx = i === 0 ? 1 : 0;
    var other = room.players[otherIdx];

    var data = {
      board: room.board,
      hand: JSON.parse(JSON.stringify(player.hand)),
      turn: room.turn,
      pileCount: room.pile.length,
      opponentHandCount: other ? other.hand.length : 0,
      opponentName: other ? other.name : "Wacht...",
      playerIndex: i,
      started: room.started,
      winner: room.winner || null,
    };

    console.log("  -> " + player.name + " idx=" + i + " hand=" + data.hand.length + " turn=" + data.turn + " myTurn=" + (data.turn === i));

    if (isConnected(player.id)) {
      io.to(player.id).emit("gameState", data);
    }
  }
}

app.get("/", function(req, res) {
  Object.keys(rooms).forEach(function(code) { cleanRoom(rooms[code]); });
  var roomList = [];
  Object.keys(rooms).forEach(function(code) {
    roomList.push({
      code: code,
      players: rooms[code].players.map(function(p) {
        return { name: p.name, hand: p.hand.length, connected: isConnected(p.id) };
      }),
      started: rooms[code].started,
    });
  });
  res.json({ status: "Domino server v4 online!", rooms: roomList });
});

app.get("/room/:code", function(req, res) {
  var room = rooms[req.params.code.toUpperCase()];
  if (!room) return res.json({ error: "Not found" });
  cleanRoom(room);
  res.json({
    code: room.code,
    players: room.players.map(function(p) {
      return { name: p.name, hand: p.hand.length, connected: isConnected(p.id) };
    }),
    started: room.started,
    turn: room.turn,
    board: room.board.length,
    pile: room.pile.length,
  });
});

io.on("connection", function(socket) {
  console.log("CONNECT: " + socket.id);

  socket.on("createRoom", function(data) {
    var playerName = (data && data.playerName) ? data.playerName : "Speler";

    if (socket.roomCode && rooms[socket.roomCode]) {
      var old = rooms[socket.roomCode];
      old.players = old.players.filter(function(p) { return p.id !== socket.id; });
      socket.leave(socket.roomCode);
      if (old.players.length === 0) delete rooms[socket.roomCode];
    }

    var code = genCode();
    while (rooms[code]) code = genCode();

    var all = shuffle(allTiles());

    rooms[code] = {
      code: code,
      players: [{
        id: socket.id,
        name: playerName,
        hand: all.slice(0, 7),
      }],
      hand2: all.slice(7, 14),
      pile: all.slice(14),
      board: [],
      turn: 0,
      started: false,
      winner: null,
      createdAt: Date.now(),
    };

    socket.join(code);
    socket.roomCode = code;
    socket.playerIndex = 0;

    console.log("ROOM CREATED: " + code + " by " + playerName);
    console.log("  P1 hand: " + JSON.stringify(all.slice(0, 7)));

    socket.emit("roomCreated", { code: code });
    sendState(rooms[code]);
  });

  socket.on("joinRoom", function(data) {
    var code = ((data && data.code) || "").trim().toUpperCase();
    var playerName = (data && data.playerName) ? data.playerName : "Speler";

    console.log("JOIN REQUEST: " + playerName + " -> " + code);
    console.log("  Rooms: " + Object.keys(rooms).join(", "));

    var room = rooms[code];
    if (!room) {
      console.log("  FAIL: not found");
      socket.emit("joinError", "Kamer '" + code + "' bestaat niet!");
      return;
    }

    cleanRoom(room);

    console.log("  Room " + code + " players after cleanup: " + room.players.length);
    room.players.forEach(function(p, i) {
      console.log("    [" + i + "] " + p.name + " id=" + p.id.substring(0, 6) + " connected=" + isConnected(p.id));
    });

    if (room.players.find(function(p) { return p.id === socket.id; })) {
      console.log("  FAIL: already in room");
      socket.emit("joinError", "Je zit al in deze kamer!");
      return;
    }

    if (room.players.length >= 2) {
      console.log("  FAIL: room full");
      socket.emit("joinError", "Kamer is vol!");
      return;
    }

    if (socket.roomCode && rooms[socket.roomCode] && socket.roomCode !== code) {
      var oldRoom = rooms[socket.roomCode];
      oldRoom.players = oldRoom.players.filter(function(p) { return p.id !== socket.id; });
      socket.leave(socket.roomCode);
      if (oldRoom.players.length === 0) delete rooms[socket.roomCode];
    }

    var hand2copy = JSON.parse(JSON.stringify(room.hand2));

    room.players.push({
      id: socket.id,
      name: playerName,
      hand: hand2copy,
    });

    socket.join(code);
    socket.roomCode = code;
    socket.playerIndex = 1;
    room.started = true;

    console.log("  SUCCESS! " + room.players[0].name + " vs " + room.players[1].name);
    console.log("  P1: " + room.players[0].hand.length + " tiles, P2: " + room.players[1].hand.length + " tiles");

    io.to(code).emit("gameStarted", {
      p1: room.players[0].name,
      p2: room.players[1].name,
    });

    sendState(room);
  });

  socket.on("playTile", function(data) {
    var code = socket.roomCode;
    var pIdx = socket.playerIndex;
    var room = rooms[code];
    if (!room || !room.started || room.winner) return;
    if (room.turn !== pIdx) {
      socket.emit("playError", "Niet jouw beurt!");
      return;
    }

    var player = room.players[pIdx];
    if (!player) return;
    var tile = player.hand[data.tileIndex];
    if (!tile) return;

    var ends = getEnds(room.board);
    var side = canPlay(tile, room.board, ends);
    if (!side && room.board.length > 0) {
      socket.emit("playError", "Past niet!");
      return;
    }

    var flipped = false;
    if (room.board.length > 0) {
      if (side === "left") flipped = tile[1] !== ends[0];
      else flipped = tile[0] !== ends[1];
    }

    if (side === "left") {
      room.board.unshift({ tile: tile, flipped: flipped });
    } else {
      room.board.push({ tile: tile, flipped: flipped });
    }

    player.hand.splice(data.tileIndex, 1);
    console.log(player.name + " played [" + tile[0] + "|" + tile[1] + "] left=" + player.hand.length);

    if (player.hand.length === 0) {
      room.winner = { index: pIdx, name: player.name };
    }
    room.turn = room.turn === 0 ? 1 : 0;

    io.to(code).emit("tilePlayed", { playerName: player.name, tile: tile });
    sendState(room);
  });

  socket.on("drawTile", function() {
    var code = socket.roomCode;
    var pIdx = socket.playerIndex;
    var room = rooms[code];
    if (!room || !room.started || room.winner) return;
    if (room.turn !== pIdx) return;
    if (room.pile.length === 0) {
      socket.emit("drawError", "Pot is leeg!");
      return;
    }
    var drawn = room.pile.pop();
    room.players[pIdx].hand.push(drawn);
    sendState(room);
  });

  socket.on("passTurn", function() {
    var code = socket.roomCode;
    var pIdx = socket.playerIndex;
    var room = rooms[code];
    if (!room || !room.started || room.winner) return;
    if (room.turn !== pIdx) return;
    room.turn = room.turn === 0 ? 1 : 0;
    io.to(code).emit("playerPassed", { name: room.players[pIdx].name });
    sendState(room);
  });

  socket.on("sendChat", function(data) {
    var code = socket.roomCode;
    if (!code || !rooms[code]) return;
    var room = rooms[code];
    var player = room.players.find(function(p) { return p.id === socket.id; });
    io.to(code).emit("chatMsg", {
      sender: player ? player.name : "???",
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  socket.on("restartGame", function() {
    var code = socket.roomCode;
    var room = rooms[code];
    if (!room) return;
    var all = shuffle(allTiles());
    room.board = [];
    room.pile = all.slice(14);
    room.turn = 0;
    room.winner = null;
    room.players[0].hand = all.slice(0, 7);
    if (room.players[1]) room.players[1].hand = all.slice(7, 14);
    room.hand2 = all.slice(7, 14);
    io.to(code).emit("gameRestarted");
    sendState(room);
  });

  socket.on("disconnect", function(reason) {
    var code = socket.roomCode;
    console.log("DISCONNECT: " + socket.id + " reason=" + reason + " room=" + (code || "none"));

    if (code && rooms[code]) {
      var room = rooms[code];
      room.players = room.players.filter(function(p) { return p.id !== socket.id; });

      if (room.players.length < 2) room.started = false;

      for (var i = 0; i < room.players.length; i++) {
        var s = io.sockets.sockets.get(room.players[i].id);
        if (s) s.playerIndex = i;
        io.to(room.players[i].id).emit("opponentLeft");
      }

      if (room.players.length === 0) {
        setTimeout(function() {
          if (rooms[code] && rooms[code].players.length === 0) {
            delete rooms[code];
            console.log("Room " + code + " deleted");
          }
        }, 30000);
      }
    }
  });
});

setInterval(function() {
  var now = Date.now();
  Object.keys(rooms).forEach(function(code) {
    cleanRoom(rooms[code]);
    if (rooms[code].players.length === 0 || now - rooms[code].createdAt > 7200000) {
      delete rooms[code];
    }
  });
}, 60000);

var PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", function() {
  console.log("Domino server v4 on port " + PORT);
});