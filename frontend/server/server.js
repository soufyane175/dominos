const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { 
    origin: "*", // Staat verbindingen van Vercel toe
    methods: ["GET", "POST"]
  }
});

let rooms = {};

// Functie om stenen te maken en te schudden
const genDeck = () => {
  let deck = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) deck.push([i, j]);
  }
  return deck.sort(() => Math.random() - 0.5);
};

io.on("connection", (socket) => {
  console.log("Speler verbonden:", socket.id);

  // KAMER MAKEN
  socket.on("createRoom", ({ playerName }) => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    const deck = genDeck();
    
    rooms[code] = {
      players: [{ id: socket.id, name: playerName, hand: deck.splice(0, 7) }],
      board: [],
      pile: deck,
      turn: 0,
      started: false
    };
    
    socket.join(code);
    socket.emit("roomCreated", { code });
    sendState(code);
  });

  // JOINEN
  socket.on("joinRoom", ({ code, playerName }) => {
    const room = rooms[code];
    if (room && room.players.length < 2) {
      room.players.push({ id: socket.id, name: playerName, hand: room.pile.splice(0, 7) });
      socket.join(code);
      room.started = true;
      io.to(code).emit("gameStarted", { p1: room.players[0].name, p2: playerName });
      sendState(code);
    } else {
      socket.emit("joinError", "Kamer is vol of bestaat niet!");
    }
  });

  // CHAT SYSTEEM
  socket.on("sendChat", ({ text }) => {
    const roomCode = Array.from(socket.rooms).find(r => r.length === 5);
    if (roomCode && rooms[roomCode]) {
      const player = rooms[roomCode].players.find(p => p.id === socket.id);
      io.to(roomCode).emit("chatMsg", {
        sender: player ? player.name : "Gast",
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  });

  function sendState(code) {
    const room = rooms[code];
    room.players.forEach((p, idx) => {
      const oppIdx = idx === 0 ? 1 : 0;
      io.to(p.id).emit("gameState", {
        hand: p.hand,
        board: room.board,
        turn: room.turn,
        pileCount: room.pile.length,
        opponentHandCount: room.players[oppIdx] ? room.players[oppIdx].hand.length : 0,
        opponentName: room.players[oppIdx] ? room.players[oppIdx].name : "Wachten...",
        playerIndex: idx,
        started: room.started
      });
    });
  }

  socket.on("disconnect", () => {
    console.log("Speler weg:", socket.id);
  });
});

// Gebruik de poort van Render of 3001
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server draait op poort ${PORT}`);
});