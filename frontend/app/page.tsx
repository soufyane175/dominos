"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://dominos-app.onrender.com";

type Tile = [number, number];
type Msg = { sender: string; text: string; time: string };
type BE = { tile: Tile; flipped: boolean };

function getEnds(b: BE[]): [number, number] {
  if (!b.length) return [-1, -1];
  const f = b[0], l = b[b.length - 1];
  return [f.flipped ? f.tile[1] : f.tile[0], l.flipped ? l.tile[0] : l.tile[1]];
}
function canPlay(t: Tile, b: BE[], e: [number, number]): "left" | "right" | null {
  if (!b.length) return "right";
  if (t[0] === e[0] || t[1] === e[0]) return "left";
  if (t[0] === e[1] || t[1] === e[1]) return "right";
  return null;
}
function allT(): Tile[] { const t: Tile[] = []; for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) t.push([i, j]); return t; }
function shuf(a: Tile[]): Tile[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

const D: number[][] = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const Dots = ({ v, sz }: { v: number; sz: string }) => (
  <div className={`grid grid-cols-3 gap-px ${sz}`}>
    {[...Array(9)].map((_, i) => <div key={i} className={`rounded-full ${D[v].includes(i) ? "bg-gray-900" : ""}`} style={{ width: "100%", aspectRatio: "1" }} />)}
  </div>
);
const Sun = ({ s = 200, c = "" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 200 200" className={c}>
    {[...Array(21)].map((_, i) => {
      const a = (i * 360) / 21 - 90, r = (a * Math.PI) / 180;
      const lr = ((a - 8) * Math.PI) / 180, rr = ((a + 8) * Math.PI) / 180;
      return <polygon key={i} points={`${100 + Math.cos(lr) * 45},${100 + Math.sin(lr) * 45} ${100 + Math.cos(r) * 90},${100 + Math.sin(r) * 90} ${100 + Math.cos(rr) * 45},${100 + Math.sin(rr) * 45}`} fill="#FCBF09" />;
    })}
    <circle cx="100" cy="100" r="45" fill="#FCBF09" />
  </svg>
);

export default function Home() {
  const [view, setView] = useState<"menu" | "game">("menu");
  const [lang, setLang] = useState<"KU" | "NL">("NL");
  const [mode, setMode] = useState<"bot" | "online">("bot");
  const [tab, setTab] = useState<"board" | "chat">("board");

  const [board, setBoard] = useState<BE[]>([]);
  const [hand, setHand] = useState<Tile[]>([]);
  const [botHand, setBotHand] = useState<Tile[]>([]);
  const [pile, setPile] = useState<Tile[]>([]);
  const [myTurn, setMyTurn] = useState(true);
  const [gameOver, setGameOver] = useState<string | null>(null);

  const [room, setRoom] = useState("");
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [oppName, setOppName] = useState("Bot");
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

  const emos = ["🔥", "👏", "😂", "👋", "😍", "😎", "💯", "😡", "🥳", "😭", "🤣", "💀", "🎉", "❤️", "👑", "🐐", "😈", "💪", "🙏", "☀️", "🎲", "👍", "😤", "🥶"];

  useEffect(() => { btm.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const sys = useCallback((t: string) => {
    setMsgs(p => [...p, { sender: "⚙️", text: t, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; });
  }, []);

  // ✅ Socket - alle events
  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 50,
      reconnectionDelay: 1000,
      timeout: 30000,
    });
    sock.current = s;

    s.on("connect", () => {
      setStatus("on");
      console.log("✅ Connected:", s.id);
    });
    s.on("connect_error", () => setStatus("err"));
    s.on("disconnect", () => setStatus("off"));

    // ✅ Room created - alleen voor de MAKER
    s.on("roomCreated", ({ code }: { code: string }) => {
      console.log("🏠 Room created:", code);
      setRoom(code);
      setWaiting(true);
      setMode("online");
      setView("game");  // ← ga naar game scherm
      setGameOver(null);
      setMsgs([]);
      setTab("board");
    });

    // ✅ Game started - voor BEIDE spelers
    s.on("gameStarted", ({ p1, p2 }: { p1: string; p2: string }) => {
      console.log("🎮 Game started:", p1, "vs", p2);
      setWaiting(false);
      setMode("online");
      setView("game");  // ← BELANGRIJK: ook de joiner gaat naar game scherm
      setGameOver(null);
      sys(`🎮 ${p1} vs ${p2} - LET'S GO!`);
    });

    // ✅ Game state - update bord, hand, etc
    s.on("gameState", (data: any) => {
      console.log("📊 State:", {
        hand: data.hand?.length,
        board: data.board?.length,
        turn: data.turn,
        myIdx: data.playerIndex,
        myTurn: data.turn === data.playerIndex,
        opp: data.opponentName,
        oppHand: data.opponentHandCount,
        pile: data.pileCount,
        started: data.started,
      });

      setBoard(data.board || []);
      setHand(data.hand || []);
      setPileCount(data.pileCount || 0);
      setOppCount(data.opponentHandCount || 0);
      setOppName(data.opponentName || "Wacht...");
      setMyTurn(data.turn === data.playerIndex);

      // ✅ Als we een room code nog niet hebben (joiner), zet die
      if (data.started) {
        setWaiting(false);
        setView("game");  // ← zorg dat we ALTIJD in game view zijn
        setMode("online");
      }

      if (data.winner) {
        setGameOver(data.winner.index === data.playerIndex ? "🎉 JIJ WINT!" : `💀 ${data.winner.name} wint!`);
      }
    });

    s.on("joinError", (m: string) => {
      console.log("❌ Join error:", m);
      setJoinErr(m);
    });

    s.on("tilePlayed", ({ playerName, tile }: any) => sys(`🎯 ${playerName}: [${tile[0]}|${tile[1]}]`));
    s.on("playerPassed", ({ name: n }: any) => sys(`⏭️ ${n} past`));
    s.on("chatMsg", (m: Msg) => {
      setMsgs(p => [...p, m]);
      setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; });
    });
    s.on("opponentLeft", () => {
      sys("❌ Tegenstander weg!");
      setGameOver("❌ Tegenstander weg");
    });
    s.on("gameRestarted", () => {
      setGameOver(null);
      sys("🔄 Nieuw spel!");
    });
    s.on("playError", (m: string) => sys(`❌ ${m}`));
    s.on("drawError", (m: string) => sys(`❌ ${m}`));

    return () => { s.removeAllListeners(); s.disconnect(); };
  }, [sys]);

  // === ONLINE ===
  const oCreate = () => {
    if (status !== "on") {
      setJoinErr("Server start op... wacht ~15 sec!");
      fetch(SOCKET_URL).catch(() => {});
      return;
    }
    setJoinErr("");
    sock.current?.emit("createRoom", { playerName: name || "Speler" });
  };

  // ✅ Join - na emit gaat de frontend automatisch naar game via gameStarted + gameState events
  const oJoin = () => {
    const c = input.trim().toUpperCase();
    if (!c) { setJoinErr("Vul een code in!"); return; }
    if (status !== "on") {
      setJoinErr("Server start op... wacht even!");
      fetch(SOCKET_URL).catch(() => {});
      return;
    }
    setJoinErr("");

    // ✅ Sla room code alvast op zodat we die hebben als gameState binnenkomt
    setRoom(c);
    setMode("online");
    setMsgs([]);
    setTab("board");
    setGameOver(null);

    console.log("📤 Joining room:", c);
    sock.current?.emit("joinRoom", { code: c, playerName: name || "Speler" });
  };

  const oPlay = (i: number) => { if (myTurn && !gameOver) sock.current?.emit("playTile", { tileIndex: i }); };
  const oDraw = () => { if (myTurn && !gameOver) sock.current?.emit("drawTile"); };
  const oPass = () => { if (myTurn && !gameOver) sock.current?.emit("passTurn"); };
  const oChat = (t: string) => { if (t.trim()) { sock.current?.emit("sendChat", { text: t.trim() }); setMsg(""); setShowEm(false); } };
  const oRestart = () => sock.current?.emit("restartGame");

  // === BOT ===
  const startBot = () => {
    const a = shuf(allT());
    setHand(a.slice(0, 7)); setBotHand(a.slice(7, 14)); setPile(a.slice(14));
    setBoard([]); setMyTurn(true); setGameOver(null); setMode("bot");
    setView("game"); setRoom("BOT"); setMsgs([]); setTab("board");
    setOppName("Bot"); setOppCount(7); setPileCount(14);
    setTimeout(() => sys("🤖 Jij begint!"), 100);
  };

  const bPlay = (tile: Tile, idx: number) => {
    if (!myTurn || gameOver) return;
    const ends = getEnds(board);
    const side = canPlay(tile, board, ends);
    if (!side && board.length > 0) { sys("❌ Past niet!"); return; }
    let fl = false;
    if (board.length > 0) { if (side === "left") fl = tile[1] !== ends[0]; else fl = tile[0] !== ends[1]; }
    const nb = side === "left" ? [{ tile, flipped: fl }, ...board] : [...board, { tile, flipped: fl }];
    const nh = hand.filter((_, i) => i !== idx);
    setBoard(nb); setHand(nh);
    if (!nh.length) { setGameOver("🎉 JIJ WINT!"); sys("🎉 Gefeliciteerd!"); return; }
    setMyTurn(false);
    setTimeout(() => botAI(nb), 700);
  };

  const botAI = (cb: BE[]) => {
    setBotHand(prev => {
      const ends = getEnds(cb);
      let pi = -1, ps: "left" | "right" | null = null;
      for (let i = 0; i < prev.length; i++) { const s = canPlay(prev[i], cb, ends); if (s) { pi = i; ps = s; break; } }
      if (pi === -1) {
        setPile(pp => {
          if (!pp.length) { sys("🤖 Bot past."); setMyTurn(true); return pp; }
          const np = [...pp]; const d = np.pop()!;
          sys("🤖 Bot pakt."); setBotHand(bh => [...bh, d]); setMyTurn(true);
          setPileCount(np.length); setOppCount(prev.length + 1); return np;
        });
        return prev;
      }
      const bt = prev[pi]; let fl = false;
      if (cb.length > 0) { if (ps === "left") fl = bt[1] !== ends[0]; else fl = bt[0] !== ends[1]; }
      const nb2 = ps === "left" ? [{ tile: bt, flipped: fl }, ...cb] : [...cb, { tile: bt, flipped: fl }];
      setBoard(nb2); sys(`🤖 [${bt[0]}|${bt[1]}]`);
      const nbh = prev.filter((_, i) => i !== pi);
      if (!nbh.length) { setGameOver("💀 BOT WINT!"); }
      setMyTurn(true); setOppCount(nbh.length); return nbh;
    });
  };

  const bDraw = () => {
    if (!myTurn || gameOver || !pile.length) return;
    const np = [...pile]; const d = np.pop()!;
    setPile(np); setHand(p => [...p, d]); setPileCount(np.length);
    sys(`📦 [${d[0]}|${d[1]}]`);
  };
  const bPass = () => {
    if (!myTurn || gameOver) return;
    setMyTurn(false); sys("⏭️ Gepast.");
    setTimeout(() => botAI(board), 700);
  };
  const bChat = (t: string) => {
    if (!t.trim()) return;
    setMsgs(p => [...p, { sender: name || "Jij", text: t.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setMsg(""); setShowEm(false);
    setTimeout(() => {
      const r = ["😂", "Nice 🔥", "GG 💯", "💪", "Biji ☀️", "👏", "👍", "Ik win! 😈"];
      setMsgs(p => [...p, { sender: "🤖 Bot", text: r[Math.floor(Math.random() * r.length)], time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    }, 800 + Math.random() * 1200);
  };

  // Unified
  const play = (t: Tile, i: number) => mode === "bot" ? bPlay(t, i) : oPlay(i);
  const draw = () => mode === "bot" ? bDraw() : oDraw();
  const pass = () => mode === "bot" ? bPass() : oPass();
  const sendC = (t: string) => mode === "bot" ? bChat(t) : oChat(t);
  const restart = () => mode === "bot" ? startBot() : oRestart();
  const copy = () => { navigator.clipboard.writeText(room).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const canAny = () => !board.length || hand.some(t => canPlay(t, board, getEnds(board)) !== null);
  const cPile = mode === "bot" ? pile.length : pileCount;
  const cOpp = mode === "bot" ? botHand.length : oppCount;

  // Components
  const HTile = ({ v, hl, sm }: { v: Tile; hl?: boolean; sm?: boolean }) => (
    <div className={`${sm ? "w-[32px] h-[64px]" : "w-[40px] h-[80px]"} rounded-lg flex flex-col items-center justify-around py-0.5 shadow-lg cursor-pointer select-none border-2 transition-all duration-150 active:scale-90 ${hl ? "border-yellow-400 ring-2 ring-yellow-400/60 shadow-yellow-500/40" : "border-[#C4B998]"}`}
      style={{ background: "linear-gradient(160deg, #FFFEF5, #F5EDDA)" }}>
      <Dots v={v[0]} sz={sm ? "w-[14px] h-[14px]" : "w-[18px] h-[18px]"} />
      <div className="w-[60%] h-px bg-[#C4B998]" />
      <Dots v={v[1]} sz={sm ? "w-[14px] h-[14px]" : "w-[18px] h-[18px]"} />
    </div>
  );

  const BTile2 = ({ v, fl }: { v: Tile; fl: boolean }) => {
    const d: Tile = fl ? [v[1], v[0]] : v;
    return (
      <div className="w-[42px] h-[22px] sm:w-[52px] sm:h-[28px] rounded flex items-center justify-around px-0.5 shadow-md border border-[#C4B998] flex-shrink-0"
        style={{ background: "linear-gradient(160deg, #FFFEF5, #F0E6D0)" }}>
        <Dots v={d[0]} sz="w-[10px] h-[10px] sm:w-[14px] sm:h-[14px]" />
        <div className="w-px h-[50%] bg-[#C4B998]" />
        <Dots v={d[1]} sz="w-[10px] h-[10px] sm:w-[14px] sm:h-[14px]" />
      </div>
    );
  };

  const Back = () => (
    <div className="w-[14px] h-[26px] sm:w-[18px] sm:h-[32px] rounded bg-gradient-to-br from-[#8B0000] to-[#5C0000] border border-[#3D0000] shadow flex items-center justify-center flex-shrink-0">
      <div className="w-[50%] h-[50%] border border-[#FFD700]/20 rounded-sm" />
    </div>
  );

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" />
        <div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" />
        <div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sun s={view === "menu" ? 250 : 350} c={view === "menu" ? "opacity-35" : "opacity-[0.03]"} />
        </div>
      </div>
      {view === "game" && <div className="fixed inset-0 z-[1] bg-black/80" />}

      <div className="fixed top-2 right-2 flex gap-1 z-50 items-center">
        {view === "menu" && (
          <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full mr-1">
            <div className={`w-2 h-2 rounded-full ${status === "on" ? "bg-green-400 animate-pulse" : status === "err" ? "bg-red-500" : "bg-gray-500"}`} />
            <span className="text-white/50 text-[9px]">{status === "on" ? "Online ✓" : status === "err" ? "Herverbinden..." : "..."}</span>
          </div>
        )}
        <button onClick={() => setLang("KU")} className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${lang === "KU" ? "bg-yellow-500 text-black" : "bg-black/40 text-white/60"}`}>KU</button>
        <button onClick={() => setLang("NL")} className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${lang === "NL" ? "bg-yellow-500 text-black" : "bg-black/40 text-white/60"}`}>NL</button>
      </div>

      {/* ===== MENU ===== */}
      {view === "menu" ? (
        <div className="flex flex-col items-center z-10 w-full max-w-[300px] px-5 py-4">
          <div className="relative mb-1">
            <Sun s={65} c="absolute -top-1 left-1/2 -translate-x-1/2 opacity-80" />
            <h1 className="text-[42px] font-black text-white italic drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)] relative z-10">DOMINO</h1>
          </div>
          <p className="text-white/80 text-[10px] mb-4 font-bold bg-black/30 px-3 py-1 rounded-full">☀️ 28 stenen • 7 per speler</p>

          <input type="text" placeholder={lang === "KU" ? "ناوی تۆ..." : "Je naam..."} value={name} onChange={e => setName(e.target.value)}
            className="w-full p-2.5 rounded-2xl text-center font-bold text-black bg-white shadow-lg border-2 border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-3 text-sm" />

          <button onClick={startBot} className="w-full bg-gradient-to-b from-blue-500 to-blue-700 text-white font-black py-3 rounded-2xl border-b-4 border-blue-900 mb-2 active:translate-y-0.5 active:border-b-2 shadow-xl text-sm">
            🤖 {lang === "KU" ? "یاری دژی بۆت" : "Tegen Bot"}
          </button>
          <button onClick={oCreate} className="w-full bg-gradient-to-b from-green-500 to-green-700 text-white font-black py-3 rounded-2xl border-b-4 border-green-900 mb-2 active:translate-y-0.5 active:border-b-2 shadow-xl text-sm">
            🏠 {lang === "KU" ? "دروستکردنی ژوور" : "Kamer Maken"}
          </button>

          <div className="bg-gradient-to-b from-purple-500 to-purple-700 p-3 rounded-2xl border-b-4 border-purple-900 w-full shadow-xl">
            <input type="text" placeholder="CODE..." value={input} onChange={e => setInput(e.target.value.toUpperCase())}
              className="w-full p-2.5 rounded-xl text-center font-bold mb-1.5 uppercase text-black bg-white border-2 border-purple-300 text-lg tracking-[0.3em]" maxLength={5} />
            {joinErr && <p className="text-white text-[10px] text-center mb-1.5 font-bold bg-red-500/30 rounded-lg py-1">⚠️ {joinErr}</p>}
            <button onClick={oJoin} className="w-full text-white font-black py-2.5 bg-purple-900/50 rounded-xl active:bg-purple-800 text-sm">
              🚪 {lang === "KU" ? "چوونە ناو ژوور" : "Joinen"}
            </button>
          </div>

          {status !== "on" && (
            <div className="mt-3 bg-yellow-500/20 rounded-xl p-2 w-full">
              <p className="text-yellow-300 text-[10px] text-center font-bold">⏳ Server start op... wacht ~15 sec</p>
              <button onClick={() => fetch(SOCKET_URL).catch(() => {})} className="w-full mt-1 text-yellow-400 text-[10px] font-bold bg-yellow-500/10 rounded py-1">🔄 Opnieuw</button>
            </div>
          )}
          <p className="text-white/20 text-[10px] mt-3">☀️ Biji Kurdistan</p>
        </div>
      ) : (

        /* ===== GAME ===== */
        <div className="w-full h-[100dvh] flex flex-col z-10">

          {/* Top */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-black/60 flex-shrink-0">
            <button onClick={() => { setView("menu"); setWaiting(false); }} className="text-white/60 text-lg px-1 active:text-white">↩</button>
            <div className="flex items-center gap-1.5">
              <span className="bg-yellow-500 text-black px-2.5 py-0.5 rounded-lg font-black text-[11px]">{room}</span>
              {room !== "BOT" && <button onClick={copy} className="text-white/60 text-[10px] bg-white/10 px-2 py-0.5 rounded-lg active:bg-white/20">{copied ? "✅" : "📋"}</button>}
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${myTurn ? "bg-green-500 text-black" : "bg-red-500/80 text-white"}`}>
              {myTurn ? "🟢 Jij" : `🔴 ${oppName}`}
            </div>
          </div>

          {/* Waiting */}
          {waiting && (
            <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-black text-center py-2.5 text-[11px] flex-shrink-0">
              ⏳ Stuur code naar je vriend!
              <span className="bg-black text-white px-3 py-1 rounded-lg font-mono mx-2 text-base tracking-widest">{room}</span>
              <button onClick={copy} className="bg-white/70 px-2 py-0.5 rounded text-[10px] font-bold">{copied ? "✅" : "📋"}</button>
            </div>
          )}

          {/* Game over */}
          {gameOver && (
            <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-black font-black text-center py-3 text-base flex-shrink-0">
              {gameOver}
              <button onClick={restart} className="ml-3 bg-black text-white px-4 py-1.5 rounded-xl text-xs font-bold">🔄</button>
            </div>
          )}

          {/* Mobile tabs */}
          <div className="flex sm:hidden flex-shrink-0">
            <button onClick={() => setTab("board")} className={`flex-1 py-2 text-xs font-bold ${tab === "board" ? "bg-green-900/50 text-green-400 border-b-2 border-green-400" : "text-white/30 bg-black/30"}`}>
              🎮 Spel
            </button>
            <button onClick={() => { setTab("chat"); setUnread(0); }} className={`flex-1 py-2 text-xs font-bold relative ${tab === "chat" ? "bg-green-900/50 text-green-400 border-b-2 border-green-400" : "text-white/30 bg-black/30"}`}>
              💬 Chat
              {unread > 0 && tab !== "chat" && <span className="absolute top-1 right-[30%] bg-red-500 text-white text-[7px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-bounce">{unread}</span>}
            </button>
          </div>

          {/* Main */}
          <div className="flex-1 flex min-h-0">
            {/* Board */}
            <div className={`flex-1 flex flex-col min-h-0 ${tab === "chat" ? "hidden sm:flex" : "flex"}`}>
              {/* Opponent */}
              <div className="bg-black/40 px-2 py-1.5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-red-900/80 flex items-center justify-center text-xs">👤</div>
                  <div><div className="text-white font-bold text-[11px]">{oppName}</div><div className="text-white/30 text-[9px]">{cOpp} stenen</div></div>
                </div>
                <div className="flex gap-px overflow-hidden max-w-[55%]">{[...Array(Math.min(cOpp, 14))].map((_, i) => <Back key={i} />)}</div>
              </div>

              {/* Table */}
              <div className="flex-1 relative overflow-auto" style={{ background: "radial-gradient(ellipse at center, #2D7A3A 0%, #1B5E27 50%, #0F3D14 100%)", boxShadow: "inset 0 0 80px rgba(0,0,0,0.5)" }}>
                <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23000'/%3E%3Crect width='1' height='1' fill='%23222'/%3E%3C/svg%3E")`, backgroundSize: "4px 4px" }} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Sun s={90} c="opacity-[0.02]" /></div>
                <div className="absolute top-1.5 right-1.5 bg-black/40 px-2 py-0.5 rounded-lg text-white/50 text-[9px] font-bold">📦 {cPile}</div>
                <div className="absolute inset-0 flex items-center justify-center p-3">
                  {!board.length ? (
                    <div className="text-white/15 text-center"><div className="text-2xl mb-1.5">☀️</div><div className="text-xs font-bold">{waiting ? "Wacht op vriend..." : "Leg eerste steen!"}</div></div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-center gap-[2px]">{board.map((b, i) => <BTile2 key={i} v={b.tile} fl={b.flipped} />)}</div>
                  )}
                </div>
              </div>

              {/* Player bar */}
              <div className="bg-black/50 px-2 py-1.5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-yellow-700/80 flex items-center justify-center text-xs">☀️</div>
                  <div><div className="text-white font-bold text-[11px]">{name || "Jij"}</div><div className="text-white/30 text-[9px]">{hand.length} stenen</div></div>
                </div>
                <div className="flex gap-1.5 items-center">
                  {!canAny() && myTurn && !gameOver && cPile > 0 && <span className="text-red-400 text-[8px] animate-pulse">⚠️</span>}
                  <button onClick={draw} disabled={!myTurn || !!gameOver || cPile === 0} className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold disabled:opacity-25 active:bg-blue-500">📦 {cPile}</button>
                  {!canAny() && myTurn && !gameOver && cPile === 0 && <button onClick={pass} className="bg-orange-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold active:bg-orange-500">⏭️</button>}
                </div>
              </div>
            </div>

            {/* Chat */}
            <div className={`w-full sm:w-52 md:w-56 bg-black/40 flex flex-col border-l border-white/5 ${tab === "board" ? "hidden sm:flex" : "flex"}`}>
              <div className="text-white/40 font-bold text-[10px] text-center py-1.5 bg-white/5 hidden sm:block">💬 Chat</div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
                {!msgs.length && <div className="text-white/15 text-[10px] text-center mt-8">Geen berichten</div>}
                {msgs.map((m, i) => (
                  <div key={i} className={`p-1.5 rounded-lg text-[10px] ${m.sender === "⚙️" ? "bg-blue-500/10 text-blue-300/80 italic" : m.sender.includes("Bot") ? "bg-red-500/10 text-red-300/80" : "bg-white/5 text-white/80"}`}>
                    <div className="flex justify-between"><span className="font-bold text-yellow-400/80 text-[9px]">{m.sender}</span><span className="text-white/10 text-[7px]">{m.time}</span></div>
                    <div className="break-words mt-px">{m.text}</div>
                  </div>
                ))}
                <div ref={btm} />
              </div>
              {showEm && (
                <div className="grid grid-cols-8 gap-0.5 p-1.5 bg-black/50 mx-1.5 rounded-lg max-h-20 overflow-y-auto">
                  {emos.map(e => <button key={e} onClick={() => setMsg(p => p + e)} className="text-sm p-0.5 rounded active:bg-white/20">{e}</button>)}
                </div>
              )}
              <div className="flex gap-1 p-2 pt-1">
                <button onClick={() => setShowEm(!showEm)} className={`px-1.5 py-1 rounded-lg text-sm ${showEm ? "bg-yellow-500" : "bg-white/10"}`}>😊</button>
                <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendC(msg); }}
                  className="flex-1 bg-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:ring-1 focus:ring-yellow-500/50 placeholder-white/20 min-w-0" placeholder="Typ..." />
                <button onClick={() => sendC(msg)} className="bg-green-600 px-2.5 py-1 rounded-lg text-[10px] text-white font-bold active:bg-green-500">➤</button>
              </div>
            </div>
          </div>

          {/* Hand */}
          <div className="bg-gradient-to-t from-[#070710] via-[#0d1117] to-[#161b22] px-1.5 py-2 border-t-2 border-yellow-500/40 flex-shrink-0">
            {!canAny() && myTurn && !gameOver && cPile > 0 && (
              <div className="text-center text-red-400/80 text-[9px] font-bold mb-1 animate-pulse">⚠️ Pak uit de pot!</div>
            )}
            <div className="flex justify-center gap-[3px] overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
              {hand.map((t, i) => {
                const ends = getEnds(board);
                const ok = !board.length || canPlay(t, board, ends) !== null;
                return (
                  <div key={`${t[0]}-${t[1]}-${i}`} onClick={() => play(t, i)}
                    className={`flex-shrink-0 transition-all duration-150 ${!myTurn || gameOver ? "opacity-20 pointer-events-none" : ok ? "active:scale-90 sm:hover:-translate-y-3" : "opacity-25"}`}>
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