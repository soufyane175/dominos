"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ✅ VERVANG DIT MET JE RENDER URL!
const SOCKET_URL = "https://domino-server-xxxx.onrender.com";

type Tile = [number, number];
type Message = { sender: string; text: string; time: string };
type BoardEntry = { tile: Tile; flipped: boolean };

function allTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) tiles.push([i, j]);
  }
  return tiles;
}

function shuffle(arr: Tile[]): Tile[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getEnds(board: BoardEntry[]): [number, number] {
  if (board.length === 0) return [-1, -1];
  const f = board[0];
  const l = board[board.length - 1];
  return [f.flipped ? f.tile[1] : f.tile[0], l.flipped ? l.tile[0] : l.tile[1]];
}

function canPlay(tile: Tile, board: BoardEntry[], ends: [number, number]): "left" | "right" | null {
  if (board.length === 0) return "right";
  const [le, re] = ends;
  if (tile[0] === le || tile[1] === le) return "left";
  if (tile[0] === re || tile[1] === re) return "right";
  return null;
}

const KurdistanSun = ({ size = 200, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
    {[...Array(21)].map((_, i) => {
      const angle = (i * 360) / 21 - 90;
      const rad = (angle * Math.PI) / 180;
      const x2 = 100 + Math.cos(rad) * 90;
      const y2 = 100 + Math.sin(rad) * 90;
      const lRad = ((angle - 8) * Math.PI) / 180;
      const rRad = ((angle + 8) * Math.PI) / 180;
      const lx = 100 + Math.cos(lRad) * 45;
      const ly = 100 + Math.sin(lRad) * 45;
      const rx = 100 + Math.cos(rRad) * 45;
      const ry = 100 + Math.sin(rRad) * 45;
      return <polygon key={i} points={`${lx},${ly} ${x2},${y2} ${rx},${ry}`} fill="#FCBF09" />;
    })}
    <circle cx="100" cy="100" r="45" fill="#FCBF09" />
  </svg>
);

export default function Home() {
  const [view, setView] = useState<"menu" | "game">("menu");
  const [lang, setLang] = useState<"KU" | "NL">("KU");
  const [mode, setMode] = useState<"bot" | "online">("bot");

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
  const [opponentHandCount, setOpponentHandCount] = useState(7);
  const [pileCount, setPileCount] = useState(14);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [serverStatus, setServerStatus] = useState<"connecting" | "connected" | "error">("connecting");

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMsg, setCurrentMsg] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const emojis = [
    "🔥","👏","😂","👋","😍","😎","🤖","💯",
    "😡","🥳","😭","🤣","💀","🫡","🎉","❤️",
    "👑","🐐","😈","🤡","💪","🙏","😤","🥶",
    "☀️","🇹🇯","🎲","🃏",
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addSysMsg = useCallback((text: string) => {
    setMessages((p) => [
      ...p,
      { sender: "⚙️", text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    ]);
  }, []);

  // Socket connectie
  useEffect(() => {
    setServerStatus("connecting");

    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 15000,
    });

    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      setServerStatus("connected");
      console.log("✅ Verbonden met server:", s.id);
    });

    s.on("connect_error", (err) => {
      console.error("❌ Verbindingsfout:", err.message);
      setServerStatus("error");
      setConnected(false);
    });

    s.on("disconnect", () => {
      setConnected(false);
      setServerStatus("connecting");
    });

    s.on("roomCreated", ({ code, hand, playerIndex: pi }: any) => {
      setRoomCode(code);
      setPlayerHand(hand);
      setPlayerIndex(pi);
      setWaiting(true);
      setView("game");
      setMode("online");
      setBoard([]);
      setGameOver(null);
      setMessages([]);
      addSysMsg(`☀️ Kamer ${code} aangemaakt! Stuur deze code naar je vriend!`);
    });

    s.on("roomJoined", ({ code, hand, playerIndex: pi, board: b, turn: t, opponentName: on, opponentHandCount: ohc, pileCount: pc }: any) => {
      setRoomCode(code);
      setPlayerHand(hand);
      setPlayerIndex(pi);
      setBoard(b);
      setMyTurn(t === pi);
      setOpponentName(on);
      setOpponentHandCount(ohc);
      setPileCount(pc);
      setWaiting(false);
      setView("game");
      setMode("online");
      setGameOver(null);
      setMessages([]);
      addSysMsg(`☀️ Je speelt tegen ${on}! Veel succes!`);
      setJoinError("");
    });

    s.on("joinError", (msg: string) => setJoinError(msg));

    s.on("opponentJoined", ({ opponentName: on, turn: t }: any) => {
      setOpponentName(on);
      setWaiting(false);
      setMyTurn(t === 0);
      addSysMsg(`🎉 ${on} is gejoind! Het spel begint!`);
    });

    s.on("gameUpdate", ({ board: b, hand, turn: t, pileCount: pc, opponentHandCount: ohc, lastPlay, winner, drewTile, opponentDrew, passed }: any) => {
      setBoard(b);
      setPlayerHand(hand);
      setPileCount(pc);
      setOpponentHandCount(ohc);
      setPlayerIndex((currentPI) => {
        setMyTurn(t === currentPI);
        return currentPI;
      });
      if (lastPlay) addSysMsg(`🎯 ${lastPlay.playerName} speelde [${lastPlay.tile[0]}|${lastPlay.tile[1]}]`);
      if (drewTile) addSysMsg(`📦 Je pakte [${drewTile[0]}|${drewTile[1]}]`);
      if (opponentDrew) addSysMsg(`📦 ${opponentName || "Tegenstander"} pakte uit de pot`);
      if (passed) addSysMsg(`⏭️ ${passed.name} heeft gepast`);
      if (winner) {
        setPlayerIndex((currentPI) => {
          setGameOver(winner.index === currentPI ? "🎉 JIJ WINT!" : `💀 ${winner.name} WINT!`);
          return currentPI;
        });
      }
    });

    s.on("gameRestarted", ({ hand, board: b, turn: t, pileCount: pc, opponentHandCount: ohc }: any) => {
      setPlayerHand(hand);
      setBoard(b);
      setPileCount(pc);
      setOpponentHandCount(ohc);
      setGameOver(null);
      setPlayerIndex((currentPI) => {
        setMyTurn(t === currentPI);
        return currentPI;
      });
      addSysMsg("🔄 Nieuw spel gestart!");
    });

    s.on("chatMessage", (msg: Message) => setMessages((p) => [...p, msg]));

    s.on("opponentLeft", () => {
      addSysMsg("❌ Tegenstander heeft het spel verlaten!");
      setGameOver("❌ Tegenstander weg");
    });

    s.on("playError", (msg: string) => addSysMsg(`❌ ${msg}`));
    s.on("drawError", (msg: string) => addSysMsg(`❌ ${msg}`));

    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, [addSysMsg, opponentName]);

  // Online handlers
  const handleCreateRoom = () => {
    if (!connected) { setJoinError("Niet verbonden met server! Wacht even..."); return; }
    socketRef.current?.emit("createRoom", { playerName });
  };

  const handleJoinRoom = () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) { setJoinError("Vul een code in!"); return; }
    if (!connected) { setJoinError("Niet verbonden met server! Wacht even..."); return; }
    setJoinError("");
    socketRef.current?.emit("joinRoom", { code, playerName });
  };

  const onlinePlayTile = (index: number) => {
    if (!myTurn || gameOver) return;
    socketRef.current?.emit("playTile", { tileIndex: index });
  };
  const onlineDrawTile = () => {
    if (!myTurn || gameOver) return;
    socketRef.current?.emit("drawTile");
  };
  const onlinePass = () => {
    if (!myTurn || gameOver) return;
    socketRef.current?.emit("passTurn");
  };
  const onlineRestart = () => {
    socketRef.current?.emit("requestRestart");
  };
  const onlineSendChat = (text: string) => {
    const t = text.trim();
    if (!t) return;
    socketRef.current?.emit("sendMessage", { text: t });
    setCurrentMsg("");
    setShowEmojis(false);
  };

  // Bot handlers
  const startBotGame = () => {
    const all = shuffle(allTiles());
    setPlayerHand(all.slice(0, 7));
    setBotHand(all.slice(7, 14));
    setPile(all.slice(14));
    setBoard([]);
    setTurn("player");
    setMyTurn(true);
    setGameOver(null);
    setMode("bot");
    setView("game");
    setRoomCode("BOT");
    setMessages([]);
    addSysMsg("🤖 Bot game gestart! Jij begint.");
  };

  const botPlayTile = (tile: Tile, index: number) => {
    if (turn !== "player" || gameOver) return;
    const ends = getEnds(board);
    const side = canPlay(tile, board, ends);
    if (!side && board.length > 0) { addSysMsg("❌ Past niet!"); return; }
    let flipped = false;
    if (board.length > 0) {
      if (side === "left") flipped = tile[1] !== ends[0];
      else flipped = tile[0] !== ends[1];
    }
    const entry: BoardEntry = { tile, flipped };
    const newBoard = side === "left" ? [entry, ...board] : [...board, entry];
    const newHand = playerHand.filter((_, i) => i !== index);
    setBoard(newBoard);
    setPlayerHand(newHand);
    if (newHand.length === 0) { setGameOver("🎉 JIJ WINT!"); addSysMsg("🎉 Gefeliciteerd!"); return; }
    setTurn("opponent");
    setMyTurn(false);
    setTimeout(() => doBotMove(newBoard), 800);
  };

  const doBotMove = (currentBoard: BoardEntry[]) => {
    setBotHand((prevBot) => {
      const ends = getEnds(currentBoard);
      let playIdx = -1;
      let playSide: "left" | "right" | null = null;
      for (let i = 0; i < prevBot.length; i++) {
        const s = canPlay(prevBot[i], currentBoard, ends);
        if (s) { playIdx = i; playSide = s; break; }
      }
      if (playIdx === -1) {
        setPile((pp) => {
          if (pp.length === 0) { addSysMsg("🤖 Bot past."); setTurn("player"); setMyTurn(true); return pp; }
          const np = [...pp];
          const drawn = np.pop()!;
          addSysMsg("🤖 Bot pakte uit de pot.");
          setBotHand((bh) => [...bh, drawn]);
          setTurn("player");
          setMyTurn(true);
          return np;
        });
        return prevBot;
      }
      const botTile = prevBot[playIdx];
      let flipped = false;
      if (currentBoard.length > 0) {
        if (playSide === "left") flipped = botTile[1] !== ends[0];
        else flipped = botTile[0] !== ends[1];
      }
      const entry: BoardEntry = { tile: botTile, flipped };
      const newBoard = playSide === "left" ? [entry, ...currentBoard] : [...currentBoard, entry];
      setBoard(newBoard);
      addSysMsg(`🤖 Bot: [${botTile[0]}|${botTile[1]}]`);
      const newBotHand = prevBot.filter((_, i) => i !== playIdx);
      if (newBotHand.length === 0) { setGameOver("💀 BOT WINT!"); addSysMsg("💀 Bot heeft gewonnen!"); }
      setTurn("player");
      setMyTurn(true);
      return newBotHand;
    });
  };

  const botDrawFromPile = () => {
    if (turn !== "player" || gameOver) return;
    if (pile.length === 0) { addSysMsg("Pot is leeg!"); return; }
    const np = [...pile];
    const drawn = np.pop()!;
    setPile(np);
    setPlayerHand((p) => [...p, drawn]);
    addSysMsg(`📦 [${drawn[0]}|${drawn[1]}] gepakt`);
  };

  const botSendChat = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((p) => [...p, { sender: playerName, text: t, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setCurrentMsg("");
    setShowEmojis(false);
    setTimeout(() => {
      const replies = ["Haha 😂", "Oke 👍", "Ik ga winnen 😈", "Nice! 🔥", "GG 💯", "🤖💪", "Biji Kurdistan! ☀️", "Goed gespeeld! 👏"];
      setMessages((p) => [...p, { sender: "🤖 Bot", text: replies[Math.floor(Math.random() * replies.length)], time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    }, 1000 + Math.random() * 1500);
  };

  // Unified
  const handlePlay = (tile: Tile, index: number) => { if (mode === "bot") botPlayTile(tile, index); else onlinePlayTile(index); };
  const handleDraw = () => { if (mode === "bot") botDrawFromPile(); else onlineDrawTile(); };
  const handlePass = () => {
    if (mode === "bot") { setTurn("opponent"); setMyTurn(false); addSysMsg("⏭️ Gepast."); setTimeout(() => doBotMove(board), 800); }
    else onlinePass();
  };
  const handleSendChat = (text: string) => { if (mode === "bot") botSendChat(text); else onlineSendChat(text); };
  const handleRestart = () => { if (mode === "bot") startBotGame(); else onlineRestart(); };
  const copyCode = () => { navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const canPlayerPlayAny = (): boolean => {
    if (board.length === 0) return true;
    const ends = getEnds(board);
    return playerHand.some((t) => canPlay(t, board, ends) !== null);
  };

  // Components
  const DominoTile = ({ value, highlight }: { value: Tile; highlight?: boolean }) => {
    const dots: number[][] = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    return (
      <div className={`w-10 h-20 bg-white rounded-lg border-2 flex flex-col items-center justify-around py-1 shadow-md m-0.5 transition-all duration-200 hover:scale-110 cursor-pointer select-none ${highlight ? "border-yellow-400 ring-2 ring-yellow-400 shadow-yellow-400/50 shadow-lg" : "border-gray-400"}`}>
        {[0, 1].map((side) => (
          <div key={side} className="grid grid-cols-3 gap-0.5 w-6 h-6">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${dots[value[side]].includes(i) ? "bg-black" : "bg-transparent"}`} />
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
      <div className="w-16 h-8 bg-white rounded-md border-2 border-gray-500 flex flex-row items-center justify-around px-1 shadow-md mx-0.5">
        {[0, 1].map((side) => (
          <div key={side} className="grid grid-cols-3 gap-0.5 w-5 h-5">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`w-1 h-1 rounded-full ${dots[display[side]].includes(i) ? "bg-black" : "bg-transparent"}`} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Kurdistan vlag achtergrond */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" />
        <div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" />
        <div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <KurdistanSun size={view === "menu" ? 350 : 500} className={view === "menu" ? "opacity-50" : "opacity-10"} />
        </div>
      </div>

      {view === "game" && <div className="fixed inset-0 z-[1] bg-black/65" />}

      {/* Taal + status */}
      <div className="absolute top-4 right-4 flex gap-2 z-50 items-center">
        <div className={`flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${serverStatus === "connected" ? "bg-green-400" : serverStatus === "error" ? "bg-red-500" : "bg-yellow-400"}`} />
          <span className="text-white/60 text-[10px]">
            {serverStatus === "connected" ? "Online" : serverStatus === "error" ? "Offline" : "..."}
          </span>
        </div>
        <button onClick={() => setLang("KU")} className={`px-3 py-1 rounded-full font-bold text-xs transition-all ${lang === "KU" ? "bg-yellow-500 text-black shadow-lg" : "bg-black/30 text-white backdrop-blur-sm"}`}>KU</button>
        <button onClick={() => setLang("NL")} className={`px-3 py-1 rounded-full font-bold text-xs transition-all ${lang === "NL" ? "bg-yellow-500 text-black shadow-lg" : "bg-black/30 text-white backdrop-blur-sm"}`}>NL</button>
      </div>

      {view === "menu" ? (
        <div className="flex flex-col items-center z-10 w-full max-w-sm p-4">
          <div className="relative mb-4">
            <KurdistanSun size={120} className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-90" />
            <h1 className="text-7xl font-black text-white italic drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] relative z-10 tracking-tight">DOMINO</h1>
          </div>

          <p className="text-white/90 text-sm mb-6 font-bold bg-black/30 px-4 py-1.5 rounded-full backdrop-blur-sm">
            🎲 28 {lang === "KU" ? "تابلۆ" : "stenen"} • 7 {lang === "KU" ? "بۆ هەر یاریزان" : "per speler"}
          </p>

          <div className="w-full mb-4">
            <label className="text-white/80 text-xs font-bold mb-1 block">{lang === "KU" ? "☀️ ناوی تۆ" : "☀️ Je naam"}</label>
            <input type="text" placeholder={lang === "KU" ? "ناوی تۆ..." : "Je naam..."} value={playerName} onChange={(e) => setPlayerName(e.target.value || "Speler")} className="w-full p-3 rounded-xl text-center font-bold text-black bg-white/90 backdrop-blur-sm shadow-lg border-2 border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
          </div>

          <button onClick={startBotGame} className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black py-4 rounded-2xl border-b-[6px] border-blue-900 mb-3 active:translate-y-1 hover:from-blue-500 hover:to-blue-600 transition-all shadow-xl text-lg">
            🤖 {lang === "KU" ? "یاری دژی بۆت" : "Tegen Bot"}
          </button>

          <button onClick={handleCreateRoom} className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-black py-4 rounded-2xl border-b-[6px] border-green-900 mb-3 active:translate-y-1 hover:from-green-500 hover:to-green-600 transition-all shadow-xl text-lg">
            🏠 {lang === "KU" ? "دروستکردنی ژوور" : "Kamer Maken"}
          </button>

          <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-4 rounded-2xl border-b-[6px] border-purple-900 w-full shadow-xl">
            <input type="text" placeholder="CODE..." value={inputCode} onChange={(e) => setInputCode(e.target.value.toUpperCase())} className="w-full p-3 rounded-xl text-center font-bold mb-2 uppercase text-black bg-white/90 border-2 border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400" maxLength={5} />
            {joinError && <p className="text-red-200 text-xs text-center mb-2 font-bold bg-red-900/30 rounded-lg py-1">⚠️ {joinError}</p>}
            <button onClick={handleJoinRoom} className="w-full text-white font-black text-sm py-3 bg-purple-900/50 rounded-xl hover:bg-purple-800/50 transition-colors">
              🚪 {lang === "KU" ? "چوونە ناو ژوور" : "Joinen"}
            </button>
          </div>

          <p className="text-white/40 text-xs mt-6 font-bold">☀️ Biji Kurdistan</p>
        </div>
      ) : (
        <div className="w-full h-screen flex flex-col p-2 md:p-4 max-w-6xl z-10">
          {/* Top */}
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <button onClick={() => { setView("menu"); setWaiting(false); }} className="bg-black/40 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm hover:bg-black/60 font-bold border border-white/10">
              ↩ {lang === "KU" ? "گەڕانەوە" : "Menu"}
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-4 py-2 rounded-xl font-black text-sm shadow-lg">🏠 {roomCode}</div>
              {roomCode !== "BOT" && (
                <button onClick={copyCode} className="bg-black/40 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-xs hover:bg-black/60 border border-white/10 font-bold">
                  {copied ? "✅ Gekopieerd!" : "📋 Kopieer code"}
                </button>
              )}
              <div className={`px-3 py-2 rounded-xl text-xs font-black shadow-lg ${myTurn ? "bg-green-500 text-black animate-pulse" : "bg-red-500/80 text-white"}`}>
                {myTurn ? `🟢 ${lang === "KU" ? "نۆبەی تۆ" : "Jouw beurt"}` : `🔴 ${mode === "bot" ? "Bot" : opponentName || "..."}`}
              </div>
            </div>
            <div className="flex gap-3 text-white text-xs bg-black/30 backdrop-blur-sm px-3 py-2 rounded-xl border border-white/10">
              <span>🎴 {playerHand.length}</span>
              <span className="text-white/30">|</span>
              {mode === "bot" ? <span>🤖 {botHand.length}</span> : <span>👤 {opponentHandCount}</span>}
              <span className="text-white/30">|</span>
              <span>📦 {mode === "bot" ? pile.length : pileCount}</span>
            </div>
          </div>

          {waiting && (
            <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-black text-center py-3 rounded-2xl mb-2 animate-pulse shadow-lg text-sm md:text-base">
              ⏳ {lang === "KU" ? "کۆدەکە بنێرە بۆ هاوڕێکەت!" : "Stuur de code naar je vriend!"}{" "}
              <span className="bg-black text-white px-3 py-1 rounded-lg ml-2 font-mono text-lg">{roomCode}</span>
              <button onClick={copyCode} className="ml-2 bg-white text-black px-3 py-1 rounded-lg text-xs font-bold hover:bg-gray-200">{copied ? "✅" : "📋"}</button>
            </div>
          )}

          {gameOver && (
            <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-black font-black text-center py-4 rounded-2xl mb-2 text-xl shadow-2xl">
              {gameOver}
              <button onClick={handleRestart} className="ml-4 bg-black text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-gray-800">🔄 {lang === "KU" ? "دووبارە" : "Opnieuw"}</button>
            </div>
          )}

          <div className="flex gap-2 flex-1 min-h-0">
            {/* Speelveld */}
            <div className="flex-1 rounded-[20px] bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center p-2 overflow-auto relative border-2 border-yellow-500/30">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <KurdistanSun size={180} className="opacity-[0.03]" />
              </div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-white to-green-500 rounded-t-[18px]" />

              {board.length === 0 ? (
                <div className="text-white/50 text-sm text-center relative z-10">
                  <div className="text-4xl mb-2">☀️</div>
                  {waiting
                    ? <span>{lang === "KU" ? "چاوەڕوانی..." : "Wacht op tegenstander..."}</span>
                    : <>
                        <span className="font-bold">{lang === "KU" ? "یەکەم تابلۆ دابنێ!" : "Speel je eerste tegel!"}</span><br />
                        <span className="text-xs text-white/30">{lang === "KU" ? "کلیک لەسەر تابلۆیەک" : "Klik op een tegel"}</span>
                      </>
                  }
                </div>
              ) : (
                <div className="flex flex-wrap justify-center items-center gap-0.5 p-2 relative z-10">
                  {board.map((b, i) => <BoardTile key={i} value={b.tile} flipped={b.flipped} />)}
                </div>
              )}
            </div>

            {/* Chat */}
            <div className="w-56 md:w-64 bg-black/40 backdrop-blur-sm rounded-[20px] flex flex-col p-3 border border-yellow-500/20">
              <div className="text-white font-bold text-xs mb-2 text-center bg-yellow-500/20 rounded-lg py-1">
                💬 {lang === "KU" ? "چات" : "Chat"}
              </div>
              <div className="flex-1 overflow-y-auto mb-2 space-y-1 min-h-0">
                {messages.map((m, i) => (
                  <div key={i} className={`p-2 rounded-lg text-xs ${
                    m.sender === "⚙️" ? "bg-blue-500/20 text-blue-300 italic border-l-2 border-blue-500" :
                    m.sender === "🤖 Bot" ? "bg-red-500/20 text-red-300 border-l-2 border-red-500" :
                    "bg-white/10 text-white border-l-2 border-yellow-500"
                  }`}>
                    <div className="flex justify-between">
                      <span className="font-bold text-yellow-400">{m.sender}</span>
                      <span className="text-white/20 text-[10px]">{m.time}</span>
                    </div>
                    <div className="mt-0.5">{m.text}</div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {showEmojis && (
                <div className="grid grid-cols-7 gap-1 mb-2 bg-black/60 p-2 rounded-lg max-h-28 overflow-y-auto border border-white/10">
                  {emojis.map((e) => (
                    <button key={e} onClick={() => setCurrentMsg((p) => p + e)} className="hover:bg-white/20 rounded p-0.5 text-sm transition-all hover:scale-125">{e}</button>
                  ))}
                </div>
              )}

              <div className="flex gap-1">
                <button onClick={() => setShowEmojis(!showEmojis)} className={`px-2 rounded-lg text-sm transition-colors ${showEmojis ? "bg-yellow-500 text-black" : "bg-white/10 hover:bg-white/20"}`}>😊</button>
                <input value={currentMsg} onChange={(e) => setCurrentMsg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(currentMsg); }} className="flex-1 bg-white/10 rounded-lg p-2 text-xs text-white outline-none focus:ring-1 focus:ring-yellow-500 placeholder-white/30" placeholder={lang === "KU" ? "بنووسە..." : "Typ..."} />
                <button onClick={() => handleSendChat(currentMsg)} className="bg-gradient-to-r from-green-600 to-green-700 px-3 rounded-lg text-xs text-white font-bold hover:from-green-500 hover:to-green-600">➤</button>
              </div>
            </div>
          </div>

          {/* Hand */}
          <div className="bg-black/40 backdrop-blur-sm p-3 rounded-[20px] border-t-4 border-yellow-500 mt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white text-xs font-bold">🎴 {lang === "KU" ? "تابلۆکانت" : "Jouw stenen"} ({playerHand.length})</span>
              <div className="flex gap-2 items-center">
                {!canPlayerPlayAny() && myTurn && !gameOver && (mode === "bot" ? pile.length > 0 : pileCount > 0) && (
                  <span className="text-red-400 text-xs animate-pulse font-bold">⚠️</span>
                )}
                <button onClick={handleDraw} disabled={!myTurn || !!gameOver || (mode === "bot" ? pile.length === 0 : pileCount === 0)} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:from-blue-500 hover:to-blue-600 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg">
                  📦 {lang === "KU" ? "هەڵگرتن" : "Pak"} ({mode === "bot" ? pile.length : pileCount})
                </button>
                {!canPlayerPlayAny() && myTurn && !gameOver && (mode === "bot" ? pile.length === 0 : pileCount === 0) && (
                  <button onClick={handlePass} className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:from-orange-500 hover:to-orange-600 shadow-lg">
                    ⏭️ {lang === "KU" ? "تێپەڕاندن" : "Pas"}
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-center gap-1 overflow-x-auto pb-1">
              {playerHand.map((t, i) => {
                const ends = getEnds(board);
                const playable = board.length === 0 || canPlay(t, board, ends) !== null;
                return (
                  <div key={i} onClick={() => handlePlay(t, i)} className={`transition-all duration-200 ${!myTurn || gameOver ? "opacity-30 pointer-events-none" : playable ? "hover:-translate-y-3 hover:shadow-xl" : "opacity-40"}`}>
                    <DominoTile value={t} highlight={playable && myTurn && !gameOver} />
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