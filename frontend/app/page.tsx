"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";

type Tile = [number, number];
type Message = { sender: string; text: string; time: string };
type BoardEntry = { tile: Tile; flipped: boolean };

function allTiles(): Tile[] {
  const t: Tile[] = [];
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) t.push([i, j]);
  return t;
}
function shuffle(a: Tile[]): Tile[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
function getEnds(board: BoardEntry[]): [number, number] {
  if (!board.length) return [-1, -1];
  const f = board[0], l = board[board.length - 1];
  return [f.flipped ? f.tile[1] : f.tile[0], l.flipped ? l.tile[0] : l.tile[1]];
}
function canPlay(tile: Tile, board: BoardEntry[], ends: [number, number]): "left" | "right" | null {
  if (!board.length) return "right";
  const [le, re] = ends;
  if (tile[0] === le || tile[1] === le) return "left";
  if (tile[0] === re || tile[1] === re) return "right";
  return null;
}
function genCode(): string {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 5; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

const KurdistanSun = ({ size = 200, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
    {[...Array(21)].map((_, i) => {
      const a = (i * 360) / 21 - 90, r = (a * Math.PI) / 180;
      const x2 = 100 + Math.cos(r) * 90, y2 = 100 + Math.sin(r) * 90;
      const lr = ((a - 8) * Math.PI) / 180, rr = ((a + 8) * Math.PI) / 180;
      return <polygon key={i} points={`${100 + Math.cos(lr) * 45},${100 + Math.sin(lr) * 45} ${x2},${y2} ${100 + Math.cos(rr) * 45},${100 + Math.sin(rr) * 45}`} fill="#FCBF09" />;
    })}
    <circle cx="100" cy="100" r="45" fill="#FCBF09" />
  </svg>
);

export default function Home() {
  const [view, setView] = useState<"menu" | "game">("menu");
  const [lang, setLang] = useState<"KU" | "NL">("NL");
  const [mode, setMode] = useState<"bot" | "online">("bot");
  const [mobileTab, setMobileTab] = useState<"board" | "chat">("board");

  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [botHand, setBotHand] = useState<Tile[]>([]);
  const [pile, setPile] = useState<Tile[]>([]);
  const [turn, setTurn] = useState<"player" | "opponent">("player");
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [myTurn, setMyTurn] = useState(true);

  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [playerName, setPlayerName] = useState("Speler");
  const [opponentName, setOpponentName] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMsg, setCurrentMsg] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const emojis = ["🔥","👏","😂","👋","😍","😎","🤖","💯","😡","🥳","😭","🤣","💀","🫡","🎉","❤️","👑","🐐","😈","🤡","💪","🙏","😤","🥶","☀️","🎲"];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const addSysMsg = useCallback((text: string) => {
    const msg = { sender: "⚙️", text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages(p => [...p, msg]);
    setMobileTab(prev => { if (prev !== "chat") setUnreadChat(c => c + 1); return prev; });
  }, []);

  // Start bot game
  const startBotGame = () => {
    const all = shuffle(allTiles());
    setPlayerHand(all.slice(0, 7)); setBotHand(all.slice(7, 14)); setPile(all.slice(14));
    setBoard([]); setTurn("player"); setMyTurn(true); setGameOver(null);
    setMode("bot"); setView("game"); setRoomCode("BOT"); setMessages([]); setMobileTab("board");
    setTimeout(() => addSysMsg("🤖 Bot game gestart! Jij begint."), 100);
  };

  // Kamer maken (offline mode - werkt altijd)
  const handleCreateRoom = () => {
    const code = genCode();
    setRoomCode(code);
    const all = shuffle(allTiles());
    setPlayerHand(all.slice(0, 7)); setBotHand([]); setPile(all.slice(14));
    setBoard([]); setTurn("player"); setMyTurn(true); setGameOver(null);
    setMode("online"); setView("game"); setWaiting(true); setMessages([]); setMobileTab("board");
    setTimeout(() => addSysMsg(`☀️ Kamer ${code} aangemaakt! Stuur code naar je vriend.`), 100);
  };

  // Join room
  const handleJoinRoom = () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    setRoomCode(code);
    const all = shuffle(allTiles());
    setPlayerHand(all.slice(0, 7)); setBotHand(all.slice(7, 14)); setPile(all.slice(14));
    setBoard([]); setTurn("player"); setMyTurn(true); setGameOver(null);
    setMode("bot"); setView("game"); setWaiting(false); setMessages([]); setMobileTab("board");
    setTimeout(() => addSysMsg(`🎮 Gejoind in kamer ${code}! (Offline mode - bot speelt mee)`), 100);
  };

  const copyCode = () => { navigator.clipboard.writeText(roomCode).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // Bot logic
  const botPlayTile = (tile: Tile, index: number) => {
    if (turn !== "player" || gameOver) return;
    const ends = getEnds(board);
    const side = canPlay(tile, board, ends);
    if (!side && board.length > 0) { addSysMsg("❌ Past niet!"); return; }
    let flipped = false;
    if (board.length > 0) { if (side === "left") flipped = tile[1] !== ends[0]; else flipped = tile[0] !== ends[1]; }
    const entry: BoardEntry = { tile, flipped };
    const newBoard = side === "left" ? [entry, ...board] : [...board, entry];
    const newHand = playerHand.filter((_, i) => i !== index);
    setBoard(newBoard); setPlayerHand(newHand);
    if (newHand.length === 0) { setGameOver("🎉 JIJ WINT!"); addSysMsg("🎉 Gefeliciteerd!"); return; }
    setTurn("opponent"); setMyTurn(false);
    setTimeout(() => doBotMove(newBoard), 800);
  };

  const doBotMove = (currentBoard: BoardEntry[]) => {
    setBotHand(prevBot => {
      const ends = getEnds(currentBoard);
      let playIdx = -1, playSide: "left" | "right" | null = null;
      for (let i = 0; i < prevBot.length; i++) { const s = canPlay(prevBot[i], currentBoard, ends); if (s) { playIdx = i; playSide = s; break; } }
      if (playIdx === -1) {
        setPile(pp => {
          if (!pp.length) { addSysMsg("🤖 Bot past."); setTurn("player"); setMyTurn(true); return pp; }
          const np = [...pp]; const drawn = np.pop()!;
          addSysMsg("🤖 Bot pakte uit de pot.");
          setBotHand(bh => [...bh, drawn]); setTurn("player"); setMyTurn(true); return np;
        });
        return prevBot;
      }
      const bt = prevBot[playIdx];
      let flipped = false;
      if (currentBoard.length > 0) { if (playSide === "left") flipped = bt[1] !== ends[0]; else flipped = bt[0] !== ends[1]; }
      const entry: BoardEntry = { tile: bt, flipped };
      const newBoard = playSide === "left" ? [entry, ...currentBoard] : [...currentBoard, entry];
      setBoard(newBoard); addSysMsg(`🤖 Bot: [${bt[0]}|${bt[1]}]`);
      const nbh = prevBot.filter((_, i) => i !== playIdx);
      if (!nbh.length) { setGameOver("💀 BOT WINT!"); addSysMsg("💀 Bot heeft gewonnen!"); }
      setTurn("player"); setMyTurn(true); return nbh;
    });
  };

  const handleDraw = () => {
    if (turn !== "player" || gameOver) return;
    if (!pile.length) { addSysMsg("Pot is leeg!"); return; }
    const np = [...pile]; const drawn = np.pop()!;
    setPile(np); setPlayerHand(p => [...p, drawn]);
    addSysMsg(`📦 [${drawn[0]}|${drawn[1]}] gepakt`);
  };

  const handlePass = () => {
    if (turn !== "player" || gameOver) return;
    setTurn("opponent"); setMyTurn(false); addSysMsg("⏭️ Gepast.");
    setTimeout(() => doBotMove(board), 800);
  };

  const handleSendChat = (text: string) => {
    const t = text.trim(); if (!t) return;
    setMessages(p => [...p, { sender: playerName, text: t, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setCurrentMsg(""); setShowEmojis(false);
    if (mode === "bot") {
      setTimeout(() => {
        const r = ["Haha 😂","Oke 👍","Ik ga winnen 😈","Nice! 🔥","GG 💯","🤖💪","Biji Kurdistan! ☀️","👏"];
        setMessages(p => [...p, { sender: "🤖 Bot", text: r[Math.floor(Math.random() * r.length)], time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      }, 1000 + Math.random() * 1500);
    }
  };

  const canPlayerPlayAny = (): boolean => {
    if (!board.length) return true;
    const ends = getEnds(board);
    return playerHand.some(t => canPlay(t, board, ends) !== null);
  };

  // Domino components
  const DominoTile = ({ value, highlight, small }: { value: Tile; highlight?: boolean; small?: boolean }) => {
    const dots: number[][] = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    const w = small ? "w-8" : "w-10 sm:w-12";
    const h = small ? "h-16" : "h-20 sm:h-24";
    const dotSize = small ? "w-1 h-1" : "w-1.5 h-1.5 sm:w-2 sm:h-2";
    const gridSize = small ? "w-5 h-5" : "w-6 h-6 sm:w-7 sm:h-7";
    return (
      <div className={`${w} ${h} bg-white rounded-lg border-2 flex flex-col items-center justify-around py-0.5 shadow-lg m-0.5 transition-all duration-200 active:scale-95 sm:hover:scale-110 cursor-pointer select-none ${highlight ? "border-yellow-400 ring-2 ring-yellow-400 shadow-yellow-400/50" : "border-gray-300"}`}>
        {[0, 1].map(side => (
          <div key={side} className={`grid grid-cols-3 gap-0.5 ${gridSize}`}>
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`${dotSize} rounded-full ${dots[value[side]].includes(i) ? "bg-black" : "bg-transparent"}`} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const BoardTile = ({ value, flipped }: { value: Tile; flipped: boolean }) => {
    const display: Tile = flipped ? [value[1], value[0]] : value;
    const dots: number[][] = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    return (
      <div className="w-12 h-6 sm:w-16 sm:h-8 bg-white rounded-md border-2 border-gray-500 flex flex-row items-center justify-around px-0.5 shadow-md mx-0.5 my-0.5">
        {[0, 1].map(side => (
          <div key={side} className="grid grid-cols-3 gap-px w-4 h-4 sm:w-5 sm:h-5">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full ${dots[display[side]].includes(i) ? "bg-black" : "bg-transparent"}`} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Chat component
  const ChatBox = ({ fullHeight = false }: { fullHeight?: boolean }) => (
    <div className={`flex flex-col ${fullHeight ? "h-full" : "h-full"}`}>
      <div className="flex-1 overflow-y-auto mb-2 space-y-1 min-h-0 px-1">
        {messages.length === 0 && (
          <div className="text-white/30 text-xs text-center mt-8">Nog geen berichten...</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`p-2 rounded-xl text-xs ${
            m.sender === "⚙️" ? "bg-blue-500/20 text-blue-300 italic" :
            m.sender === "🤖 Bot" ? "bg-red-500/20 text-red-300" :
            "bg-white/10 text-white"
          }`}>
            <div className="flex justify-between items-center">
              <span className="font-bold text-yellow-400 text-[11px]">{m.sender}</span>
              <span className="text-white/20 text-[9px]">{m.time}</span>
            </div>
            <div className="mt-0.5 break-words">{m.text}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {showEmojis && (
        <div className="grid grid-cols-8 sm:grid-cols-7 gap-1 mb-2 bg-black/60 p-2 rounded-xl max-h-24 overflow-y-auto border border-white/10">
          {emojis.map(e => (
            <button key={e} onClick={() => setCurrentMsg(p => p + e)} className="hover:bg-white/20 rounded p-1 text-base sm:text-sm active:scale-125 transition-transform">{e}</button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <button onClick={() => setShowEmojis(!showEmojis)} className={`px-2.5 py-2 rounded-xl text-base transition-colors ${showEmojis ? "bg-yellow-500 text-black" : "bg-white/10 active:bg-white/20"}`}>😊</button>
        <input
          value={currentMsg}
          onChange={e => setCurrentMsg(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSendChat(currentMsg); }}
          className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-yellow-500 placeholder-white/30"
          placeholder={lang === "KU" ? "بنووسە..." : "Typ bericht..."}
        />
        <button onClick={() => handleSendChat(currentMsg)} className="bg-green-600 px-3 py-2 rounded-xl text-sm text-white font-bold active:bg-green-500">➤</button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Kurdistan vlag */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" />
        <div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" />
        <div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <KurdistanSun size={view === "menu" ? 300 : 400} className={view === "menu" ? "opacity-40" : "opacity-[0.06]"} />
        </div>
      </div>

      {view === "game" && <div className="fixed inset-0 z-[1] bg-black/70" />}

      {/* Taal */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 flex gap-1.5 z-50">
        <button onClick={() => setLang("KU")} className={`px-2.5 py-1 rounded-full font-bold text-[10px] sm:text-xs ${lang === "KU" ? "bg-yellow-500 text-black" : "bg-black/40 text-white"}`}>KU</button>
        <button onClick={() => setLang("NL")} className={`px-2.5 py-1 rounded-full font-bold text-[10px] sm:text-xs ${lang === "NL" ? "bg-yellow-500 text-black" : "bg-black/40 text-white"}`}>NL</button>
      </div>

      {/* ========== MENU ========== */}
      {view === "menu" ? (
        <div className="flex flex-col items-center z-10 w-full max-w-sm px-6 py-4">
          <div className="relative mb-2">
            <KurdistanSun size={100} className="absolute -top-4 left-1/2 -translate-x-1/2 opacity-80" />
            <h1 className="text-5xl sm:text-7xl font-black text-white italic drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] relative z-10">DOMINO</h1>
          </div>

          <p className="text-white text-xs sm:text-sm mb-5 font-bold bg-black/30 px-4 py-1.5 rounded-full">
            🎲 28 {lang === "KU" ? "تابلۆ" : "stenen"} • 7 {lang === "KU" ? "بۆ هەر یاریزان" : "per speler"}
          </p>

          <input
            type="text"
            placeholder={lang === "KU" ? "☀️ ناوی تۆ..." : "☀️ Je naam..."}
            value={playerName}
            onChange={e => setPlayerName(e.target.value || "Speler")}
            className="w-full p-3 rounded-2xl text-center font-bold text-black bg-white shadow-lg border-2 border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-4 text-sm sm:text-base"
          />

          <button onClick={startBotGame} className="w-full bg-blue-600 text-white font-black py-3.5 sm:py-4 rounded-2xl border-b-[5px] border-blue-900 mb-3 active:translate-y-0.5 active:border-b-[3px] transition-all shadow-xl text-base sm:text-lg">
            🤖 {lang === "KU" ? "یاری دژی بۆت" : "Tegen Bot"}
          </button>

          <button onClick={handleCreateRoom} className="w-full bg-green-600 text-white font-black py-3.5 sm:py-4 rounded-2xl border-b-[5px] border-green-900 mb-3 active:translate-y-0.5 active:border-b-[3px] transition-all shadow-xl text-base sm:text-lg">
            🏠 {lang === "KU" ? "دروستکردنی ژوور" : "Kamer Maken"}
          </button>

          <div className="bg-purple-600 p-4 rounded-2xl border-b-[5px] border-purple-900 w-full shadow-xl">
            <input
              type="text"
              placeholder="CODE..."
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              className="w-full p-3 rounded-xl text-center font-bold mb-2 uppercase text-black bg-white border-2 border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 text-lg tracking-[0.3em]"
              maxLength={5}
            />
            <button onClick={handleJoinRoom} className="w-full text-white font-black py-3 bg-purple-800/60 rounded-xl active:bg-purple-700/60 transition-colors text-sm">
              🚪 {lang === "KU" ? "چوونە ناو ژوور" : "Joinen"}
            </button>
          </div>

          <p className="text-white/40 text-xs mt-5 font-bold">☀️ Biji Kurdistan</p>
        </div>
      ) : (
        /* ========== GAME ========== */
        <div className="w-full h-[100dvh] flex flex-col p-1.5 sm:p-3 max-w-6xl z-10">

          {/* Top bar - compact op mobiel */}
          <div className="flex items-center justify-between mb-1.5 gap-1.5 flex-wrap">
            <button onClick={() => { setView("menu"); setWaiting(false); }} className="bg-black/40 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold active:bg-black/60 border border-white/10">
              ↩
            </button>

            <div className="flex items-center gap-1.5">
              <div className="bg-yellow-500 text-black px-2.5 py-1.5 rounded-xl font-black text-xs shadow-lg">
                {roomCode}
              </div>
              {roomCode !== "BOT" && (
                <button onClick={copyCode} className="bg-black/40 text-white px-2 py-1.5 rounded-xl text-[10px] font-bold active:bg-black/60 border border-white/10">
                  {copied ? "✅" : "📋"}
                </button>
              )}
            </div>

            <div className={`px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black ${myTurn ? "bg-green-500 text-black" : "bg-red-500/80 text-white"}`}>
              {myTurn ? "🟢" : "🔴"} {myTurn ? (lang === "KU" ? "نۆبەی تۆ" : "Jouw beurt") : "Bot..."}
            </div>

            {/* Stats */}
            <div className="flex gap-2 text-white text-[10px] sm:text-xs bg-black/30 px-2 py-1.5 rounded-xl border border-white/10">
              <span>🎴{playerHand.length}</span>
              <span>🤖{botHand.length}</span>
              <span>📦{pile.length}</span>
            </div>
          </div>

          {/* Waiting banner */}
          {waiting && (
            <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-black text-center py-2.5 rounded-2xl mb-1.5 text-xs sm:text-sm shadow-lg">
              ⏳ {lang === "KU" ? "کۆدەکە بنێرە!" : "Stuur code naar vriend!"}{" "}
              <span className="bg-black text-white px-2 py-0.5 rounded-lg font-mono ml-1">{roomCode}</span>
              <button onClick={copyCode} className="ml-1.5 bg-white/80 text-black px-2 py-0.5 rounded text-[10px] font-bold">{copied ? "✅" : "📋"}</button>
            </div>
          )}

          {/* Game over */}
          {gameOver && (
            <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-black font-black text-center py-3 rounded-2xl mb-1.5 text-lg shadow-2xl">
              {gameOver}
              <button onClick={startBotGame} className="ml-3 bg-black text-white px-4 py-1.5 rounded-xl text-xs font-bold">🔄</button>
            </div>
          )}

          {/* === MOBIEL: Tabs voor Board/Chat === */}
          <div className="flex gap-1 mb-1.5 sm:hidden">
            <button
              onClick={() => { setMobileTab("board"); }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${mobileTab === "board" ? "bg-yellow-500 text-black" : "bg-black/30 text-white/60"}`}
            >
              🎮 {lang === "KU" ? "یاری" : "Spel"}
            </button>
            <button
              onClick={() => { setMobileTab("chat"); setUnreadChat(0); }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all relative ${mobileTab === "chat" ? "bg-yellow-500 text-black" : "bg-black/30 text-white/60"}`}
            >
              💬 {lang === "KU" ? "چات" : "Chat"}
              {unreadChat > 0 && mobileTab !== "chat" && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold animate-bounce">
                  {unreadChat}
                </span>
              )}
            </button>
          </div>

          {/* Main area */}
          <div className="flex gap-2 flex-1 min-h-0">

            {/* Board - hidden op mobiel als chat open is */}
            <div className={`flex-1 rounded-[20px] bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center p-2 overflow-auto relative border-2 border-yellow-500/20 ${mobileTab === "chat" ? "hidden sm:flex" : "flex"}`}>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <KurdistanSun size={150} className="opacity-[0.03]" />
              </div>
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 via-white to-green-500 rounded-t-[18px]" />

              {board.length === 0 ? (
                <div className="text-white/40 text-sm text-center">
                  <div className="text-3xl mb-2">☀️</div>
                  <span className="font-bold">{lang === "KU" ? "یەکەم تابلۆ دابنێ!" : "Speel je eerste tegel!"}</span>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center items-center gap-0.5 p-1">
                  {board.map((b, i) => <BoardTile key={i} value={b.tile} flipped={b.flipped} />)}
                </div>
              )}
            </div>

            {/* Chat - desktop altijd zichtbaar, mobiel alleen als tab actief */}
            <div className={`w-full sm:w-56 md:w-64 bg-black/40 backdrop-blur-sm rounded-[20px] flex flex-col p-3 border border-yellow-500/20 ${mobileTab === "board" ? "hidden sm:flex" : "flex"}`}>
              <div className="text-white font-bold text-xs mb-2 text-center bg-yellow-500/20 rounded-lg py-1 hidden sm:block">
                💬 {lang === "KU" ? "چات" : "Chat"}
              </div>
              <ChatBox fullHeight />
            </div>
          </div>

          {/* Hand + acties */}
          <div className="bg-black/40 backdrop-blur-sm p-2.5 sm:p-3 rounded-[20px] border-t-4 border-yellow-500 mt-1.5">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-white text-[10px] sm:text-xs font-bold">
                🎴 {lang === "KU" ? "تابلۆکانت" : "Stenen"} ({playerHand.length})
              </span>
              <div className="flex gap-1.5 items-center">
                {!canPlayerPlayAny() && myTurn && !gameOver && pile.length > 0 && (
                  <span className="text-red-400 text-[10px] animate-pulse font-bold">⚠️</span>
                )}
                <button
                  onClick={handleDraw}
                  disabled={turn !== "player" || !!gameOver || pile.length === 0}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold active:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                >
                  📦 {lang === "KU" ? "هەڵگرتن" : "Pak"} ({pile.length})
                </button>
                {!canPlayerPlayAny() && myTurn && !gameOver && pile.length === 0 && (
                  <button onClick={handlePass} className="bg-orange-600 text-white px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold active:bg-orange-500 shadow-lg">
                    ⏭️ {lang === "KU" ? "تێپەڕ" : "Pas"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-center gap-0.5 overflow-x-auto pb-1 scrollbar-none">
              {playerHand.map((t, i) => {
                const ends = getEnds(board);
                const playable = !board.length || canPlay(t, board, ends) !== null;
                return (
                  <div
                    key={i}
                    onClick={() => botPlayTile(t, i)}
                    className={`transition-all duration-200 flex-shrink-0 ${
                      turn !== "player" || gameOver
                        ? "opacity-30 pointer-events-none"
                        : playable
                        ? "active:scale-95 sm:hover:-translate-y-3"
                        : "opacity-40"
                    }`}
                  >
                    <DominoTile value={t} highlight={playable && turn === "player" && !gameOver} small={playerHand.length > 5} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}