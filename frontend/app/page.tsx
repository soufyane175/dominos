"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ✅ VERVANG MET JE RENDER URL NA DEPLOY
const SOCKET_URL = "https://domino-abc123.onrender.com";

type Tile = [number, number];
type Msg = { sender: string; text: string; time: string };
type BEntry = { tile: Tile; flipped: boolean };

function getEnds(b: BEntry[]): [number, number] {
  if (!b.length) return [-1, -1];
  const f = b[0], l = b[b.length - 1];
  return [f.flipped ? f.tile[1] : f.tile[0], l.flipped ? l.tile[0] : l.tile[1]];
}
function canPlay(t: Tile, b: BEntry[], e: [number, number]): "left" | "right" | null {
  if (!b.length) return "right";
  if (t[0] === e[0] || t[1] === e[0]) return "left";
  if (t[0] === e[1] || t[1] === e[1]) return "right";
  return null;
}
function allTiles(): Tile[] {
  const t: Tile[] = [];
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) t.push([i, j]);
  return t;
}
function shuffle(a: Tile[]): Tile[] {
  const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b;
}

const Sun = ({ s = 200, c = "" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 200 200" className={c}>
    {[...Array(21)].map((_, i) => {
      const a = (i * 360) / 21 - 90, r = (a * Math.PI) / 180;
      const lr = ((a - 8) * Math.PI) / 180, rr = ((a + 8) * Math.PI) / 180;
      return <polygon key={i} points={`${100+Math.cos(lr)*45},${100+Math.sin(lr)*45} ${100+Math.cos(r)*90},${100+Math.sin(r)*90} ${100+Math.cos(rr)*45},${100+Math.sin(rr)*45}`} fill="#FCBF09" />;
    })}
    <circle cx="100" cy="100" r="45" fill="#FCBF09" />
  </svg>
);

export default function Home() {
  const [view, setView] = useState<"menu" | "game">("menu");
  const [lang, setLang] = useState<"KU" | "NL">("NL");
  const [mode, setMode] = useState<"bot" | "online">("bot");
  const [tab, setTab] = useState<"board" | "chat">("board");

  const [board, setBoard] = useState<BEntry[]>([]);
  const [hand, setHand] = useState<Tile[]>([]);
  const [botHand, setBotHand] = useState<Tile[]>([]);
  const [pile, setPile] = useState<Tile[]>([]);
  const [myTurn, setMyTurn] = useState(true);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [pIdx, setPIdx] = useState(0);

  const [room, setRoom] = useState("");
  const [input, setInput] = useState("");
  const [name, setName] = useState("Speler");
  const [oppName, setOppName] = useState("");
  const [oppCount, setOppCount] = useState(7);
  const [pileCount, setPileCount] = useState(14);
  const [waiting, setWaiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"off" | "on" | "err">("off");
  const [joinErr, setJoinErr] = useState("");

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [msg, setMsg] = useState("");
  const [showEm, setShowEm] = useState(false);
  const [unread, setUnread] = useState(0);

  const sock = useRef<Socket | null>(null);
  const btm = useRef<HTMLDivElement>(null);

  const emos = ["🔥","👏","😂","👋","😍","😎","💯","😡","🥳","😭","🤣","💀","🎉","❤️","👑","🐐","😈","💪","🙏","☀️","🎲","👍","😤","🥶"];

  useEffect(() => { btm.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const sysMsg = useCallback((t: string) => {
    setMsgs(p => [...p, { sender: "⚙️", text: t, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; });
  }, []);

  // Socket
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"], reconnection: true, reconnectionAttempts: 15, reconnectionDelay: 2000, timeout: 20000 });
    sock.current = s;

    s.on("connect", () => setStatus("on"));
    s.on("connect_error", () => setStatus("err"));
    s.on("disconnect", () => setStatus("off"));

    s.on("roomCreated", ({ code }: any) => {
      setRoom(code); setWaiting(true); setView("game"); setMode("online");
      setGameOver(null); setMsgs([]); setTab("board");
      sysMsg(`☀️ Kamer ${code} - stuur naar je vriend!`);
    });

    s.on("joinError", (m: string) => setJoinErr(m));

    s.on("gameStarted", ({ p1, p2 }: any) => {
      setWaiting(false);
      sysMsg(`🎮 ${p1} vs ${p2} - Let's go!`);
    });

    s.on("gameState", ({ board: b, hand: h, turn, pileCount: pc, opponentHandCount: ohc, opponentName: on, playerIndex: pi, started, winner }: any) => {
      setBoard(b); setHand(h); setPileCount(pc); setOppCount(ohc);
      setOppName(on); setPIdx(pi); setMyTurn(turn === pi);
      if (started) setWaiting(false);
      if (winner) {
        setGameOver(winner.index === pi ? "🎉 JIJ WINT!" : `💀 ${winner.name} wint!`);
      }
    });

    s.on("tilePlayed", ({ playerName: pn, tile }: any) => {
      sysMsg(`🎯 ${pn}: [${tile[0]}|${tile[1]}]`);
    });

    s.on("playerPassed", ({ name: n }: any) => sysMsg(`⏭️ ${n} past`));
    s.on("chatMsg", (m: Msg) => setMsgs(p => [...p, m]));
    s.on("opponentLeft", () => { sysMsg("❌ Tegenstander weg!"); setGameOver("❌ Tegenstander weg"); });
    s.on("gameRestarted", () => { setGameOver(null); sysMsg("🔄 Nieuw spel!"); });
    s.on("playError", (m: string) => sysMsg(`❌ ${m}`));

    return () => { s.removeAllListeners(); s.disconnect(); };
  }, [sysMsg]);

  // Online
  const create = () => {
    if (status !== "on") { setJoinErr("Niet verbonden! Wacht even..."); return; }
    sock.current?.emit("createRoom", { playerName: name });
  };
  const join = () => {
    const c = input.trim().toUpperCase();
    if (!c) { setJoinErr("Vul code in!"); return; }
    if (status !== "on") { setJoinErr("Niet verbonden!"); return; }
    setJoinErr(""); sock.current?.emit("joinRoom", { code: c, playerName: name });
  };
  const oPlay = (i: number) => { if (!myTurn || gameOver) return; sock.current?.emit("playTile", { tileIndex: i }); };
  const oDraw = () => { if (!myTurn || gameOver) return; sock.current?.emit("drawTile"); };
  const oPass = () => { if (!myTurn || gameOver) return; sock.current?.emit("passTurn"); };
  const oChat = (t: string) => { if (!t.trim()) return; sock.current?.emit("sendChat", { text: t.trim() }); setMsg(""); setShowEm(false); };
  const oRestart = () => sock.current?.emit("restartGame");

  // Bot
  const startBot = () => {
    const a = shuffle(allTiles());
    setHand(a.slice(0, 7)); setBotHand(a.slice(7, 14)); setPile(a.slice(14));
    setBoard([]); setMyTurn(true); setGameOver(null); setMode("bot");
    setView("game"); setRoom("BOT"); setMsgs([]); setTab("board"); setOppName("Bot");
    setTimeout(() => sysMsg("🤖 Bot game! Jij begint."), 100);
  };

  const bPlay = (tile: Tile, idx: number) => {
    if (!myTurn || gameOver) return;
    const ends = getEnds(board);
    const side = canPlay(tile, board, ends);
    if (!side && board.length > 0) { sysMsg("❌ Past niet!"); return; }
    let fl = false;
    if (board.length > 0) { if (side === "left") fl = tile[1] !== ends[0]; else fl = tile[0] !== ends[1]; }
    const nb = side === "left" ? [{ tile, flipped: fl }, ...board] : [...board, { tile, flipped: fl }];
    const nh = hand.filter((_, i) => i !== idx);
    setBoard(nb); setHand(nh);
    if (!nh.length) { setGameOver("🎉 JIJ WINT!"); sysMsg("🎉 Gefeliciteerd!"); return; }
    setMyTurn(false);
    setTimeout(() => botMove(nb), 700);
  };

  const botMove = (cb: BEntry[]) => {
    setBotHand(prev => {
      const ends = getEnds(cb);
      let pi = -1, ps: "left" | "right" | null = null;
      for (let i = 0; i < prev.length; i++) { const s = canPlay(prev[i], cb, ends); if (s) { pi = i; ps = s; break; } }
      if (pi === -1) {
        setPile(pp => {
          if (!pp.length) { sysMsg("🤖 Bot past."); setMyTurn(true); return pp; }
          const np = [...pp]; const d = np.pop()!;
          sysMsg("🤖 Bot pakt."); setBotHand(bh => [...bh, d]); setMyTurn(true); return np;
        });
        return prev;
      }
      const bt = prev[pi];
      let fl = false;
      if (cb.length > 0) { if (ps === "left") fl = bt[1] !== ends[0]; else fl = bt[0] !== ends[1]; }
      const nb = ps === "left" ? [{ tile: bt, flipped: fl }, ...cb] : [...cb, { tile: bt, flipped: fl }];
      setBoard(nb); sysMsg(`🤖 [${bt[0]}|${bt[1]}]`);
      const nbh = prev.filter((_, i) => i !== pi);
      if (!nbh.length) { setGameOver("💀 BOT WINT!"); sysMsg("💀 Bot wint!"); }
      setMyTurn(true); return nbh;
    });
  };

  const bDraw = () => {
    if (!myTurn || gameOver || !pile.length) return;
    const np = [...pile]; const d = np.pop()!;
    setPile(np); setHand(p => [...p, d]); sysMsg(`📦 [${d[0]}|${d[1]}]`);
  };

  const bPass = () => {
    if (!myTurn || gameOver) return;
    setMyTurn(false); sysMsg("⏭️ Gepast.");
    setTimeout(() => botMove(board), 700);
  };

  const bChat = (t: string) => {
    if (!t.trim()) return;
    setMsgs(p => [...p, { sender: name, text: t.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setMsg(""); setShowEm(false);
    setTimeout(() => {
      const r = ["😂","Nice 🔥","GG 💯","💪","Biji! ☀️","👏","Hmm...","👍"];
      setMsgs(p => [...p, { sender: "🤖 Bot", text: r[Math.floor(Math.random() * r.length)], time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    }, 800 + Math.random() * 1200);
  };

  // Unified
  const play = (t: Tile, i: number) => mode === "bot" ? bPlay(t, i) : oPlay(i);
  const draw = () => mode === "bot" ? bDraw() : oDraw();
  const pass = () => mode === "bot" ? bPass() : oPass();
  const chat = (t: string) => mode === "bot" ? bChat(t) : oChat(t);
  const restart = () => mode === "bot" ? startBot() : oRestart();
  const copy = () => { navigator.clipboard.writeText(room).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const canAny = (): boolean => !board.length || hand.some(t => canPlay(t, board, getEnds(board)) !== null);
  const curPile = mode === "bot" ? pile.length : pileCount;
  const curOpp = mode === "bot" ? botHand.length : oppCount;

  // Dot pattern for dominos
  const D: number[][] = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

  const Dots = ({ v, sz }: { v: number; sz: string }) => (
    <div className={`grid grid-cols-3 gap-px ${sz}`}>
      {[...Array(9)].map((_, i) => (
        <div key={i} className={`rounded-full ${D[v].includes(i) ? "bg-gray-900" : ""}`} style={{ width: "100%", aspectRatio: "1" }} />
      ))}
    </div>
  );

  // Hand tile (vertical)
  const HTile = ({ v, hl, sm }: { v: Tile; hl?: boolean; sm?: boolean }) => (
    <div className={`${sm ? "w-[36px] h-[72px]" : "w-[44px] h-[88px]"} bg-[#FFFEF5] rounded-lg flex flex-col items-center justify-around py-0.5 shadow-lg transition-all duration-200 cursor-pointer select-none border-2 ${hl ? "border-yellow-400 ring-2 ring-yellow-400/60 shadow-yellow-500/30 shadow-xl" : "border-[#C4B998]"}`}
      style={{ background: "linear-gradient(145deg, #FFFEF5, #F0E6D0)" }}
    >
      <Dots v={v[0]} sz={sm ? "w-[18px] h-[18px]" : "w-[22px] h-[22px]"} />
      <div className={`w-[70%] h-[1px] ${sm ? "my-0" : "my-0.5"}`} style={{ background: "#C4B998" }} />
      <Dots v={v[1]} sz={sm ? "w-[18px] h-[18px]" : "w-[22px] h-[22px]"} />
    </div>
  );

  // Board tile (horizontal)
  const BTile = ({ v, fl }: { v: Tile; fl: boolean }) => {
    const d: Tile = fl ? [v[1], v[0]] : v;
    return (
      <div className="w-[48px] h-[26px] sm:w-[56px] sm:h-[30px] bg-[#FFFEF5] rounded flex items-center justify-around px-0.5 shadow-md border border-[#C4B998] flex-shrink-0"
        style={{ background: "linear-gradient(145deg, #FFFEF5, #F0E6D0)" }}
      >
        <Dots v={d[0]} sz="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px]" />
        <div className="w-[1px] h-[60%] bg-[#C4B998]" />
        <Dots v={d[1]} sz="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px]" />
      </div>
    );
  };

  // Back face for opponent tiles
  const BackTile = () => (
    <div className="w-[20px] h-[36px] sm:w-[24px] sm:h-[44px] rounded bg-gradient-to-br from-[#8B0000] to-[#5C0000] border border-[#3D0000] shadow-md flex items-center justify-center">
      <div className="w-[60%] h-[60%] border border-[#FFD700]/30 rounded-sm" />
    </div>
  );

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Kurdistan vlag bg */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" />
        <div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" />
        <div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sun s={view === "menu" ? 280 : 400} c={view === "menu" ? "opacity-40" : "opacity-[0.04]"} />
        </div>
      </div>

      {view === "game" && <div className="fixed inset-0 z-[1] bg-black/75" />}

      {/* Lang */}
      <div className="fixed top-2 right-2 flex gap-1 z-50">
        {status !== "off" && view === "menu" && (
          <div className={`flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full mr-1`}>
            <div className={`w-1.5 h-1.5 rounded-full ${status === "on" ? "bg-green-400" : "bg-red-500"} animate-pulse`} />
            <span className="text-white/50 text-[9px]">{status === "on" ? "Online" : "Offline"}</span>
          </div>
        )}
        <button onClick={() => setLang("KU")} className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${lang === "KU" ? "bg-yellow-500 text-black" : "bg-black/30 text-white/70"}`}>KU</button>
        <button onClick={() => setLang("NL")} className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${lang === "NL" ? "bg-yellow-500 text-black" : "bg-black/30 text-white/70"}`}>NL</button>
      </div>

      {/* ===== MENU ===== */}
      {view === "menu" ? (
        <div className="flex flex-col items-center z-10 w-full max-w-xs px-5 py-4">
          <div className="relative mb-1">
            <Sun s={80} c="absolute -top-2 left-1/2 -translate-x-1/2 opacity-80" />
            <h1 className="text-5xl font-black text-white italic drop-shadow-[0_3px_8px_rgba(0,0,0,0.5)] relative z-10">DOMINO</h1>
          </div>
          <p className="text-white text-[10px] mb-5 font-bold bg-black/30 px-3 py-1 rounded-full">🎲 28 stenen • 7 per speler</p>

          <input type="text" placeholder="☀️ Je naam..." value={name} onChange={e => setName(e.target.value || "Speler")}
            className="w-full p-2.5 rounded-2xl text-center font-bold text-black bg-white shadow-lg border-2 border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-3 text-sm" />

          <button onClick={startBot} className="w-full bg-blue-600 text-white font-black py-3 rounded-2xl border-b-4 border-blue-900 mb-2.5 active:translate-y-0.5 active:border-b-2 shadow-xl text-sm">
            🤖 {lang === "KU" ? "یاری دژی بۆت" : "Tegen Bot"}
          </button>

          <button onClick={create} className="w-full bg-green-600 text-white font-black py-3 rounded-2xl border-b-4 border-green-900 mb-2.5 active:translate-y-0.5 active:border-b-2 shadow-xl text-sm">
            🏠 {lang === "KU" ? "دروستکردنی ژوور" : "Kamer Maken"}
          </button>

          <div className="bg-purple-600 p-3 rounded-2xl border-b-4 border-purple-900 w-full shadow-xl">
            <input type="text" placeholder="CODE..." value={input} onChange={e => setInput(e.target.value.toUpperCase())}
              className="w-full p-2.5 rounded-xl text-center font-bold mb-2 uppercase text-black bg-white border-2 border-purple-300 text-lg tracking-[0.3em]" maxLength={5} />
            {joinErr && <p className="text-red-200 text-[10px] text-center mb-1.5 font-bold bg-red-900/30 rounded-lg py-1">⚠️ {joinErr}</p>}
            <button onClick={join} className="w-full text-white font-black py-2.5 bg-purple-800/60 rounded-xl active:bg-purple-700 text-sm">
              🚪 {lang === "KU" ? "چوونە ناو ژوور" : "Joinen"}
            </button>
          </div>

          <p className="text-white/30 text-[10px] mt-4">☀️ Biji Kurdistan</p>
        </div>
      ) : (
        /* ===== GAME ===== */
        <div className="w-full h-[100dvh] flex flex-col z-10 relative">

          {/* Top bar */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-black/40 backdrop-blur-sm">
            <button onClick={() => { setView("menu"); setWaiting(false); }} className="text-white/70 text-lg px-1">↩</button>
            <div className="flex items-center gap-1.5">
              <span className="bg-yellow-500 text-black px-2 py-0.5 rounded-lg font-black text-[10px]">{room}</span>
              {room !== "BOT" && <button onClick={copy} className="text-white/60 text-[10px] bg-white/10 px-1.5 py-0.5 rounded">{copied ? "✅" : "📋"}</button>}
            </div>
            <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${myTurn ? "bg-green-500 text-black" : "bg-red-500/80 text-white"}`}>
              {myTurn ? "🟢" : "🔴"}
            </div>
          </div>

          {/* Waiting */}
          {waiting && (
            <div className="bg-yellow-500 text-black font-black text-center py-2 text-xs animate-pulse">
              ⏳ Stuur code <span className="bg-black text-white px-2 py-0.5 rounded font-mono mx-1">{room}</span> naar vriend!
              <button onClick={copy} className="ml-1 bg-white/80 px-1.5 py-0.5 rounded text-[10px]">{copied ? "✅" : "📋"}</button>
            </div>
          )}

          {/* Game over */}
          {gameOver && (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-center py-2.5 text-sm">
              {gameOver}
              <button onClick={restart} className="ml-2 bg-black text-white px-3 py-1 rounded-lg text-xs">🔄</button>
            </div>
          )}

          {/* Mobile tabs */}
          <div className="flex sm:hidden bg-black/30">
            <button onClick={() => setTab("board")} className={`flex-1 py-1.5 text-xs font-bold ${tab === "board" ? "bg-green-800/50 text-white" : "text-white/40"}`}>
              🎮 Spel
            </button>
            <button onClick={() => { setTab("chat"); setUnread(0); }} className={`flex-1 py-1.5 text-xs font-bold relative ${tab === "chat" ? "bg-green-800/50 text-white" : "text-white/40"}`}>
              💬 Chat
              {unread > 0 && tab !== "chat" && <span className="absolute top-0.5 right-[30%] bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{unread}</span>}
            </button>
          </div>

          {/* Main game area */}
          <div className="flex-1 flex gap-0 sm:gap-2 min-h-0 sm:p-2">

            {/* Board area */}
            <div className={`flex-1 flex flex-col min-h-0 ${tab === "chat" ? "hidden sm:flex" : "flex"}`}>

              {/* Opponent area */}
              <div className="bg-black/20 rounded-t-2xl sm:rounded-2xl p-2 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-800 flex items-center justify-center text-sm">🎭</div>
                  <div>
                    <div className="text-white font-bold text-xs">{oppName || "Tegenstander"}</div>
                    <div className="text-white/40 text-[10px]">{curOpp} stenen</div>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(Math.min(curOpp, 10))].map((_, i) => <BackTile key={i} />)}
                  {curOpp > 10 && <span className="text-white/30 text-[10px] self-center ml-1">+{curOpp - 10}</span>}
                </div>
              </div>

              {/* Green table / board */}
              <div className="flex-1 relative overflow-hidden" style={{
                background: "radial-gradient(ellipse at center, #2D7A3A 0%, #1B5E27 50%, #134A1C 100%)",
                boxShadow: "inset 0 0 80px rgba(0,0,0,0.4)",
              }}>
                {/* Felt texture */}
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"4\" height=\"4\"><rect width=\"4\" height=\"4\" fill=\"%23000\"/><rect width=\"1\" height=\"1\" fill=\"%23111\"/></svg>')", backgroundSize: "4px 4px" }} />

                {/* Sun watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Sun s={120} c="opacity-[0.03]" />
                </div>

                {/* Pile indicator */}
                <div className="absolute top-2 right-2 bg-black/30 px-2 py-1 rounded-lg flex items-center gap-1">
                  <span className="text-white/60 text-[10px]">📦 {curPile}</span>
                </div>

                {/* Board tiles */}
                <div className="absolute inset-0 flex items-center justify-center p-3">
                  {board.length === 0 ? (
                    <div className="text-white/20 text-center">
                      <div className="text-2xl mb-1">☀️</div>
                      <div className="text-[10px] font-bold">{waiting ? "Wacht..." : "Leg eerste steen"}</div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-center gap-[2px] max-w-full overflow-auto">
                      {board.map((b, i) => <BTile key={i} v={b.tile} fl={b.flipped} />)}
                    </div>
                  )}
                </div>
              </div>

              {/* Player info */}
              <div className="bg-black/30 px-2 py-1.5 flex items-center justify-between border-t border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-yellow-600 flex items-center justify-center text-xs">☀️</div>
                  <div>
                    <div className="text-white font-bold text-xs">{name}</div>
                    <div className="text-white/40 text-[10px]">{hand.length} stenen</div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={draw} disabled={!myTurn || !!gameOver || curPile === 0}
                    className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold disabled:opacity-30 active:bg-blue-500">
                    📦 Pak ({curPile})
                  </button>
                  {!canAny() && myTurn && !gameOver && curPile === 0 && (
                    <button onClick={pass} className="bg-orange-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold active:bg-orange-500">⏭️ Pas</button>
                  )}
                </div>
              </div>
            </div>

            {/* Chat - desktop always visible, mobile only when tab=chat */}
            <div className={`w-full sm:w-56 md:w-60 bg-black/30 backdrop-blur-sm sm:rounded-2xl flex flex-col border-l sm:border border-white/5 ${tab === "board" ? "hidden sm:flex" : "flex"}`}>
              <div className="text-white/60 font-bold text-[10px] text-center py-1.5 bg-white/5 sm:rounded-t-2xl hidden sm:block">💬 Chat</div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
                {!msgs.length && <div className="text-white/20 text-[10px] text-center mt-6">Geen berichten</div>}
                {msgs.map((m, i) => (
                  <div key={i} className={`p-1.5 rounded-lg text-[11px] ${m.sender === "⚙️" ? "bg-blue-500/15 text-blue-300 italic" : m.sender.includes("Bot") ? "bg-red-500/15 text-red-300" : "bg-white/5 text-white"}`}>
                    <div className="flex justify-between">
                      <span className="font-bold text-yellow-400 text-[10px]">{m.sender}</span>
                      <span className="text-white/15 text-[8px]">{m.time}</span>
                    </div>
                    <div className="break-words">{m.text}</div>
                  </div>
                ))}
                <div ref={btm} />
              </div>
              {showEm && (
                <div className="grid grid-cols-8 gap-0.5 p-1.5 bg-black/40 mx-2 rounded-lg max-h-20 overflow-y-auto">
                  {emos.map(e => <button key={e} onClick={() => setMsg(p => p + e)} className="text-sm p-0.5 rounded active:bg-white/20">{e}</button>)}
                </div>
              )}
              <div className="flex gap-1 p-2 pt-1">
                <button onClick={() => setShowEm(!showEm)} className={`px-1.5 py-1 rounded-lg text-sm ${showEm ? "bg-yellow-500" : "bg-white/10"}`}>😊</button>
                <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") chat(msg); }}
                  className="flex-1 bg-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-yellow-500 placeholder-white/20 min-w-0" placeholder="Typ..." />
                <button onClick={() => chat(msg)} className="bg-green-600 px-2 py-1 rounded-lg text-xs text-white font-bold active:bg-green-500">➤</button>
              </div>
            </div>
          </div>

          {/* Player hand */}
          <div className="bg-gradient-to-t from-[#1a1a2e] to-[#16213e] p-2 border-t-2 border-yellow-500/50">
            {!canAny() && myTurn && !gameOver && curPile > 0 && (
              <div className="text-center text-red-400 text-[10px] font-bold mb-1 animate-pulse">⚠️ Geen passende steen - pak uit de pot!</div>
            )}
            <div className="flex justify-center gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {hand.map((t, i) => {
                const ends = getEnds(board);
                const ok = !board.length || canPlay(t, board, ends) !== null;
                return (
                  <div key={i} onClick={() => play(t, i)}
                    className={`flex-shrink-0 transition-all duration-150 ${!myTurn || gameOver ? "opacity-25 pointer-events-none" : ok ? "active:scale-90 sm:hover:-translate-y-3" : "opacity-35"}`}>
                    <HTile v={t} hl={ok && myTurn && !gameOver} sm={hand.length > 6} />
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