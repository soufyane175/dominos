"use client";
import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = "https://jouw-project.up.railway.app";

type Tile = [number, number];
type Message = { sender: string; text: string; time: string };

export default function Home() {
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [lang, setLang] = useState<'KU' | 'NL'>('NL');
  
  // Game states
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [botHand, setBotHand] = useState<Tile[]>([]);
  const [allDominoes, setAllDominoes] = useState<Tile[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'bot'>('player');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'player' | 'bot' | null>(null);
  
  // Room states
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [playersInRoom, setPlayersInRoom] = useState<string[]>([]);
  
  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMsg, setCurrentMsg] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);

  // Maak alle 28 domino's (dubbele zes set)
  const generateAllDominoes = () => {
    const dominoes: Tile[] = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        dominoes.push([i, j]);
      }
    }
    return dominoes;
  };

  // Schuffle array
  const shuffleArray = (array: any[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { 
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });
    
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on('connect', () => {
      console.log('Socket verbonden:', newSocket.id);
    });

    newSocket.on('roomCreated', (code: string) => {
      console.log('Kamer aangemaakt:', code);
      setRoomCode(code);
      setIsInRoom(true);
      setPlayersInRoom([newSocket.id || 'Host']);
      setView('game');
      startNewGame();
    });

    newSocket.on('roomJoined', (data: { roomCode: string, players: string[] }) => {
      console.log('Kamer gejoined:', data);
      setRoomCode(data.roomCode);
      setIsInRoom(true);
      setPlayersInRoom(data.players);
      setView('game');
      startNewGame();
    });

    newSocket.on('playerJoined', (playerId: string) => {
      console.log('Speler gejoined:', playerId);
      setPlayersInRoom(prev => [...prev, playerId]);
    });

    newSocket.on('playerLeft', (playerId: string) => {
      console.log('Speler vertrokken:', playerId);
      setPlayersInRoom(prev => prev.filter(id => id !== playerId));
    });

    newSocket.on('chatMessage', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('gameStarted', (data: { playerHand: Tile[], botHand: Tile[] }) => {
      setPlayerHand(data.playerHand);
      setBotHand(data.botHand);
      setBoard([]);
      setCurrentTurn('player');
      setGameOver(false);
      setWinner(null);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connectie error:', error);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const startNewGame = () => {
    // Genereer en schuffle alle domino's
    const dominoes = shuffleArray(generateAllDominoes());
    setAllDominoes(dominoes);
    
    // Deel 7 domino's aan elke speler
    const playerTiles = dominoes.slice(0, 7);
    const botTiles = dominoes.slice(7, 14);
    
    setPlayerHand(playerTiles);
    setBotHand(botTiles);
    setBoard([]);
    setCurrentTurn('player');
    setGameOver(false);
    setWinner(null);
    
    // Start bericht
    const startMsg: Message = {
      sender: 'SYSTEM',
      text: lang === 'NL' ? '🎮 Nieuw spel gestart! Je hebt 7 domino\'s.' : '🎮 یاری نو دەستپێکرد! تۆ ٧ دومینۆتانت هەیە.',
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
    setMessages(prev => [...prev, startMsg]);
  };

  const handleCreateRoom = () => {
    if (socket) {
      socket.connect();
      socket.emit('createRoom');
      setInputCode('');
    }
  };

  const handleJoinRoom = () => {
    if (socket && inputCode.trim()) {
      socket.connect();
      socket.emit('joinRoom', { code: inputCode.trim().toUpperCase() });
      setInputCode('');
    }
  };

  const sendChat = (text: string) => {
    if (!text.trim()) return;
    
    const msg: Message = { 
      sender: 'Ik', 
      text, 
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
    };
    
    setMessages(prev => [...prev, msg]);
    
    if (socket) {
      socket.emit('sendMessage', { 
        roomCode, 
        msg 
      });
    }
    setCurrentMsg('');
  };

  const playTile = (tile: Tile, index: number) => {
    if (currentTurn !== 'player' || gameOver) return;
    
    // Check of tile gelegd kan worden
    if (board.length === 0) {
      // Eerste tile mag altijd
      setBoard([tile]);
      setPlayerHand(prev => prev.filter((_, i) => i !== index));
      
      const playMsg: Message = {
        sender: 'SYSTEM',
        text: lang === 'NL' ? `🎯 Je legde [${tile[0]}|${tile[1]}] op het bord` : `🎯 تۆ [${tile[0]}|${tile[1]}] لە تەختەیەکدا`,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };
      setMessages(prev => [...prev, playMsg]);
      
      // Check einde spel
      if (playerHand.length === 1) {
        setGameOver(true);
        setWinner('player');
        const winMsg: Message = {
          sender: 'SYSTEM',
          text: lang === 'NL' ? '🎉 JIJ HEBT GEWONNEN! Alle domino\'s gelegd!' : '🎉 تۆ بریار دایە! هەموو دومینۆتەکان',
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        setMessages(prev => [...prev, winMsg]);
        return;
      }
      
      setCurrentTurn('bot');
      setTimeout(botPlay, 1500);
    } else {
      // Check aansluiting
      const lastTile = board[board.length - 1];
      const firstTile = board[0];
      
      if (tile[0] === lastTile[1] || tile[1] === lastTile[1] || 
          tile[0] === firstTile[0] || tile[1] === firstTile[0]) {
        
        // Bepaal kant
        if (tile[0] === lastTile[1]) {
          setBoard(prev => [...prev, tile]);
        } else if (tile[1] === lastTile[1]) {
          setBoard(prev => [...prev, [tile[1], tile[0]]]);
        } else if (tile[0] === firstTile[0]) {
          setBoard(prev => [[tile[1], tile[0]], ...prev]);
        } else if (tile[1] === firstTile[0]) {
          setBoard(prev => [tile, ...prev]);
        }
        
        setPlayerHand(prev => prev.filter((_, i) => i !== index));
        
        const playMsg: Message = {
          sender: 'SYSTEM',
          text: lang === 'NL' ? `🎯 Je legde [${tile[0]}|${tile[1]}]` : `🎯 تۆ [${tile[0]}|${tile[1]}]`,
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        setMessages(prev => [...prev, playMsg]);
        
        // Check einde spel
        if (playerHand.length === 1) {
          setGameOver(true);
          setWinner('player');
          const winMsg: Message = {
            sender: 'SYSTEM',
            text: lang === 'NL' ? '🎉 JIJ HEBT GEWONNEN!' : '🎉 تۆ بریار دایە!',
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          };
          setMessages(prev => [...prev, winMsg]);
          return;
        }
        
        setCurrentTurn('bot');
        setTimeout(botPlay, 1500);
      } else {
        // Kan niet gelegd worden
        const errorMsg: Message = {
          sender: 'SYSTEM',
          text: lang === 'NL' ? '❌ Deze kan hier niet gelegd worden!' : '❌ ئەمە ناتوانرێت لێرەدا',
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    }
  };

  const botPlay = () => {
    if (gameOver) return;
    
    let played = false;
    
    // Zoek een legale zet
    for (let i = 0; i < botHand.length; i++) {
      const tile = botHand[i];
      
      if (board.length === 0) {
        // Eerste zet
        setBoard([tile]);
        setBotHand(prev => prev.filter((_, idx) => idx !== i));
        played = true;
        break;
      } else {
        const lastTile = board[board.length - 1];
        const firstTile = board[0];
        
        if (tile[0] === lastTile[1] || tile[1] === lastTile[1] || 
            tile[0] === firstTile[0] || tile[1] === firstTile[0]) {
          
          if (tile[0] === lastTile[1]) {
            setBoard(prev => [...prev, tile]);
          } else if (tile[1] === lastTile[1]) {
            setBoard(prev => [...prev, [tile[1], tile[0]]]);
          } else if (tile[0] === firstTile[0]) {
            setBoard(prev => [[tile[1], tile[0]], ...prev]);
          } else if (tile[1] === firstTile[0]) {
            setBoard(prev => [tile, ...prev]);
          }
          
          setBotHand(prev => prev.filter((_, idx) => idx !== i));
          played = true;
          
          const botMsg: Message = {
            sender: 'BOT',
            text: lang === 'NL' ? '🤖 Bot legde een domino' : '🤖 بۆت دومینۆیەکی',
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          };
          setMessages(prev => [...prev, botMsg]);
          break;
        }
      }
    }
    
    if (!played) {
      // Bot kan niet spelen, trek een nieuwe domino
      if (allDominoes.length > 14) {
        const newDomino = allDominoes[14 + botHand.length];
        setBotHand(prev => [...prev, newDomino]);
        
        const drawMsg: Message = {
          sender: 'BOT',
          text: lang === 'NL' ? '🤖 Bot trok een nieuwe domino' : '🤖 بۆت دومینۆیەکی نوی',
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        setMessages(prev => [...prev, drawMsg]);
      } else {
        // Geen domino's meer over
        setGameOver(true);
        setWinner('player');
        const winMsg: Message = {
          sender: 'SYSTEM',
          text: lang === 'NL' ? '🎉 JIJ HEBT GEWONNEN! Bot kan niet meer spelen!' : '🎉 تۆ بریار دایە!',
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        setMessages(prev => [...prev, winMsg]);
        return;
      }
    }
    
    // Check bot win
    if (botHand.length === 0) {
      setGameOver(true);
      setWinner('bot');
      const loseMsg: Message = {
        sender: 'SYSTEM',
        text: lang === 'NL' ? '💔 JE HEBT VERLOREN! Bot won!' : '💔 تۆ شکست خۆری!',
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };
      setMessages(prev => [...prev, loseMsg]);
    } else {
      setCurrentTurn('player');
    }
  };

  const DominoTile = ({ value, onClick, small = false }: { value: Tile, onClick?: () => void, small?: boolean }) => {
    const dots = [
      [], // 0 dots
      [4], // 1 dot
      [2, 6], // 2 dots
      [2, 4, 6], // 3 dots
      [0, 2, 6, 8], // 4 dots
      [0, 2, 4, 6, 8], // 5 dots
      [0, 2, 3, 5, 6, 8] // 6 dots
    ];
    
    return (
      <div 
        onClick={onClick}
        className={`bg-white rounded-lg border-2 border-gray-400 flex flex-col items-center justify-around py-1 shadow-md transition-transform hover:scale-105 ${
          small ? 'w-8 h-16 m-0.5' : 'w-12 h-24 m-1'
        } ${onClick ? 'cursor-pointer' : ''}`}
      >
        {[0, 1].map((side, idx) => (
          <div key={idx} className={`grid grid-cols-3 gap-0.5 ${small ? 'w-4 h-4' : 'w-7 h-7'}`}>
            {[...Array(9)].map((_, i) => (
              <div 
                key={i} 
                className={`rounded-full ${
                  dots[value[side]].includes(i) 
                    ? 'bg-black' 
                    : 'bg-transparent'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const EmojiPicker = () => {
    const emojis = ['🔥', '👏', '😂', '👋', '🎯', '🎲', '🏆', '💯', '😎', '🤖'];
    
    return (
      <div className="absolute bottom-12 right-0 bg-gray-800 p-2 rounded-lg shadow-lg">
        <div className="flex flex-wrap gap-1 w-32">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                sendChat(emoji);
                setShowEmojis(false);
              }}
              className="text-xl hover:bg-gray-700 p-1 rounded"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className={`min-h-screen flex flex-col items-center justify-center relative ${
      view === 'menu' 
        ? 'bg-gradient-to-b from-[#E31E24] via-white to-[#278E43]' 
        : 'bg-[#143d1a]'
    }`}>
      
      {/* VERTALING */}
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <button 
          onClick={() => setLang('KU')} 
          className={`px-3 py-1 rounded-full font-bold text-xs ${
            lang === 'KU' ? 'bg-yellow-500 text-black' : 'bg-white/20 text-white'
          }`}
        >
          KU
        </button>
        <button 
          onClick={() => setLang('NL')} 
          className={`px-3 py-1 rounded-full font-bold text-xs ${
            lang === 'NL' ? 'bg-yellow-500 text-black' : 'bg-white/20 text-white'
          }`}
        >
          NL
        </button>
      </div>

      {view === 'menu' ? (
        <div className="flex flex-col items-center z-10 w-full max-w-xs p-4">
          <h1 className="text-6xl font-black text-white italic mb-8 drop-shadow-2xl">
            DOMINO
          </h1>
          
          <button 
            onClick={() => {
              setView('game');
              setRoomCode('BOT');
              startNewGame();
            }} 
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl border-b-8 border-blue-900 mb-4 active:translate-y-1"
          >
            🤖 {lang === 'KU' ? 'یاری دژی بۆت' : 'Tegen Bot'}
          </button>
          
          <button 
            onClick={handleCreateRoom} 
            className="w-full bg-green-600 text-white font-black py-4 rounded-2xl border-b-8 border-green-900 mb-4 active:translate-y-1"
          >
            🏠 {lang === 'KU' ? 'دروستکردنی ژوور' : 'Kamer Maken'}
          </button>
          
          <div className="bg-purple-600 p-4 rounded-2xl border-b-8 border-purple-900 w-full">
            <input 
              type="text" 
              placeholder={lang === 'KU' ? 'کۆد...' : 'CODE...'} 
              value={inputCode} 
              onChange={(e) => setInputCode(e.target.value.toUpperCase())} 
              className="w-full p-2 rounded-lg text-center font-bold mb-2 uppercase text-black" 
            />
            <button 
              onClick={handleJoinRoom}
              className="w-full bg-yellow-500 text-white font-black text-sm py-2 rounded-lg hover:bg-yellow-600"
            >
              {lang === 'KU' ? 'چوونە ناو ژوور' : 'Join Kamer'}
            </button>
          </div>
          
          {roomCode && (
            <div className="mt-4 text-white text-center">
              <p>{lang === 'KU' ? 'کۆدی ژوور:' : 'Jouw kamercode:'}</p>
              <p className="text-2xl font-bold bg-white/20 p-2 rounded">{roomCode}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full flex flex-col p-4 max-w-6xl">
          <div className="flex justify-between items-center mb-2">
            <button 
              onClick={() => {
                if (socket) socket.disconnect();
                setView('menu');
                setIsInRoom(false);
              }} 
              className="bg-white/10 text-white px-3 py-1 rounded-lg text-sm hover:bg-white/20"
            >
              ↩ {lang === 'KU' ? 'گەڕانەوە' : 'Terug'}
            </button>
            
            <div className="flex gap-4">
              <div className="bg-yellow-500 text-black px-4 py-1 rounded-lg font-bold text-sm">
                ROOM: {roomCode}
              </div>
              
              {isInRoom && (
                <div className="bg-blue-500 text-white px-4 py-1 rounded-lg font-bold text-sm">
                  👥 {playersInRoom.length} {lang === 'KU' ? 'یاریزان' : 'Spelers'}
                </div>
              )}
              
              <div className="bg-gray-700 text-white px-4 py-1 rounded-lg font-bold text-sm">
                {currentTurn === 'player' 
                  ? (lang === 'KU' ? '✅ نوبەتی تۆ' : '✅ Jouw beurt') 
                  : (lang === 'KU' ? '⏳ نوبەتی بۆت' : '⏳ Bot beurt')
                }
              </div>
            </div>
          </div>

          <div className="flex gap-4 h-[65vh]">
            {/* Speelveld */}
            <div className="flex-1 border-4 border-white/10 rounded-[30px] bg-black/20 flex items-center justify-center p-4 overflow-auto">
              {board.length === 0 ? (
                <div className="text-white/70 text-center">
                  <p className="text-xl">🎯 {lang === 'KU' ? 'دومینۆیەک هەڵببە' : 'Leg een domino'}</p>
                  <p className="text-sm mt-2">
                    {lang === 'KU' 
                      ? 'بۆ دەستپێکردن، هەر دومینۆیەک هەڵببە' 
                      : 'Klik op een tegel uit je hand om te beginnen'
                    }
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-1">
                  {board.map((tile, i) => (
                    <DominoTile key={i} value={tile} />
                  ))}
                </div>
              )}
            </div>

            {/* CHAT BOX */}
            <div className="w-72 bg-black/30 rounded-[30px] flex flex-col p-4 border border-white/10 relative">
              <div className="flex-1 overflow-y-auto mb-2 space-y-2">
                {messages.map((msg, i) => (
                  <div key={i} className={`p-2 rounded-lg text-xs text-white ${
                    msg.sender === 'SYSTEM' 
                      ? 'bg-blue-600/30' 
                      : msg.sender === 'BOT' 
                        ? 'bg-purple-600/30' 
                        : 'bg-white/10'
                  }`}>
                    <span className={`font-bold ${
                      msg.sender === 'SYSTEM' ? 'text-blue-300' : 
                      msg.sender === 'BOT' ? 'text-purple-300' : 'text-yellow-500'
                    }`}>
                      {msg.sender}: 
                    </span>
                    <span className="ml-1">{msg.text}</span>
                    <div className="text-gray-400 text-[10px] mt-1">{msg.time}</div>
                  </div>
                ))}
                <div className="text-center text-white/50 text-xs py-2">
                  {lang === 'KU' ? '--- پەیامی نوێ ---' : '--- Nieuw bericht ---'}
                </div>
              </div>
              
              <div className="relative">
                {showEmojis && <EmojiPicker />}
                
                <div className="flex flex-wrap gap-1 mb-2">
                  {['🔥', '👏', '😂', '👋', '🎯'].map((e) => (
                    <button 
                      key={e} 
                      onClick={() => sendChat(e)} 
                      className="bg-white/5 p-1 rounded hover:bg-white/20 text-lg"
                    >
                      {e}
                    </button>
                  ))}
                  <button 
                    onClick={() => setShowEmojis(!showEmojis)}
                    className="bg-white/5 p-1 rounded hover:bg-white/20 text-sm"
                  >
                    😀+
                  </button>
                </div>
                
                <div className="flex gap-1">
                  <input 
                    value={currentMsg} 
                    onChange={e => setCurrentMsg(e.target.value)} 
                    onKeyPress={e => e.key === 'Enter' && sendChat(currentMsg)} 
                    className="flex-1 bg-white/10 rounded p-2 text-sm text-white" 
                    placeholder={lang === 'KU' ? 'پەیام بنێڵە...' : 'Typ een bericht...'} 
                  />
                  <button 
                    onClick={() => sendChat(currentMsg)} 
                    className="bg-green-600 px-3 rounded text-sm text-white font-bold hover:bg-green-700"
                  >
                    {lang === 'KU' ? 'ناردن' : 'SEND'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Hand van de speler */}
          <div className="bg-black/40 p-4 rounded-[30px] border-t-4 border-yellow-500 mt-4">
            <div className="flex justify-between items-center mb-2">
              <div className="text-white">
                <span className="font-bold">{lang === 'KU' ? 'دومینۆیەکانت:' : 'Jouw hand:'}</span>
                <span className="ml-2 bg-yellow-500 text-black px-2 py-1 rounded-full text-sm">
                  {playerHand.length} {lang === 'KU' ? 'دومینۆ' : 'stukken'}
                </span>
              </div>
              
              {gameOver && (
                <div className={`font-bold px-4 py-2 rounded-lg ${
                  winner === 'player' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                  {winner === 'player' 
                    ? (lang === 'KU' ? '🏆 بریار! 🎉' : '🏆 GEWONNEN! 🎉')
                    : (lang === 'KU' ? '💔 شکست خۆڕی! 🤖' : '💔 VERLOREN! 🤖')
                  }
                </div>
              )}
            </div>
            
            <div className="flex justify-center gap-2 overflow-x-auto py-2">
              {playerHand.map((tile, i) => (
                <div key={i} className="relative">
                  <DominoTile 
                    value={tile} 
                    onClick={() => playTile(tile, i)}
                  />
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-center gap-2 mt-2">
              <button 
                onClick={startNewGame}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700"
              >
                {lang === 'KU' ? '🔄 یاری نوو' : '🔄 Nieuw Spel'}
              </button>
              
              <button 
                onClick={() => {
                  if (socket) socket.disconnect();
                  setView('menu');
                  setIsInRoom(false);
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-700"
              >
                {lang === 'KU' ? '🚪 چوونە دەرەوە' : '🚪 Verlaten'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}