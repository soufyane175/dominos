"use client";

import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// --- Types & Instellingen ---
type Tile = [number, number];
type View = 'menu' | 'bot' | 'online';

// Pas deze link aan naar je Railway URL zodra je die hebt!
const SOCKET_URL = "http://localhost:3001"; 

const translations = {
  ku: { title: "DOMINO", bot: "یاری دژی بۆت 🤖", create: "دروستکردنی ژوور 🏠", join: "چوونە ناو ژوور", draw: "بەرد بێنە", pass: "تێپەڕین", win: "پیرۆزە!", loss: "دۆڕاندی!", hand: "دەستی تۆ" },
  nl: { title: "DOMINO", bot: "Tegen Bot Spelen 🤖", create: "Kamer Maken 🏠", join: "Join Kamer", draw: "Pak Steen", pass: "Pas", win: "Gewonnen!", loss: "Verloren!", hand: "Jouw stenen" }
};

export default function Home() {
  const [view, setView] = useState<View>('menu');
  const [lang, setLang] = useState<'ku' | 'nl'>('ku');
  const [roomCode, setRoomCode] = useState('');
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [botHand, setBotHand] = useState<Tile[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [boneyard, setBoneyard] = useState<Tile[]>([]);
  const [turn, setTurn] = useState<'player' | 'bot'>('player');
  const [winner, setWinner] = useState<string | null>(null);
  
  const t = translations[lang];

  // --- Muziek Logica ---
  useEffect(() => {
    const audio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'); // Vervang door jouw Koerdische MP3
    audio.loop = true;
    if (view !== 'menu') {
      audio.play().catch(() => console.log("Muziek start na interactie"));
    }
    return () => audio.pause();
  }, [view]);

  // --- Spel Initialisatie ---
  const startBotGame = () => {
    const tiles: Tile[] = [];
    for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) tiles.push([i, j]);
    const shuffled = tiles.sort(() => Math.random() - 0.5);
    setPlayerHand(shuffled.slice(0, 7));
    setBotHand(shuffled.slice(7, 14));
    setBoneyard(shuffled.slice(14));
    setBoard([]);
    setWinner(null);
    setView('bot');
  };

  const playTile = (tile: Tile) => {
    if (turn !== 'player' || winner) return;
    if (board.length === 0) {
      setBoard([tile]);
      setPlayerHand(playerHand.filter(t => t !== tile));
      setTurn('bot');
    } else {
      const first = board[0][0];
      const last = board[board.length - 1][1];
      if (tile.includes(first) || tile.includes(last)) {
        if (tile.includes(last)) {
          const newTile: Tile = tile[0] === last ? [tile[0], tile[1]] : [tile[1], tile[0]];
          setBoard([...board, newTile]);
        } else {
          const newTile: Tile = tile[1] === first ? [tile[0], tile[1]] : [tile[1], tile[0]];
          setBoard([newTile, ...board]);
        }
        setPlayerHand(playerHand.filter(t => t !== tile));
        setTurn('bot');
      }
    }
  };

  // --- MENU VIEW ---
  if (view === 'menu') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#E31E24] via-white to-[#278E43] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* De Koerdische Zon Glow */}
        <div className="absolute w-[600px] h-[600px] bg-yellow-400 rounded-full blur-[120px] opacity-40 animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center w-full max-w-md">
          <h1 className="text-8xl font-black text-white italic drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] mb-12 tracking-tighter">
            {t.title}
          </h1>

          <div className="flex flex-col gap-5 w-full">
            <button onClick={startBotGame} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-3xl border-b-[10px] border-blue-900 active:border-b-0 active:translate-y-2 transition-all text-2xl shadow-2xl">
              {t.bot}
            </button>

            <button onClick={() => setView('online')} className="bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-3xl border-b-[10px] border-green-900 active:border-b-0 active:translate-y-2 transition-all text-2xl shadow-2xl">
              {t.create}
            </button>

            <div className="bg-purple-600 rounded-3xl border-b-[10px] border-purple-900 p-3 shadow-2xl">
              <input type="text" placeholder="CODE..." className="w-full p-4 rounded-2xl text-center font-black text-2xl text-black mb-2" onChange={(e) => setRoomCode(e.target.value.toUpperCase())} />
              <button className="w-full text-white font-black py-2 text-xl">{t.join} ➔</button>
            </div>
          </div>
          
          <button onClick={() => setLang(lang === 'ku' ? 'nl' : 'ku')} className="mt-10 bg-black/50 px-6 py-2 rounded-full font-bold text-white border border-white/20">
            {lang === 'ku' ? '🇳🇱 NEDERLANDS' : '☀️ KURDÎ'}
          </button>
        </div>
      </main>
    );
  }

  // --- GAME VIEW ---
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#1b5e20] to-black p-4 flex flex-col items-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[400px] opacity-10 pointer-events-none">☀️</div>
      
      <button onClick={() => setView('menu')} className="absolute top-6 left-6 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition">↩ MENU</button>

      {/* Speelbord */}
      <div className="flex-1 w-full flex items-center justify-center overflow-x-auto p-10">
        <div className="flex gap-2">
          {board.map((tile, i) => (
            <div key={i} className="w-12 h-20 bg-white rounded-lg border-2 border-black/20 flex flex-col items-center justify-center text-black font-black text-2xl shadow-xl rotate-90">
              {tile[0]} | {tile[1]}
            </div>
          ))}
        </div>
      </div>

      {/* Hand van speler */}
      <div className="w-full max-w-4xl bg-black/60 backdrop-blur-md p-8 rounded-[40px] border-t-4 border-yellow-500 shadow-2xl">
        <div className="flex justify-between mb-6">
          <span className="font-black text-yellow-500 uppercase tracking-widest">{t.hand}</span>
          <span className="font-black text-white opacity-50">POT: {boneyard.length}</span>
        </div>
        
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          {playerHand.map((tile, i) => (
            <button key={i} onClick={() => playTile(tile)} className="w-12 h-20 bg-white rounded-xl flex flex-col items-center justify-center text-black font-black text-xl hover:-translate-y-2 transition-transform shadow-lg border-2 border-gray-300">
              {tile[0]}<div className="w-full border-t border-black/10 my-1"/>{tile[1]}
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          <button onClick={() => {
            const newBoneyard = [...boneyard];
            const pulled = newBoneyard.pop();
            if (pulled) { setPlayerHand([...playerHand, pulled]); setBoneyard(newBoneyard); }
          }} className="bg-yellow-500 text-black px-10 py-4 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">
            {t.draw}
          </button>
        </div>
      </div>
    </main>
  );
}