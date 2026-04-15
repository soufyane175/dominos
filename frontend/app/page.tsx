"use client";
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// BELANGRIJK: Gebruik hier jouw actuele Railway URL!
const SOCKET_URL = "https://jouw-project-naam.up.railway.app"; 

type Tile = [number, number];

export default function Home() {
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialiseer de verbinding zodra de app start
  useEffect(() => {
    const newSocket = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on('connect', () => console.log("Verbonden met server!"));
    
    newSocket.on('roomCreated', (code: string) => {
      setRoomCode(code);
      setIsOnline(true);
      setView('game');
      setPlayerHand([[6,6], [1,2], [3,3], [4,5], [0,0]]); // Startset
    });

    return () => { newSocket.close(); };
  }, []);

  const handleCreateRoom = () => {
    if (socket && socket.connected) {
      socket.emit('createRoom');
    } else {
      alert("Server niet bereikbaar. Controleer je Railway link!");
    }
  };

  const startBotGame = () => {
    setIsOnline(false);
    setRoomCode('');
    setView('game');
    setPlayerHand([[6,6], [5,4], [2,1], [3,3], [0,0]]);
  };

  const DominoTile = ({ value }: { value: Tile }) => {
    const dots = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    const renderSide = (num: number) => (
      <div className="grid grid-cols-3 gap-1 w-8 h-8">
        {[...Array(9)].map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full ${dots[num].includes(i) ? 'bg-black' : 'bg-transparent'}`} />
        ))}
      </div>
    );
    return (
      <div className="w-12 h-24 bg-white rounded-lg border-2 border-gray-400 flex flex-col items-center justify-around py-1 shadow-xl m-1">
        {renderSide(value[0])}
        <div className="w-10 border-t border-gray-300" />
        {renderSide(value[1])}
      </div>
    );
  };

  return (
    <main className={`min-h-screen flex flex-col items-center justify-center relative ${view === 'menu' ? 'bg-gradient-to-b from-[#E31E24] via-white to-[#278E43]' : 'bg-[#143d1a]'}`}>
      <audio ref={audioRef} loop src="/kurdish-music.mp3" />

      {view === 'menu' ? (
        <div className="flex flex-col items-center z-10">
          <h1 className="text-8xl font-black text-white italic mb-12 drop-shadow-2xl">DOMINO</h1>
          <div className="flex flex-col gap-6 w-full max-w-xs">
            <button onClick={startBotGame} className="bg-blue-600 text-white font-black py-5 rounded-3xl border-b-[10px] border-blue-900 active:translate-y-2 active:border-b-0 transition-all text-2xl shadow-2xl">🤖 یاری دژی بۆت</button>
            <button onClick={handleCreateRoom} className="bg-green-600 text-white font-black py-5 rounded-3xl border-b-[10px] border-green-900 active:translate-y-2 active:border-b-0 transition-all text-2xl shadow-2xl">🏠 دروستکردنی ژوور</button>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center p-4">
          <div className="flex justify-between w-full max-w-4xl mb-4 z-10 text-white">
            <button onClick={() => setView('menu')} className="bg-white/10 px-4 py-2 rounded-xl font-bold">↩ MENU</button>
            <div className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold italic">
              {isOnline ? `ROOM: ${roomCode}` : "BOT MODE"}
            </div>
          </div>
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
        </div>
      )}
    </main>
  );
}