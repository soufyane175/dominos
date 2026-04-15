"use client";
import { useState, useEffect, useRef } from 'react';

// --- DOMINO TILE COMPONENT ---
const DominoTile = ({ value, onClick, disabled }) => {
  const [top, bottom] = value;
  const pipMap = {
    0: [], 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]], 5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
  };

  const renderHalf = (pips, isTop) => (
    <div className={`relative w-full h-1/2 p-1 ${isTop ? 'border-b border-black/10' : ''}`}>
      {pips.map(([r, c], i) => (
        <div key={i} className="absolute w-1.5 h-1.5 rounded-full" 
             style={{ top: `${15 + r * 25}%`, left: `${15 + c * 25}%`, background: top === bottom ? '#FDB913' : 'black' }} />
      ))}
    </div>
  );

  return (
    <button onClick={onClick} disabled={disabled}
      className={`relative w-10 h-16 bg-white rounded-md border-2 border-gray-200 shadow-md flex flex-col items-center shrink-0
        ${disabled ? 'opacity-100' : 'hover:-translate-y-1 cursor-pointer hover:border-yellow-500 active:scale-95'}`}>
      {renderHalf(pipMap[top], true)}
      <div className="w-full h-[1px] bg-black/20 relative"><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-yellow-600 shadow-sm" /></div>
      {renderHalf(pipMap[bottom], false)}
    </button>
  );
};

