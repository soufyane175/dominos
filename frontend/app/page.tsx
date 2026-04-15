"use client";
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// BELANGRIJK: Vervang dit door je eigen Railway URL na het deployen van je server
const socket = io("https://jouw-server-link.railway.app"); 

type Tile = [number, number];

export default function Home() {
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [turn, setTurn] = useState(true);

  // Functie om een kamer te maken voor vrienden
  const createRoom = () => {
    socket.emit('createRoom');
    socket.on('roomCreated', (code) => {
      setRoomCode(code);
      setView('game');
      // Startset voor demo
      setPlayerHand([[6,6], [6,1], [2,2], [0,1], [4,3]]);
    });
  };

  // Component voor de domino-steen met stippen (Fix voor de 6-1 weergave)
  const DominoTile = ({ value }: { value: Tile }) => {
    const renderDots = (num: number) => {
      const dotPositions = [
        [], // 0
        ['middle'], // 1
        ['top-right', 'bottom-left'], // 2
        ['top-right', 'middle', 'bottom-left'], // 3
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'], // 4
        ['top-left', 'top-right', 'middle', 'bottom-left', 'bottom-right'], // 5
        ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right'], // 6
      ];
      return (
        <div className="grid grid-cols-3 grid-rows-3 gap-0.5 w-8 h-8 p-1">
          {dotPositions[num].map((pos, i) => (
            <div key={i} className={`w-1.5 h-1.5 bg-black rounded-full ${
              pos === 'middle' ? 'col-start-2 row-start-2' : 
              pos === 'top-left' ? 'col-start-1 row-start-1' :
              pos === 'top-right' ? 'col-start-3 row-start-1' :
              pos === 'mid-left' ? 'col-start-1 row-start-2' :
              pos === 'mid-right' ? 'col-start-3 row-start-2' :
              pos === 'bottom-left' ? 'col-start-1 row-start-3' :
              'col-start-3 row-start-3'
            }`} />
          ))}
        </div>
      );
    };

    return (
      <div className="w-12 h-24 bg-white rounded-lg border-2 border-gray-400 flex flex-col items-center justify-between py-2 shadow-xl m-1 cursor-pointer hover:scale-105 transition-transform">
        {renderDots(value[0])}
        <div className="w-10 border-t-2 border-gray-300" />
        {renderDots(value[1])}
      </div>
    );
  };

  if (view === 'menu') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#E31E24] via-white to-[#278E43] flex flex-col items-center justify-center p-6">
        <div className="absolute w-64 h-64 bg-yellow-400 rounded-full blur-3xl opacity-30 animate-pulse" />
        <h1 className="text-8xl font-black text-white italic mb-12 drop-shadow-[0_5px_15px_rgba(0,0,0,0.4)] relative z-10">
          DOMINO
        </h1>
        <div className="flex flex-col gap-5 w-full max-w-sm relative z-10">
          <button onClick={() => setView('game')} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-3xl border-b-[10px] border-blue-900 active:border-b-0 active:translate-y-2 transition-all text-2xl shadow-2xl">
            🤖 یاری دژی بۆت
          </button>
          <button onClick={createRoom} className="bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-3xl border-b-[10px] border-green-900 active:border-b-0 active:translate-y-2 transition-all text-2xl shadow-2xl">
            🏠 دروستکردنی ژوور
          </button>
          <div className="bg-purple-600 rounded-3xl border-b-[10px] border-purple-900 p-4 shadow-2xl mt-4">
            <input type="text" placeholder="CODE..." className="w-full p-3 rounded-xl text-center font-bold text-xl mb-2" />
            <button className="w-full text-white font-black py-2">چوونە ناو ژوور ➔</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#143d1a] flex flex-col items-center p-4 relative">
       <div className="absolute top-10 right-10 text-white/10 text-9xl font-black rotate-12">☀️</div>
       
       <div className="flex justify-between w-full max-w-4xl mb-8">
         <button onClick={() => setView('menu')} className="bg-white/10 text-white px-6 py-2 rounded-full font-bold">↩ MENU</button>
         <div className="bg-yellow-500 text-black px-6 py-2 rounded-full font-black">ROOM: {roomCode || "LOCAL"}</div>
       </div>

       {/* Speelveld */}
       <div className="flex-1 w-full max-w-6xl border-4 border-white/5 rounded-[50px] flex items-center justify-center p-10 overflow-auto shadow-inner bg-black/10">
          {board.length === 0 ? (
            <p className="text-white/20 font-black text-3xl uppercase tracking-widest italic">Tawla Chara...</p>
          ) : (
            <div className="flex gap-2">
               {board.map((t, i) => <DominoTile key={i} value={t} />)}
            </div>
          )}
       </div>

       {/* Speler Hand */}
       <div className="w-full max-w-4xl bg-[#0a1f0d]/80 backdrop-blur-xl p-8 rounded-t-[50px] border-t-4 border-yellow-500 mt-4 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
             <span className="text-yellow-500 font-black tracking-tighter text-2xl italic">دەستی تۆ</span>
             <div className="h-2 w-32 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-1/2" />
             </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
             {playerHand.map((t, i) => (
               <div key={i} onClick={() => { setBoard([...board, t]); setPlayerHand(playerHand.filter((_, idx) => idx !== i)); }}>
                 <DominoTile value={t} />
               </div>
             ))}
          </div>
          <div className="flex justify-center mt-8 gap-4">
             <button className="bg-yellow-500 text-black px-12 py-4 rounded-2xl font-black text-xl hover:bg-yellow-400 transition-colors">بەرد بێنە</button>
             <button className="bg-white/10 text-white px-12 py-4 rounded-2xl font-black text-xl border border-white/20">تێپەڕین</button>
          </div>
       </div>
    </main>
  );
}