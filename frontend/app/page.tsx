"use client";
import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

// Gebruik hier de link van je Render server
const SOCKET_URL = "https://dominos-jkbr.onrender.com"; 
const socket = io(SOCKET_URL);

export default function Home() {
  const [playerName, setPlayerName] = useState("jongsilent");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState("");
  const [gameState, setGameState] = useState<any>(null);

  useEffect(() => {
    socket.on("roomCreated", ({ code }) => {
      setRoomCode(code);
      setError("");
    });

    socket.on("gameState", (state) => {
      setGameState(state);
    });

    socket.on("joinError", (msg) => {
      setError(msg);
    });

    return () => {
      socket.off("roomCreated");
      socket.off("gameState");
      socket.off("joinError");
    };
  }, []);

  const handleCreateRoom = () => {
    if (!playerName) return setError("Naam invullen!");
    socket.emit("createRoom", { playerName });
  };

  const handleJoinRoom = () => {
    if (!inputCode) return setError("Vul een code in!");
    socket.emit("joinRoom", { code: inputCode.toUpperCase(), playerName });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#E31E24] via-white to-[#009E49] flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Jouw originele Kurdistan Logo/Vlag styling */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 opacity-20 pointer-events-none">
        <div className="w-full h-full bg-[#FEB100] rounded-full blur-2xl animate-pulse"></div>
      </div>

      <div className="z-10 flex flex-col items-center gap-6 w-full max-w-md">
        <h1 className="text-7xl font-black italic text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)] tracking-tighter animate-bounce">
          DOMINO
        </h1>

        <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-xl">
          <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest px-4">
            ☀️ 28 stenen • 7 per speler
          </p>
        </div>

        {/* INPUT NAAM */}
        <input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-full bg-white text-[#1a1a1a] p-4 rounded-2xl font-bold text-center border-4 border-[#FEB100] shadow-2xl focus:outline-none transition-all"
        />

        {/* KNOPPEN */}
        <button className="w-full bg-[#2563EB] text-white p-5 rounded-2xl font-black text-xl shadow-[0_8px_0_rgb(29,78,216)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3">
          🤖 Tegen Bot
        </button>

        <button 
          onClick={handleCreateRoom}
          className="w-full bg-[#009E49] text-white p-5 rounded-2xl font-black text-xl shadow-[0_8px_0_rgb(0,120,50)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
        >
          🏠 Kamer Maken
        </button>

        {/* JOIN SECTIE */}
        <div className="w-full bg-white/20 backdrop-blur-xl p-6 rounded-[2.5rem] border-4 border-white/40 shadow-2xl flex flex-col gap-4">
          <input
            placeholder="C O D E . . ."
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            className="w-full bg-white/90 p-5 rounded-2xl text-center font-black text-3xl text-[#5B21B6] placeholder:text-gray-300 focus:outline-none"
          />
          
          {error && <p className="text-red-500 font-bold text-center bg-white/80 p-2 rounded-lg text-xs">{error}</p>}
          {roomCode && <p className="text-white font-bold text-center animate-pulse">Code: {roomCode}</p>}

          <button 
            onClick={handleJoinRoom}
            className="w-full bg-[#7C3AED] text-white p-5 rounded-2xl font-black text-xl shadow-[0_8px_0_rgb(91,33,182)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
          >
            📙 Joinen
          </button>
        </div>

        <p className="text-white/40 text-[10px] font-bold mt-4">☀️ Biji Kurdistan</p>
      </div>
    </main>
  );
}