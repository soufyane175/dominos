"use client";
import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

// VERVANG DEZE LINK DOOR JOUW BLAUWE LINK VAN RENDER!
const SOCKET_URL = "https://dominos-jkbr.onrender.com"; 
const socket = io(SOCKET_URL);

export default function DominoGame() {
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [gameState, setGameState] = useState<any>(null);
  const [error, setError] = useState("");
  const [chat, setChat] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    socket.on("roomCreated", ({ code }) => setRoomCode(code));
    socket.on("gameState", (state) => setGameState(state));
    socket.on("joinError", (msg) => setError(msg));
    socket.on("chatMsg", (msg) => setChat((prev) => [...prev, msg]));

    return () => {
      socket.off("roomCreated");
      socket.off("gameState");
      socket.off("joinError");
      socket.off("chatMsg");
    };
  }, []);

  const createRoom = () => {
    if (!playerName) return setError("Vul je naam in!");
    socket.emit("createRoom", { playerName });
  };

  const joinRoom = () => {
    if (!playerName || !inputCode) return setError("Naam en code verplicht!");
    socket.emit("joinRoom", { code: inputCode.toUpperCase(), playerName });
  };

  const sendMsg = () => {
    if (message.trim()) {
      socket.emit("sendChat", { text: message });
      setMessage("");
    }
  };

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-red-600 via-white to-green-600 p-4">
        <h1 className="text-6xl font-black italic text-white drop-shadow-md mb-8">DOMINO</h1>
        <div className="bg-white/20 backdrop-blur-md p-6 rounded-3xl shadow-2xl w-full max-w-sm border border-white/30">
          <input 
            className="w-full p-3 mb-4 rounded-xl border-none shadow-inner text-center font-bold"
            placeholder="Je Naam..." 
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <button onClick={createRoom} className="w-full bg-green-500 text-white p-4 rounded-xl font-bold mb-4 shadow-lg active:scale-95 transition">🏠 Kamer Maken</button>
          <div className="relative mb-4">
            <input 
              className="w-full p-3 rounded-xl border-none shadow-inner text-center font-mono font-bold text-purple-700"
              placeholder="CODE..." 
              onChange={(e) => setInputCode(e.target.value)}
            />
            <button onClick={joinRoom} className="w-full mt-2 bg-purple-600 text-white p-4 rounded-xl font-bold shadow-lg active:scale-95 transition">📙 Joinen</button>
          </div>
          {roomCode && <p className="text-center font-bold text-white bg-black/30 p-2 rounded-lg">Deel deze code: {roomCode}</p>}
          {error && <p className="text-red-200 text-center mt-2 font-bold">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-emerald-900 text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-between mb-4">
        <div className="bg-black/20 p-3 rounded-xl">
          <p className="text-xs uppercase opacity-70">Tegenstander</p>
          <p className="font-bold">{gameState.opponentName} ({gameState.opponentHandCount} stenen)</p>
        </div>
        <div className="bg-black/20 p-3 rounded-xl text-right">
          <p className="text-xs uppercase opacity-70">Jij</p>
          <p className="font-bold text-yellow-400">{playerName}</p>
        </div>
      </div>

      {/* Speelbord */}
      <div className="flex-1 w-full border-4 border-dashed border-white/10 rounded-3xl mb-4 flex items-center justify-center overflow-auto p-8">
        {gameState.board.length === 0 ? "Wachten op eerste zet..." : "Stenen op het bord..."}
      </div>

      {/* Jouw Hand */}
      <div className="w-full max-w-2xl bg-black/30 p-4 rounded-t-3xl flex flex-wrap justify-center gap-2">
        {gameState.hand.map((tile: any, i: number) => (
          <div key={i} className="w-12 h-20 bg-white rounded-lg flex flex-col border-2 border-gray-300 shadow-xl cursor-pointer hover:-translate-y-2 transition">
            <div className="flex-1 flex items-center justify-center text-black font-bold text-xl border-b">{tile[0]}</div>
            <div className="flex-1 flex items-center justify-center text-black font-bold text-xl">{tile[1]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}