"use client";
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// VERVANG DIT DOOR JE EIGEN RAILWAY URL!
const SOCKET_URL = "https://jouw-project.up.railway.app"; 

type Tile = [number, number];
type Message = { sender: string; text: string; time: string };

export default function Home() {
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [lang, setLang] = useState<'KU' | 'NL'>('NL');
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [username, setUsername] = useState('Speler' + Math.floor(Math.random() * 100));
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMsg, setCurrentMsg] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat naar beneden
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { transports: ['websocket'], autoConnect: false });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log("Verbonden met server!");
    });

    newSocket.on('roomCreated', (code: string) => {
      setRoomCode(code);
      setView('game');
      setPlayerHand([[6,6], [1,2], [3,3], [4,5], [0,0]]);
    });

    newSocket.on('chatMessage', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('error', (err) => console.error("Socket error:", err));

    return () => { newSocket.close(); };
  }, []);

  // BOT LOGICA: Als we in BOT mode zijn, laat de bot dan na 2 seconden een steen leggen
  useEffect(() => {
    if (view === 'game' && roomCode === 'BOT') {
      const botTurn = setTimeout(() => {
        const botTile: Tile = [Math.floor(Math.random() * 7), Math.floor(Math.random() * 7)];
        setBoard(prev => [...prev, botTile]);
        
        // Bot stuurt een berichtje in de chat
        const botMsg: Message = { 
          sender: '🤖 BOT', 
          text: 'Ik ben aan zet!', 
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
        };
        setMessages(prev => [...prev, botMsg]);
      }, 2000);
      return () => clearTimeout(botTurn);
    }
  }, [board, view, roomCode]);

  const handleCreateRoom = () => {
    if (socket) {
      socket.connect();
      socket.emit('createRoom');
      // Voor testdoeleinden als je backend nog niet werkt:
      // setTimeout(() => { setRoomCode("TEST-" + Math.floor(Math.random()*1000)); setView('game'); setPlayerHand([[6,6], [1,2], [3,3]]); }, 1000);
    }
  };

  const handleJoinRoom = () => {
    if (socket && inputCode.trim() !== '') {
      socket.connect();
      socket.emit('joinRoom', inputCode);
      setRoomCode(inputCode);
      setView('game');
      setPlayerHand([[5,5], [2,2], [1,1]]);
    }
  };

  const sendChat = (text: string) => {
    if (!text.trim()) return;
    const msg: Message = { 
      sender: username, 
      text, 
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
    };
    
    // Voeg toe aan eigen scherm
    setMessages(prev => [...prev, msg]);
    
    // Stuur naar vrienden via socket
    if (socket?.connected) {
      socket.emit('sendMessage', { room: roomCode, msg });
    }
    setCurrentMsg('');
  };

  const DominoTile = ({ value }: { value: Tile }) => {
    const dots = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    return (
      <div className="w-10 h-20 bg-white rounded-lg border-2 border-gray-400 flex flex-col items-center justify-around py-1 shadow-md m-0.5 transition-transform hover:scale-110 cursor-pointer">
        {[0, 1].map((side, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-0.5 w-6 h-6">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`w-1 h-1 rounded-full ${dots[value[side]].includes(i) ? 'bg-black' : 'bg-transparent'}`} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className={`min-h-screen flex flex-col items-center justify-center relative ${view === 'menu' ? 'bg-gradient-to-b from-[#E31E24] via-white to-[#278E43]' : 'bg-[#143d1a]'}`}>
      
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <button onClick={() => setLang('KU')} className={`px-3 py-1 rounded-full font-bold text-xs ${lang === 'KU' ? 'bg-yellow-500 text-black' : 'bg-white/20 text-white'}`}>KU</button>
        <button onClick={() => setLang('NL')} className={`px-3 py-1 rounded-full font-bold text-xs ${lang === 'NL' ? 'bg-yellow-500 text-black' : 'bg-white/20 text-white'}`}>NL</button>
      </div>

      {view === 'menu' ? (
        <div className="flex flex-col items-center z-10 w-full max-w-xs p-4">
          <h1 className="text-6xl font-black text-white italic mb-8 drop-shadow-2xl">DOMINO</h1>
          
          {/* BOT BUTTON */}
          <button onClick={() => { setView('game'); setRoomCode('BOT'); setPlayerHand([[6,6], [5,4], [2,1]]); }} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl border-b-8 border-blue-900 mb-4 active:translate-y-1">🤖 {lang === 'KU' ? 'یاری دژی بۆت' : 'Tegen Bot'}</button>
          
          {/* CREATE ROOM BUTTON */}
          <button onClick={handleCreateRoom} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl border-b-8 border-green-900 mb-4 active:translate-y-1">🏠 {lang === 'KU' ? 'دروستکردنی ژوور' : 'Kamer Maken'}</button>
          
          {/* JOIN ROOM BOX */}
          <div className="bg-purple-600 p-4 rounded-2xl border-b-8 border-purple-900 w-full">
            <input type="text" placeholder="CODE..." value={inputCode} onChange={(e) => setInputCode(e.target.value)} className="w-full p-2 rounded-lg text-center font-bold mb-2 uppercase text-black" />
            <button onClick={handleJoinRoom} className="w-full text-white font-black text-sm">{lang === 'KU' ? 'چوونە ناو ژوور' : 'Joinen'}</button>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col p-4 max-w-5xl">
          <div className="flex justify-between items-center mb-2">
            <button onClick={() => setView('menu')} className="bg-white/10 text-white px-3 py-1 rounded-lg text-sm">↩</button>
            <div className="bg-yellow-500 text-black px-4 py-1 rounded-lg font-bold text-sm">ROOM: {roomCode} | {username}</div>
          </div>

          <div className="flex gap-4 h-[65vh]">
            {/* Speelveld */}
            <div className="flex-1 border-4 border-white/10 rounded-[30px] bg-black/20 flex items-center justify-center p-4 overflow-auto">
              {board.map((t, i) => <DominoTile key={i} value={t} />)}
              {board.length === 0 && <p className="text-white/30 italic">Speelveld is leeg...</p>}
            </div>

            {/* CHAT BOX */}
            <div className="w-72 bg-black/40 rounded-[30px] flex flex-col p-4 border border-white/10">
              <div className="flex-1 overflow-y-auto mb-2 space-y-2 pr-2 custom-scrollbar">
                {messages.map((m, i) => (
                  <div key={i} className="bg-white/10 p-2 rounded-lg text-xs text-white">
                    <span className="font-bold text-yellow-500">{m.sender}: </span>{m.text}
                    <div className="text-[8px] text-white/40 text-right">{m.time}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              
              {/* Emoji Quick Select */}
              <div className="flex flex-wrap gap-1 mb-2">
                {['🔥', '👏', '😂', '👋', '❤️', '👍', '😎', '🤔'].map(e => (
                  <button key={e} onClick={() => sendChat(e)} className="bg-white/5 p-1 rounded hover:bg-white/20 text-sm">{e}</button>
                ))}
              </div>

              <div className="flex gap-1">
                <input 
                  value={currentMsg} 
                  onChange={e => setCurrentMsg(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && sendChat(currentMsg)} 
                  className="flex-1 bg-white/10 rounded-lg p-2 text-xs text-white outline-none focus:ring-1 ring-yellow-500" 
                  placeholder="Typ bericht..." 
                />
                <button onClick={() => sendChat(currentMsg)} className="bg-green-600 px-3 rounded-lg text-xs text-white font-bold">SEND</button>
              </div>
            </div>
          </div>

          {/* Hand van de speler */}
          <div className="bg-black/40 p-4 rounded-[30px] border-t-4 border-yellow-500 mt-4 flex justify-center gap-2 overflow-x-auto">
            {playerHand.map((t, i) => (
              <div key={i} onClick={() => { 
                setBoard([...board, t]); 
                setPlayerHand(playerHand.filter((_, idx) => idx !== i)); 
              }}>
                <DominoTile value={t} />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}