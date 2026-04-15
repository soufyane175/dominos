const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" } // Laat iedereen verbinding maken
});

let rooms = {};

io.on("connection", (socket) => {
  socket.on("createRoom", ({ playerName }) => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[code] = {
      players: [{ id: socket.id, name: playerName, hand: [] }],
      board: [],
      pile: [],
      turn: 0,
      started: false
    };
    socket.join(code);
    socket.emit("roomCreated", { code });
  });

  socket.on("joinRoom", ({ code, playerName }) => {
    const room = rooms[code];
    if (room && room.players.length < 2) {
      room.players.push({ id: socket.id, name: playerName, hand: [] });
      socket.join(code);
      // Hier start je de game logica (shuffelen, uitdelen etc.)
      io.to(code).emit("gameStarted", { p1: room.players[0].name, p2: playerName });
    } else {
      socket.emit("joinError", "Kamer vol of bestaat niet.");
    }
  });

  socket.on("sendChat", ({ text }) => {
    const roomsArray = Array.from(socket.rooms);
    const roomCode = roomsArray.find(c => c !== socket.id);
    if (roomCode) {
      io.to(roomCode).emit("chatMsg", {
        sender: socket.id, // Je kunt hier de naam van de speler meesturen
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  });

  socket.on("disconnect", () => {
    // Ruim kamers op als iemand weggaat
  });
});

httpServer.listen(3001);