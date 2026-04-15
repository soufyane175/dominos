"use client";
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// BELANGRIJK: Vul hier je eigen Railway link in!
const socket = io("https://jouw-server.up.railway.app"); 

type Tile = [number, number];

export default function Home() {
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [roomCode, setRoomCode] = useState('');
  
  // Muziek referentie
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Functie om muziek te starten
  const playMusic = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => console.log("Muziek start na klik"));
    }
  };

  const createRoom = () => {
    playMusic(); // Start muziek bij interactie
    socket.emit('createRoom');
    socket.on('roomCreated', (code) => {
      setRoomCode(code);
      setView('game');
      setPlayerHand([[6,6], [6,1], [2,2], [0,1], [4,3]]);
    });
  };

  const startBotGame = () => {
    playMusic(); // Start muziek bij interactie
    setView('game');
    setPlayerHand([[6,6], [5,4], [2,1], [3,3], [0,0]]);
  };

  // Domino Steen Component (Met stippen fix)
  const DominoTile = ({ value }: { value: Tile }) => {
    const renderDots = (num: number) => {
      const positions = [
        [], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]
      ];
      return (
        <div className="grid grid-cols-3 gap-1 w-8 h-8">
          {[...Array(9)].map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${positions[num].includes(i) ? 'bg-black' : 'bg-transparent'}`} />
          ))}
        </div>
      );
    };
    return (
      <div className="w-12 h-24 bg-white rounded-lg border-2 border-gray-400 flex flex-col items-center justify-around py-1 shadow-xl m-1">
        {renderDots(value[0])}
        <div className="w-10 border-t border-gray-300" />
        {renderDots(value[1])}
      </div>
    );
  };

  return (
    <main className={`min-h-screen flex flex-col items-center justify-center relative overflow-hidden ${view === 'menu' ? 'bg-gradient-to-b from-[#E31E24] via-white to-[#278E43]' : 'bg-[#143d1a]'}`}>
      
      {/* Verborgen Audio Element */}
      <audio ref={audioRef} loop>
        <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg" />
      </audio>

      {view === 'menu' ? (
        <>
          <div className="absolute w-80 h-80 bg-yellow-400 rounded-full blur-[100px] opacity-30 animate-pulse" />
          <h1 className="text-8xl font-black text-white italic mb-12 drop-shadow-2xl z-10">DOMINO</h1>
          <div className="flex flex-col gap-6 w-full max-w-xs z-10">
            <button onClick={startBotGame} className="bg-blue-600 text-white font-black py-5 rounded-3xl border-b-[10px] border-blue-900 active:translate-y-2 active:border-b-0 transition-all text-2xl shadow-2xl">
              🤖 یاری دژی بۆت
            </button>
            <button onClick={createRoom} className="bg-green-600 text-white font-black py-5 rounded-3xl border-b-[10px] border-green-900 active:translate-y-2 active:border-b-0 transition-all text-2xl shadow-2xl">
              🏠 دروستکردنی ژوور
            </button>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center p-4">
          <div className="absolute top-10 right-10 text-white/5 text-[15rem] font-black select-none">☀️</div>
          <div className="flex-1 flex items-center justify-center w-full border-4 border-white/5 rounded-[50px] bg-black/10 shadow-inner overflow-auto">
            {board.map((t, i) => <DominoTile key={i} value={t} />)}
          </div>
          <div className="w-full max-w-4xl bg-black/40 backdrop-blur-md p-8 rounded-t-[50px] border-t-4 border-yellow-500 mt-4 shadow-2xl">
            <div className="flex flex-wrap justify-center gap-2">
              {playerHand.map((t, i) => (
                <div key={i} onClick={() => { setBoard([...board, t]); setPlayerHand(playerHand.filter((_, idx) => idx !== i)); }}>
                  <DominoTile value={t} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}