export default function Home() {
  // --- STATES ---
  const [lang, setLang] = useState('ku'); // 'ku' of 'nl'
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("menu");
  const [roomCode, setRoomCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  // Game States
  const [board, setBoard] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [botHand, setBotHand] = useState([]);
  const [boneyard, setBoneyard] = useState([]);
  const [turn, setTurn] = useState("player");
  const [winner, setWinner] = useState(null);

  // Vertalingen
  const t = {
    ku: { login: "چوونەژوورەوە", bot: "یاری دژی بۆت", online: "یاری ئۆنلاین", make: "دروستکردنی ژوور", join: "چوونە ناو ژوور", code: "کۆدی ژوور", send: "بنێرە", turn: "نۆبەی تۆیە", draw: "بەرد بێنە", win: "تۆ بردتەوە! 🎉", loss: "بۆت بردییەوە! 🤖", chat: "چات", placeholder: "بنووسە..." },
    nl: { login: "Inloggen", bot: "Tegen Bot", online: "Online Spelen", make: "Kamer Maken", join: "Join Kamer", code: "Kamer Code", send: "Stuur", turn: "Jouw beurt", draw: "Trek steen", win: "Je hebt gewonnen! 🎉", loss: "Bot heeft gewonnen! 🤖", chat: "Chat", placeholder: "Typ een bericht..." }
  }[lang];

  // --- GAME LOGICA ---
  const startGame = (type) => {
    if (!isLoggedIn) return alert(lang === 'ku' ? "تکایە سەرەتا بچۆ ژوورەوە!" : "Log eerst in!");
    let deck = [];
    for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) deck.push([i, j]);
    deck.sort(() => Math.random() - 0.5);
    setPlayerHand(deck.slice(0, 7));
    setBotHand(deck.slice(7, 14));
    setBoneyard(deck.slice(14));
    setBoard([]);
    setTurn("player");
    setWinner(null);
    setMessages([{ text: "Yari destpê kir! / Spel gestart!", sender: "System" }]);
    setCurrentScreen(type === 'bot' ? "game" : "game");
  };

  const playTile = (tile, isBot = false) => {
    let newBoard = [...board];
    let canPlay = false;

    if (board.length === 0) {
      newBoard.push(tile);
      canPlay = true;
    } else {
      const left = board[0][0];
      const right = board[board.length - 1][1];
      if (tile[0] === right) { newBoard.push(tile); canPlay = true; }
      else if (tile[1] === right) { newBoard.push([tile[1], tile[0]]); canPlay = true; }
      else if (tile[1] === left) { newBoard.unshift(tile); canPlay = true; }
      else if (tile[0] === left) { newBoard.unshift([tile[1], tile[0]]); canPlay = true; }
    }

    if (canPlay) {
      setBoard(newBoard);
      if (!isBot) {
        const newHand = playerHand.filter(t => t !== tile);
        setPlayerHand(newHand);
        if (newHand.length === 0) setWinner("Player"); else setTurn("bot");
      } else {
        const newHand = botHand.filter(t => t !== tile);
        setBotHand(newHand);
        if (newHand.length === 0) setWinner("Bot"); else setTurn("player");
      }
    }
  };

  // BOT AI
  useEffect(() => {
    if (turn === "bot" && !winner && currentScreen === "game") {
      const timer = setTimeout(() => {
        const left = board[0]?.[0];
        const right = board[board.length - 1]?.[1];
        const move = botHand.find(t => board.length === 0 || t[0] === left || t[1] === left || t[0] === right || t[1] === right);
        if (move) playTile(move, true);
        else if (boneyard.length > 0) {
          const nb = [...boneyard]; setBotHand([...botHand, nb.pop()]); setBoneyard(nb);
        } else setTurn("player");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [turn, board, winner]);

  // CHAT FUNCTIE
  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setMessages([...messages, { text: chatInput, sender: "You" }]);
    setChatInput("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // --- UI ---
  const flagBg = "min-h-screen bg-gradient-to-b from-[#ED2024] via-white to-[#278E43] flex flex-col items-center p-4 relative overflow-hidden";

  if (currentScreen === "menu") return (
    <main className={flagBg}>
      <div className="z-10 w-full max-w-md">
        <div className="flex justify-between mb-8 bg-black/80 p-4 rounded-2xl border border-white/20 shadow-xl">
          <div className="flex gap-2">
            <button onClick={() => setLang('ku')} className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${lang === 'ku' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white'}`}>☀️ KURDÎ</button>
            <button onClick={() => setLang('nl')} className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${lang === 'nl' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white'}`}>🇳🇱 NL</button>
          </div>
          <button onClick={() => setIsLoggedIn(true)} className="text-white text-xs font-bold px-4 bg-white/10 rounded-full">{isLoggedIn ? "● Online" : t.login}</button>
        </div>

        <h1 className="text-7xl font-black text-white text-center italic mb-10 drop-shadow-2xl tracking-tighter">DOMINO</h1>

        <div className="flex flex-col gap-5">
          <button onClick={() => startGame('bot')} className="bg-blue-600 p-8 rounded-[32px] border-4 border-white text-white font-black text-2xl shadow-2xl hover:scale-105 transition-all">🤖 {t.bot}</button>
          
          <div className="bg-green-600 p-6 rounded-[32px] border-4 border-white shadow-2xl flex flex-col gap-4">
             <button onClick={() => { setRoomCode("DOM-42"); setCurrentScreen("lobby"); }} className="text-white font-black text-xl uppercase italic">🏠 {t.make}</button>
          </div>

          <div className="bg-purple-600 p-6 rounded-[32px] border-4 border-white shadow-2xl flex flex-col gap-3">
             <input value={joinInput} onChange={e => setJoinInput(e.target.value.toUpperCase())} placeholder="CODE..." className="p-3 rounded-2xl text-center text-black font-black uppercase text-xl" />
             <button onClick={() => { setRoomCode(joinInput); startGame('online'); }} className="text-white font-black text-lg">{t.join}</button>
          </div>
        </div>
      </div>
    </main>
  );

  if (currentScreen === "lobby") return (
    <main className={flagBg}>
      <div className="z-10 bg-black/90 p-10 rounded-[40px] border-4 border-yellow-500 text-center text-white mt-20 shadow-2xl">
        <h2 className="text-2xl font-black mb-4 uppercase tracking-widest text-yellow-500">{t.code}</h2>
        <div className="text-6xl font-mono font-black text-white mb-8 bg-white/10 py-6 px-10 rounded-3xl border border-white/20 tracking-widest">{roomCode}</div>
        <p className="text-sm opacity-60 mb-10">Stuur deze code naar je vriend!</p>
        <div className="flex flex-col gap-3">
            <button onClick={() => startGame('online')} className="bg-green-600 py-4 rounded-2xl font-black text-xl shadow-lg">START</button>
            <button onClick={() => setCurrentScreen("menu")} className="text-red-400 font-bold underline">Annuleren</button>
        </div>
      </div>
    </main>
  );

  return (
    <main className={flagBg}>
      <div className="z-10 w-full max-w-6xl flex flex-col h-screen">
        <div className="bg-black/80 p-4 rounded-2xl flex justify-between items-center text-white mb-4 border border-white/20 shadow-lg">
          <button onClick={() => setCurrentScreen("menu")} className="bg-red-600 w-10 h-10 rounded-full font-black shadow-md hover:bg-red-700">X</button>
          <div className="text-center">
            <p className="text-[10px] text-yellow-500 font-black uppercase tracking-widest">Domino Kurdistan</p>
            <p className="text-xs font-bold text-white/50">{roomCode || "Offline Mode"}</p>
          </div>
          <div className="text-xs bg-white/10 px-3 py-1 rounded-full border border-white/10">Pot: {boneyard.length}</div>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden mb-4">
          {/* SPEELVELD */}
          <div className="flex-[3] bg-black/40 rounded-[40px] border-2 border-white/20 flex items-center justify-center p-8 overflow-x-auto gap-3 shadow-inner">
            {board.map((tile, i) => <DominoTile key={i} value={tile} disabled={true} />)}
            {board.length === 0 && <p className="text-white/30 animate-pulse font-black text-2xl uppercase italic tracking-widest">Dê destpê bike...</p>}
          </div>

          {/* CHAT SECTIE MET ZWARTE LETTERS */}
          <div className="flex-1 bg-white rounded-[40px] border-2 border-black/10 flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-yellow-500 p-3 font-black text-center text-sm uppercase text-black border-b border-black/10">{t.chat}</div>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2">
              {messages.map((m, i) => (
                <div key={i} className={`${m.sender === 'You' ? 'bg-blue-100 self-end text-right' : 'bg-gray-100 self-start text-left'} p-3 rounded-2xl max-w-[90%] shadow-sm border border-black/5`}>
                  <p className="text-[8px] font-black text-black/40 mb-1 uppercase tracking-tighter">{m.sender}</p>
                  <p className="text-sm text-black font-bold leading-tight">{m.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} className="p-3 bg-gray-50 border-t border-gray-100 flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={t.placeholder} className="flex-1 text-sm p-3 rounded-2xl bg-white border border-gray-200 text-black font-bold outline-none focus:border-yellow-500" />
              <button type="submit" className="bg-yellow-500 text-black w-12 h-12 rounded-full font-black text-xl shadow-md active:scale-90">↑</button>
            </form>
          </div>
        </div>

        {/* HAND VAN DE SPELER */}
        <div className="bg-black/90 p-8 rounded-t-[50px] border-t-4 border-yellow-500 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
             <p className="text-white font-black text-xs uppercase tracking-widest">بەردەکانی تۆ (Hand)</p>
             {winner && <h2 className="text-yellow-400 font-black animate-bounce text-xl">{winner === 'Player' ? t.win : t.loss}</h2>}
             {turn === 'player' && !winner && <span className="bg-green-500 text-black px-4 py-1 rounded-full text-[10px] font-black animate-pulse">{t.turn}</span>}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            {playerHand.map((tile, i) => (
              <DominoTile key={i} value={tile} onClick={() => playTile(tile)} disabled={turn !== 'player' || winner} />
            ))}
            {turn === 'player' && !winner && boneyard.length > 0 && (
              <button onClick={() => setPlayerHand([...playerHand, boneyard.pop()])} className="bg-yellow-500 text-black px-6 py-2 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all">{t.draw}</button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}