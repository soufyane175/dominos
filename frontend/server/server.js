// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors()); 

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", 
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('✅ Een speler is verbonden ID:', socket.id);

  // 1. Kamer maken
  socket.on('create_room', (roomId) => {
    socket.join(roomId);
    console.log(`🏠 Kamer ${roomId} gemaakt door ${socket.id}`);
    socket.emit('room_created', roomId);
  });

  // 2. Kamer joinen
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`🚪 Speler ${socket.id} zit nu in kamer ${roomId}`);
    // Hier zou je normaal de game state sturen, maar dat doen we later
  });

  // 3. Steen spelen (Voorbeeld)
  socket.on('play_tile', (data) => {
    console.log(`🎲 Speler speelde steen in kamer ${data.roomId}:`, data.tile);
    // Stuur update naar iedereen in die kamer
    io.to(data.roomId).emit('update_game', {
      message: "Iemand heeft een steen gespeeld!",
      tile: data.tile
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Speler weg:', socket.id);
  });
});

server.listen(3001, () => {
  console.log('🚀 Server draait op poort 3001');
});