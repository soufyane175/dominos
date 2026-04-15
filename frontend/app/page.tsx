"use client";
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// BELANGRIJK: Vul hier je eigen Railway link in!
const SOCKET_URL = "https://jouw-project.up.railway.app"; 

type Tile = [number, number];

export default function Home() {
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [lang, setLang] = useState<'KU' | 'NL'>('KU');
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { transports: ['websocket'], autoConnect: false });
    setSocket(newSocket);

    newSocket.on('roomCreated', (code: string) => {
      setRoomCode(code);
      setView('game');
      setPlayerHand([[6,6], [1,2], [3,3], [4,5], [0,0]]);
    });

    newSocket.on('joinedRoom', () => {
      setView('game');
      setPlayerHand([[6,6], [1,2], [3,3], [4,5], [0,0]]);
    });

    return () => { newSocket.close(); };
  }, []);

  const handleCreateRoom = () => {
    if (socket) {
      socket.connect();
      socket.emit('createRoom');
    }
  };

  const handleJoinRoom = () => {
    if (socket && inputCode) {
      socket.connect();
      socket.emit('joinRoom', inputCode);
    }
  };

  const startBotGame = () => {
    setView('game');
    setRoomCode('BOT');
    setPlayerHand([[6,6], [5,4], [2,1], [3,3], [0,0]]);
  };

  const DominoTile = ({ value }: { value: Tile }) => {
    const dots = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    return (
      <div className="w-12 h-24 bg-white rounded-lg border-2 border-gray-400 flex flex-col items-center justify-around py-1 shadow-xl m-1 cursor-pointer hover:scale-110 transition-transform">
        {[0, 1].map((side) => (
          <div key={side} className="grid grid-cols-3 gap-1 w-8 h-8">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${dots[value[side]].includes(i) ? 'bg-black' : 'bg-transparent'}`} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className={`min-h-screen flex flex-col items-center justify-center relative ${view === 'menu' ? 'bg-gradient-to-b from-[#E31E24] via-white to-[#278E43]' : 'bg-[#143d1a]'}`}>
      
      {/* VERTALING KNOP BOVENAAN */}
      <div className="absolute top-5 flex gap-2 z-50">
        <button onClick={() => setLang('KU')} className={`px-4 py-1 rounded-full font-bold ${lang === 'KU' ? 'bg-yellow-500 text-black' : 'bg-white/20 text-white'}`}>KU</button>
        <button onClick={() => setLang('NL')} className={`px-4 py-1 rounded-full font-bold ${lang === 'NL' ? 'bg-yellow-500 text-black' : 'bg-white/20 text-white'}`}>NL</button>
      </div>

      {view === 'menu' ? (
        <div className="flex flex-col items-center z-10 w-full max-w-xs">
          <h1 className="text-7xl font-black text-white italic mb-10 drop-shadow-2xl">DOMINO</h1>
          
          <div className="flex flex-col gap-4 w-full">
            <button onClick={startBotGame} className="bg-blue-600 text-white font-black py-4 rounded-2xl border-b-8 border-blue-900 active:translate-y-1 active:border-b-0 transition-all">
              {lang === 'KU' ? '🤖 یاری دژی بۆت' : '🤖 Spelen tegen Bot'}
            </button>
            
            <button onClick={handleCreateRoom} className="bg-green-600 text-white font-black py-4 rounded-2xl border-b-8 border-green-900 active:translate-y-1 active:border-b-0 transition-all">
              {lang === 'KU' ? '🏠 دروستکردنی ژوور' : '🏠 Kamer Maken'}
            </button>

            <div className="bg-purple-600 p-4 rounded-2xl border-b-8 border-purple-900 shadow-xl">
              <input 
                type="text" 
                placeholder="CODE..." 
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                className="w-full p-2 rounded-lg text-center font-bold mb-2 uppercase text-black"
              />
              <button onClick={handleJoinRoom} className="w-full text-white font-black">
                {lang === 'KU' ? 'چوونە ناو ژوور ➔' : 'Join Kamer ➔'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center p-4">
          <div className="flex justify-between w-full max-w-4xl mb-4 text-white">
            <button onClick={() => setView('menu')} className="bg-white/10 px-4 py-1 rounded-lg">↩</button>
            <div className="bg-yellow-500 text-black px-4 py-1 rounded-lg font-bold italic">CODE: {roomCode || "BOT"}</div>
          </div>
          <div className="flex-1 w-full border-4 border-white/10 rounded-[40px] bg-black/20 flex items-center justify-center overflow-auto">
            {board.map((t, i) => <DominoTile key={i} value={t} />)}
          </div>
          <div className="w-full max-w-4xl bg-black/40 p-6 rounded-t-[40px] border-t-4 border-yellow-500 mt-4">
            <div className="flex flex-wrap justify-center gap-1">
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