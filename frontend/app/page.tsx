"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://dominos-app.onrender.com";

type Tile = [number, number];
type Msg = { sender: string; text: string; time: string };
type BE = { tile: Tile; flipped: boolean };
type Account = {
  username: string; wins: number; losses: number; games: number;
  avatar: string; created: number; diamonds: number;
  ownedSkins: string[]; equippedSkin: string; inTournament: boolean;
};

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
function shouldFlip(tile: Tile, side: "left" | "right", ends: [number, number], empty: boolean): boolean {
  if (empty) return false;
  if (side === "left") return tile[0] === ends[0];
  return tile[1] === ends[1];
}
function allT(): Tile[] {
  const t: Tile[] = [];
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) t.push([i, j]);
  return t;
}
function shuf(a: Tile[]): Tile[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function getAllPlayers(): Account[] {
  try {
    const a: Record<string, { account: Account }> = JSON.parse(localStorage.getItem("domino_accounts") || "{}");
    return Object.values(a).map(x => x.account).sort((a, b) => b.wins - a.wins);
  } catch { return []; }
}

const D: number[][] = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const Dots = ({ v, sz }: { v: number; sz: number }) => (
  <div className="grid grid-cols-3 gap-px" style={{ width: sz, height: sz }}>
    {[...Array(9)].map((_, i) => (
      <div key={i} className={`rounded-full ${D[v].includes(i) ? "bg-gray-900" : ""}`} style={{ width: "100%", aspectRatio: "1" }} />
    ))}
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

function playTileSound() { try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = 250; g.gain.setValueAtTime(0.3, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15); o.start(); o.stop(c.currentTime + 0.15); } catch (e) { } }
function playWinSound() { try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = f; const t = c.currentTime + i * 0.2; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5); o.start(t); o.stop(t + 0.5); }); } catch (e) { } }
function playLaughSound() { try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); [800, 600, 900, 500, 1000, 400].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = f; const t = c.currentTime + i * 0.12; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11); o.start(t); o.stop(t + 0.12); }); } catch (e) { } }
function playCoinSound() { try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); [1200, 1400, 1600].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = f; const t = c.currentTime + i * 0.1; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.start(t); o.stop(t + 0.12); }); } catch (e) { } }

const SKINS = [
  { id: "classic", name: "Classic", desc: "Default", emoji: "🎲", price: 0, bg: "from-[#FFFEF5] to-[#E8DCC8]" },
  { id: "neon", name: "Neon Pat", desc: "Rack Skin", emoji: "💜", price: 100, bg: "from-purple-500 to-pink-600" },
  { id: "stone", name: "Ancient Stone", desc: "Rack Skin", emoji: "🪨", price: 150, bg: "from-stone-500 to-stone-700" },
  { id: "gold", name: "Golden Lux", desc: "Rack Skin", emoji: "👑", price: 200, bg: "from-yellow-400 to-yellow-700" },
  { id: "fire", name: "Fire Blaze", desc: "Tile Skin", emoji: "🔥", price: 300, bg: "from-red-500 to-orange-600" },
  { id: "ice", name: "Ice Crystal", desc: "Tile Skin", emoji: "🥶", price: 250, bg: "from-cyan-300 to-blue-600" },
  { id: "kurdish", name: "Kurdistan", desc: "Special", emoji: "☀️", price: 350, bg: "from-red-500 via-white to-green-500" },
  { id: "diamond", name: "Diamond Elite", desc: "Legendary", emoji: "💎", price: 1000, bg: "from-cyan-400 to-blue-700" },
];

function Confetti() {
  const [p] = useState(() => Array.from({ length: 60 }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 2, dur: 2 + Math.random() * 3,
    size: 5 + Math.random() * 10,
    color: ["#FF0000", "#FFD700", "#00FF00", "#00BFFF", "#FF69B4", "#FFA500"][Math.floor(Math.random() * 6)],
    round: Math.random() > 0.5,
  })));
  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {p.map(x => <div key={x.id} className="absolute" style={{ left: `${x.x}%`, top: "-20px", width: `${x.size}px`, height: `${x.size}px`, backgroundColor: x.color, borderRadius: x.round ? "50%" : "2px", animation: `cfall ${x.dur}s ${x.delay}s linear forwards` }} />)}
      <style jsx>{`@keyframes cfall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  );
}

function WinOverlay({ onClose }: { onClose: () => void }) {
  const [show, setShow] = useState(true);
  useEffect(() => { playWinSound(); setTimeout(playCoinSound, 800); const t = setTimeout(() => { setShow(false); setTimeout(onClose, 500); }, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed inset-0 z-[99] flex items-center justify-center transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" /><Confetti />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="text-[100px] sm:text-[140px] leading-none animate-bounce select-none">🏆</div>
        <div className="text-3xl animate-bounce" style={{ animationDelay: ".1s" }}>👑</div>
        <div className="text-yellow-400 font-black text-3xl sm:text-5xl animate-pulse">YOU WIN!</div>
        <div className="bg-gradient-to-r from-cyan-500/80 to-blue-600/80 backdrop-blur px-8 py-3 rounded-2xl flex items-center gap-3 shadow-xl animate-bounce">
          <span className="text-3xl">💎</span><span className="text-white font-black text-2xl">+100</span>
        </div>
      </div>
    </div>
  );
}

function LoseOverlay({ onClose }: { onClose: () => void }) {
  const [show, setShow] = useState(true);
  const L = ["🤣", "😂", "😆"];
  const [ci, setCi] = useState(0);
  useEffect(() => { playLaughSound(); const ei = setInterval(() => setCi(p => (p + 1) % L.length), 400); const t = setTimeout(() => { setShow(false); setTimeout(onClose, 500); }, 4000); return () => { clearInterval(ei); clearTimeout(t); }; }, [onClose]);
  return (
    <div className={`fixed inset-0 z-[99] flex items-center justify-center transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 flex flex-col items-center">
        <div style={{ animation: "blgh .8s ease-in-out infinite" }} className="text-[120px] sm:text-[180px] leading-none select-none">{L[ci]}</div>
        <div className="mt-4 text-white font-black text-3xl animate-pulse">YOU LOSE! 😂</div>
        <div className="mt-2 bg-white/10 px-4 py-1 rounded-full text-white/50 text-sm">💎 +10</div>
      </div>
      <style jsx>{`@keyframes blgh{0%,100%{transform:scale(1)}15%{transform:scale(1.3) rotate(-10deg)}45%{transform:scale(1.2) rotate(5deg)}}`}</style>
    </div>
  );
}

function DominoChain({ board, lastIdx }: { board: BE[]; lastIdx: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-[2px] p-2">
      {board.map((entry, idx) => {
        const tile = entry.tile;
        const d: Tile = entry.flipped ? [tile[1], tile[0]] : tile;
        const isDouble = tile[0] === tile[1];
        const isNew = idx === lastIdx;
        if (isDouble) {
          return (
            <div key={idx} className={`flex flex-col items-center justify-around rounded-md border-2 border-[#C4B998] shadow-lg flex-shrink-0 ${isNew ? "animate-pop" : ""}`}
              style={{ width: 28, height: 52, background: "linear-gradient(160deg, #FFFEF5, #F0E6D0)" }}>
              <Dots v={d[0]} sz={11} /><div className="w-[70%] h-px bg-[#C4B998]" /><Dots v={d[1]} sz={11} />
            </div>
          );
        }
        return (
          <div key={idx} className={`flex flex-row items-center justify-around rounded-md border-2 border-[#C4B998] shadow-lg flex-shrink-0 ${isNew ? "animate-pop" : ""}`}
            style={{ width: 52, height: 28, background: "linear-gradient(160deg, #FFFEF5, #F0E6D0)" }}>
            <Dots v={d[0]} sz={11} /><div className="h-[70%] w-px bg-[#C4B998]" /><Dots v={d[1]} sz={11} />
          </div>
        );
      })}
      <style jsx>{`@keyframes pop{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}.animate-pop{animation:pop .4s ease-out}`}</style>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function Home() {
  const [account, setAccount] = useState<Account | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "create">("create");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authAvatar, setAuthAvatar] = useState("😎");
  const [authStep, setAuthStep] = useState(1);
  const avatars = ["😎", "🤖", "👑", "🔥", "💀", "🐐", "☀️", "🦁", "🎲", "💪", "😈", "🥶", "⚡", "🌟", "🎯", "🧔"];

  const [view, setView] = useState<"menu" | "game">("menu");
  const [menuTab, setMenuTab] = useState<"play" | "champions" | "store">("play");
  const [storeTab, setStoreTab] = useState<"skins" | "gems">("skins");
  const [showTournament, setShowTournament] = useState(false);
  const [mode, setMode] = useState<"bot" | "online">("bot");
  const [tab, setTab] = useState<"board" | "chat">("board");

  const [board, setBoard] = useState<BE[]>([]);
  const [hand, setHand] = useState<Tile[]>([]);
  const [botHand, setBotHand] = useState<Tile[]>([]);
  const [pile, setPile] = useState<Tile[]>([]);
  const [myTurn, setMyTurn] = useState(true);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [showLose, setShowLose] = useState(false);
  const [lastIdx, setLastIdx] = useState(-1);

  const [room, setRoom] = useState("");
  const [input, setInput] = useState("");
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
  const [showChat, setShowChat] = useState(false);

  const sock = useRef<Socket | null>(null);
  const btm = useRef<HTMLDivElement>(null);
  const emos = ["🔥", "👏", "😂", "👋", "😍", "😎", "💯", "😡", "🥳", "😭", "🤣", "💀", "🎉", "❤️", "👑", "🐐", "😈", "💪"];
  const playerName = account?.username || "Gast";

  // Load account
  useEffect(() => {
    try {
      const s = localStorage.getItem("domino_account");
      if (s) {
        const a = JSON.parse(s);
        if (!a.diamonds) a.diamonds = 0;
        if (!a.ownedSkins) a.ownedSkins = ["classic"];
        if (!a.equippedSkin) a.equippedSkin = "classic";
        if (a.inTournament === undefined) a.inTournament = false;
        setAccount(a);
      }
    } catch (e) { }
    setAuthLoaded(true);
  }, []);

  const saveAccount = (a: Account) => {
    setAccount(a);
    localStorage.setItem("domino_account", JSON.stringify(a));
    const accs: Record<string, any> = JSON.parse(localStorage.getItem("domino_accounts") || "{}");
    if (accs[a.username.toLowerCase()]) {
      accs[a.username.toLowerCase()].account = a;
      localStorage.setItem("domino_accounts", JSON.stringify(accs));
    }
  };

  const handleAuth = () => {
    if (authMode === "create" && authStep === 1) { setAuthStep(2); return; }
    if (!authUser.trim() || authUser.trim().length < 2) { setAuthErr("Name too short!"); return; }
    if (!authPass.trim() || authPass.trim().length < 3) { setAuthErr("Password too short!"); return; }
    const accs: Record<string, any> = JSON.parse(localStorage.getItem("domino_accounts") || "{}");
    if (authMode === "create") {
      if (accs[authUser.toLowerCase()]) { setAuthErr("Name taken!"); return; }
      const a: Account = { username: authUser.trim(), wins: 0, losses: 0, games: 0, avatar: authAvatar, created: Date.now(), diamonds: 100, ownedSkins: ["classic"], equippedSkin: "classic", inTournament: false };
      accs[authUser.toLowerCase()] = { password: authPass, account: a };
      localStorage.setItem("domino_accounts", JSON.stringify(accs));
      saveAccount(a);
    } else {
      const e = accs[authUser.toLowerCase()];
      if (!e) { setAuthErr("Not found!"); return; }
      if (e.password !== authPass) { setAuthErr("Wrong password!"); return; }
      if (!e.account.diamonds) e.account.diamonds = 0;
      if (!e.account.ownedSkins) e.account.ownedSkins = ["classic"];
      if (!e.account.equippedSkin) e.account.equippedSkin = "classic";
      saveAccount(e.account);
    }
    setAuthErr("");
  };

  const updateStats = useCallback((won: boolean) => {
    setAccount(prev => {
      if (!prev) return prev;
      const u = { ...prev, games: prev.games + 1, wins: prev.wins + (won ? 1 : 0), losses: prev.losses + (won ? 0 : 1), diamonds: prev.diamonds + (won ? 100 : 10) };
      saveAccount(u);
      return u;
    });
  }, []);

  const buySkin = (id: string, price: number) => {
    if (!account || account.diamonds < price || account.ownedSkins.includes(id)) return;
    const u = { ...account, diamonds: account.diamonds - price, ownedSkins: [...account.ownedSkins, id] };
    saveAccount(u);
    playCoinSound();
  };
  const equipSkin = (id: string) => { if (!account || !account.ownedSkins.includes(id)) return; saveAccount({ ...account, equippedSkin: id }); };
  const toggleTournament = () => { if (!account) return; saveAccount({ ...account, inTournament: !account.inTournament }); };
  const logout = () => { setAccount(null); localStorage.removeItem("domino_account"); setAuthMode("create"); setAuthStep(1); setAuthUser(""); setAuthPass(""); };

  useEffect(() => { btm.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  const trigEnd = useCallback((won: boolean) => { updateStats(won); if (won) setShowWin(true); else setShowLose(true); }, [updateStats]);
  const sys = useCallback((s: string) => {
    setMsgs(p => [...p, { sender: "⚙️", text: s, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; });
  }, []);

  // Socket
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"], reconnection: true, reconnectionAttempts: 50, timeout: 30000 });
    sock.current = s;
    s.on("connect", () => setStatus("on"));
    s.on("connect_error", () => setStatus("err"));
    s.on("disconnect", () => setStatus("off"));
    s.on("roomCreated", ({ code }: any) => { setRoom(code); setWaiting(true); setMode("online"); setView("game"); setGameOver(null); setMsgs([]); setTab("board"); setShowWin(false); setShowLose(false); setLastIdx(-1); });
    s.on("gameStarted", ({ p1, p2 }: any) => { setWaiting(false); setMode("online"); setView("game"); setGameOver(null); sys(`🎮 ${p1} vs ${p2}`); });
    s.on("gameState", (d: any) => {
      setBoard(prev => { if (d.board?.length > prev.length) { setLastIdx(d.board.length - 1); playTileSound(); } return d.board || []; });
      setHand(d.hand || []); setPileCount(d.pileCount || 0); setOppCount(d.opponentHandCount || 0);
      setOppName(d.opponentName || "..."); setMyTurn(d.turn === d.playerIndex);
      if (d.started) { setWaiting(false); setView("game"); setMode("online"); }
      if (d.winner && !gameOver) { trigEnd(d.winner.index === d.playerIndex); setGameOver(d.winner.index === d.playerIndex ? "W" : "L"); }
    });
    s.on("joinError", (m: string) => setJoinErr(m));
    s.on("tilePlayed", ({ playerName: pn, tile }: any) => sys(`🎯 ${pn}: [${tile[0]}|${tile[1]}]`));
    s.on("playerPassed", ({ name: n }: any) => sys(`⏭️ ${n}`));
    s.on("chatMsg", (m: Msg) => { setMsgs(p => [...p, m]); setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; }); });
    s.on("opponentLeft", () => { sys("❌ Opponent left"); setGameOver("L"); });
    s.on("gameRestarted", () => { setGameOver(null); setShowWin(false); setShowLose(false); setLastIdx(-1); sys("🔄 New game!"); });
    s.on("playError", (m: string) => sys(`❌ ${m}`));
    return () => { s.removeAllListeners(); s.disconnect(); };
  }, [sys, trigEnd, gameOver]);

  // Online handlers
  const oCreate = () => { if (status !== "on") { setJoinErr("Server starting..."); fetch(SOCKET_URL).catch(() => {}); return; } setJoinErr(""); sock.current?.emit("createRoom", { playerName }); };
  const oJoin = () => { const c = input.trim().toUpperCase(); if (!c) { setJoinErr("Enter code!"); return; } if (status !== "on") { setJoinErr("Server starting..."); return; } setJoinErr(""); setRoom(c); setMode("online"); setMsgs([]); setTab("board"); setGameOver(null); sock.current?.emit("joinRoom", { code: c, playerName }); };
  const oPlay = (i: number) => { if (myTurn && !gameOver) sock.current?.emit("playTile", { tileIndex: i }); };
  const oDraw = () => { if (myTurn && !gameOver) sock.current?.emit("drawTile"); };
  const oPass = () => { if (myTurn && !gameOver) sock.current?.emit("passTurn"); };
  const oChat = (s: string) => { if (s.trim()) { sock.current?.emit("sendChat", { text: s.trim() }); setMsg(""); setShowEm(false); } };
  const oRestart = () => { setShowWin(false); setShowLose(false); setLastIdx(-1); sock.current?.emit("restartGame"); };

  // Bot handlers
  const startBot = () => {
    const a = shuf(allT()); setHand(a.slice(0, 7)); setBotHand(a.slice(7, 14)); setPile(a.slice(14));
    setBoard([]); setMyTurn(true); setGameOver(null); setMode("bot"); setView("game"); setRoom("BOT");
    setMsgs([]); setTab("board"); setOppName("Bot 🤖"); setOppCount(7); setPileCount(14);
    setShowWin(false); setShowLose(false); setLastIdx(-1);
    setTimeout(() => sys("🤖 Your turn!"), 100);
  };

  const bPlay = (tile: Tile, idx: number) => {
    if (!myTurn || gameOver) return;
    if (!board.length) {
      const nb = [{ tile, flipped: false }]; setBoard(nb); setLastIdx(0); playTileSound();
      const nh = hand.filter((_, i) => i !== idx); setHand(nh);
      if (!nh.length) { setGameOver("W"); trigEnd(true); return; }
      setMyTurn(false); setTimeout(() => botMove(nb), 800); return;
    }
    const ends = getEnds(board); const side = canPlay(tile, board, ends);
    if (!side) { sys("❌ Doesn't fit!"); return; }
    const fl = shouldFlip(tile, side, ends, false);
    const entry: BE = { tile, flipped: fl };
    const nb = side === "left" ? [entry, ...board] : [...board, entry];
    setBoard(nb); setLastIdx(side === "left" ? 0 : nb.length - 1); playTileSound();
    const nh = hand.filter((_, i) => i !== idx); setHand(nh);
    if (!nh.length) { setGameOver("W"); trigEnd(true); return; }
    setMyTurn(false); setTimeout(() => botMove(nb), 800);
  };

  const botMove = (cb: BE[]) => {
    setBotHand(prev => {
      const ends = getEnds(cb);
      let bi = -1, bs: "left" | "right" | null = null, bsc = -1;
      for (let i = 0; i < prev.length; i++) {
        const s = canPlay(prev[i], cb, ends);
        if (s) { const sc = (prev[i][0] === prev[i][1] ? 10 : 0) + prev[i][0] + prev[i][1]; if (sc > bsc) { bsc = sc; bi = i; bs = s; } }
      }
      if (bi === -1) {
        setPile(cp => {
          if (!cp.length) { sys("🤖 Bot passes"); setMyTurn(true); return cp; }
          const np = [...cp]; const dr = np.pop()!; setPileCount(np.length);
          const ds = canPlay(dr, cb, ends);
          if (ds) {
            const fl = shouldFlip(dr, ds, ends, false);
            const nb = ds === "left" ? [{ tile: dr, flipped: fl }, ...cb] : [...cb, { tile: dr, flipped: fl }];
            setBoard(nb); setLastIdx(ds === "left" ? 0 : nb.length - 1); playTileSound();
            sys(`🤖 [${dr[0]}|${dr[1]}]`); setOppCount(prev.length);
            if (!prev.length) { setGameOver("L"); trigEnd(false); }
            setMyTurn(true); return np;
          }
          setBotHand(bh => [...bh, dr]); setOppCount(prev.length + 1); setMyTurn(true); return np;
        });
        return prev;
      }
      const bt = prev[bi];
      const fl = shouldFlip(bt, bs!, ends, cb.length === 0);
      const nb = bs === "left" ? [{ tile: bt, flipped: fl }, ...cb] : [...cb, { tile: bt, flipped: fl }];
      setBoard(nb); setLastIdx(bs === "left" ? 0 : nb.length - 1); playTileSound();
      sys(`🤖 [${bt[0]}|${bt[1]}]`);
      const nbh = prev.filter((_, i) => i !== bi);
      setOppCount(nbh.length);
      if (!nbh.length) { setGameOver("L"); trigEnd(false); }
      setMyTurn(true); return nbh;
    });
  };

  const bDraw = () => { if (!myTurn || gameOver || !pile.length) return; const np = [...pile]; const d = np.pop()!; setPile(np); setHand(p => [...p, d]); setPileCount(np.length); sys(`📦 [${d[0]}|${d[1]}]`); };
  const bPass = () => { if (!myTurn || gameOver) return; setMyTurn(false); sys("⏭️ Passed"); setTimeout(() => botMove(board), 800); };
  const bChat = (s: string) => {
    if (!s.trim()) return;
    setMsgs(p => [...p, { sender: playerName, text: s.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setMsg(""); setShowEm(false);
    setTimeout(() => {
      const r = ["😂", "🔥", "💯", "💪", "☀️", "👏", "gg", "😈"];
      setMsgs(p => [...p, { sender: "🤖", text: r[Math.floor(Math.random() * r.length)], time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    }, 800 + Math.random() * 1200);
  };

  // Unified
  const play = (t: Tile, i: number) => mode === "bot" ? bPlay(t, i) : oPlay(i);
  const draw = () => mode === "bot" ? bDraw() : oDraw();
  const pass = () => mode === "bot" ? bPass() : oPass();
  const sendC = (s: string) => mode === "bot" ? bChat(s) : oChat(s);
  const restart = () => mode === "bot" ? startBot() : oRestart();
  const copy = () => { navigator.clipboard.writeText(room).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const canAny = () => !board.length || hand.some(t => canPlay(t, board, getEnds(board)) !== null);
  const cPile = mode === "bot" ? pile.length : pileCount;
  const cOpp = mode === "bot" ? botHand.length : oppCount;

  const HandTile = ({ v, hl, sm }: { v: Tile; hl?: boolean; sm?: boolean }) => (
    <div className={`${sm ? "w-[34px] h-[68px]" : "w-[42px] h-[84px]"} rounded-lg flex flex-col items-center justify-around py-0.5 shadow-lg cursor-pointer select-none border-2 transition-all duration-200 active:scale-90 sm:hover:-translate-y-2 ${hl ? "border-yellow-400 ring-2 ring-yellow-400/60 shadow-yellow-500/30" : "border-[#C4B998]"}`}
      style={{ background: "linear-gradient(160deg, #FFFEF5, #F5EDDA)" }}>
      <Dots v={v[0]} sz={sm ? 13 : 17} /><div className="w-[60%] h-px bg-[#C4B998]" /><Dots v={v[1]} sz={sm ? 13 : 17} />
    </div>
  );

  const BackTile = () => (
    <div className="w-[16px] h-[28px] sm:w-[20px] sm:h-[36px] rounded bg-gradient-to-br from-[#8B0000] to-[#5C0000] border border-[#3D0000] shadow flex items-center justify-center flex-shrink-0">
      <div className="w-[50%] h-[50%] border border-[#FFD700]/20 rounded-sm" />
    </div>
  );

  if (!authLoaded) return <div className="min-h-screen bg-black flex items-center justify-center"><Sun s={60} c="animate-spin opacity-50" /></div>;

  // ==================== LOGIN ====================
  if (!account) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 z-0"><div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" /><div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" /><div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" /><div className="absolute inset-0 flex items-center justify-center"><Sun s={300} c="opacity-30" /></div></div>
        <div className="fixed inset-0 z-[1] bg-black/40" />
        <div className="relative z-10 w-full max-w-[380px] px-4">
          <div className="text-center mb-8"><Sun s={90} c="mx-auto mb-3 opacity-90" /><h1 className="text-6xl font-black text-white italic drop-shadow-[0_4px_15px_rgba(0,0,0,0.6)]">DOMINO</h1><p className="text-white/50 text-sm mt-2">Kurdish Domino ☀️</p></div>
          <div className="bg-gradient-to-b from-white/[0.12] to-white/[0.04] backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
            <div className="flex">
              <button onClick={() => { setAuthMode("create"); setAuthStep(1); setAuthErr(""); }} className={`flex-1 py-4 text-sm font-black ${authMode === "create" ? "bg-yellow-500 text-black" : "text-white/30"}`}>✨ CREATE</button>
              <button onClick={() => { setAuthMode("login"); setAuthStep(2); setAuthErr(""); }} className={`flex-1 py-4 text-sm font-black ${authMode === "login" ? "bg-yellow-500 text-black" : "text-white/30"}`}>🔑 LOGIN</button>
            </div>
            <div className="p-6">
              {authMode === "create" && authStep === 1 && (
                <div>
                  <p className="text-white/60 text-sm text-center mb-5">Choose your avatar</p>
                  <div className="flex justify-center mb-5"><div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-6xl shadow-2xl border-4 border-yellow-300">{authAvatar}</div></div>
                  <div className="grid grid-cols-8 gap-2.5 mb-6">{avatars.map(a => (<button key={a} onClick={() => setAuthAvatar(a)} className={`text-2xl p-2 rounded-xl ${authAvatar === a ? "bg-yellow-500 scale-110 ring-2 ring-yellow-300" : "bg-white/5 active:scale-95"}`}>{a}</button>))}</div>
                  <button onClick={() => setAuthStep(2)} className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black py-4 rounded-2xl">Next →</button>
                </div>
              )}
              {authStep === 2 && (
                <div>
                  {authMode === "create" && <div className="flex justify-center mb-5"><button onClick={() => setAuthStep(1)} className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-4xl border-2 border-yellow-300 active:scale-95">{authAvatar}</button></div>}
                  {authMode === "login" && <div className="flex justify-center mb-5"><div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-4xl border-2 border-blue-300">🔑</div></div>}
                  <div className="relative mb-4"><div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">👤</div><input type="text" placeholder="Username" value={authUser} onChange={e => { setAuthUser(e.target.value); setAuthErr(""); }} className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/10 border border-white/10 text-white font-bold text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-yellow-500/50" /></div>
                  <div className="relative mb-4"><div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">🔒</div><input type="password" placeholder="Password" value={authPass} onChange={e => { setAuthPass(e.target.value); setAuthErr(""); }} onKeyDown={e => { if (e.key === "Enter") handleAuth(); }} className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/10 border border-white/10 text-white font-bold text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-yellow-500/50" /></div>
                  {authErr && <p className="text-red-400 text-sm text-center mb-4 font-bold">⚠️ {authErr}</p>}
                  <button onClick={handleAuth} className={`w-full font-black py-4 rounded-2xl mb-3 ${authMode === "create" ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black" : "bg-gradient-to-r from-blue-500 to-blue-700 text-white"}`}>{authMode === "create" ? "✨ Create Account" : "🔑 Login"}</button>
                  <button onClick={() => { setAuthMode(authMode === "login" ? "create" : "login"); setAuthStep(authMode === "login" ? 1 : 2); setAuthErr(""); }} className="w-full text-white/30 text-xs text-center py-2">{authMode === "login" ? "Need account? →" : "Have account? →"}</button>
                </div>
              )}
              <button onClick={() => saveAccount({ username: "Guest_" + Math.floor(Math.random() * 999), wins: 0, losses: 0, games: 0, avatar: "👤", created: Date.now(), diamonds: 50, ownedSkins: ["classic"], equippedSkin: "classic", inTournament: false })} className="w-full text-white/15 text-[11px] text-center py-2 mt-1">Play as Guest →</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ==================== MENU ====================
  if (view === "menu") {
    return (
      <main className="min-h-[100dvh] flex flex-col relative overflow-hidden">
        {showWin && <WinOverlay onClose={() => setShowWin(false)} />}
        {showLose && <LoseOverlay onClose={() => setShowLose(false)} />}
        <div className="fixed inset-0 z-0"><div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" /><div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" /><div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" /><div className="absolute inset-0 flex items-center justify-center"><Sun s={350} c="opacity-15" /></div></div>
        <div className="fixed inset-0 z-[1] bg-black/50" />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-3 py-2.5 bg-black/40 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xl border-2 border-yellow-300/50 shadow-lg">{account.avatar}</div>
            <div><div className="text-white font-bold text-sm">{account.username}</div><div className="text-white/30 text-[10px]">🏆{account.wins} 💀{account.losses}</div></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 rounded-full"><span className="text-sm">💎</span><span className="text-white font-black text-sm">{account.diamonds}</span></div>
            <button onClick={logout} className="text-white/20 bg-white/5 p-1.5 rounded-lg text-sm">↪</button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="relative z-10 flex bg-white/[0.04] backdrop-blur-md border-b border-white/5">
          {(["play", "champions", "store"] as const).map(tb => (
            <button key={tb} onClick={() => { setMenuTab(tb); setShowTournament(false); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-wider ${menuTab === tb ? "text-yellow-400 border-b-2 border-yellow-500 bg-yellow-500/10" : "text-white/25"}`}>
              {tb === "play" ? "PLAY" : tb === "champions" ? "CHAMPIONS" : "STORE"}
            </button>
          ))}
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto">
          {/* PLAY TAB */}
          {menuTab === "play" && !showTournament && (
            <div className="p-4 max-w-[500px] mx-auto">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={startBot} className="bg-gradient-to-b from-red-500/30 to-red-900/50 backdrop-blur rounded-2xl p-5 border border-red-500/20 text-left active:scale-[0.97] transition-transform">
                  <div className="w-14 h-14 rounded-full border-2 border-red-500/40 flex items-center justify-center mb-3"><span className="text-2xl">▶️</span></div>
                  <div className="text-white font-black text-sm">QUICK PLAY</div>
                  <div className="text-white/30 text-[10px] mt-1">Classic vs Bot.</div>
                  <div className="mt-4 bg-red-500/20 text-red-300 text-[11px] font-black text-center py-2 rounded-xl border border-red-500/30">PLAY</div>
                </button>
                <button onClick={oCreate} className="bg-gradient-to-b from-yellow-500/20 to-yellow-900/40 backdrop-blur rounded-2xl p-5 border border-yellow-500/20 text-left active:scale-[0.97] transition-transform">
                  <div className="w-14 h-14 rounded-full border-2 border-yellow-500/40 flex items-center justify-center mb-3"><span className="text-2xl">👑</span></div>
                  <div className="text-white font-black text-sm">RANKED</div>
                  <div className="text-white/30 text-[10px] mt-1">Create & play online.</div>
                  <div className="mt-4 bg-yellow-500/20 text-yellow-300 text-[11px] font-black text-center py-2 rounded-xl border border-yellow-500/30">CREATE</div>
                </button>
                <button onClick={startBot} className="bg-gradient-to-b from-orange-500/20 to-orange-900/40 backdrop-blur rounded-2xl p-5 border border-orange-500/20 text-left active:scale-[0.97] transition-transform">
                  <div className="w-14 h-14 rounded-full border-2 border-orange-500/40 flex items-center justify-center mb-3"><span className="text-2xl">⚡</span></div>
                  <div className="text-white font-black text-sm">TURBO</div>
                  <div className="text-white/30 text-[10px] mt-1">Fast-paced game.</div>
                  <div className="mt-4 bg-orange-500/20 text-orange-300 text-[11px] font-black text-center py-2 rounded-xl border border-orange-500/30">PLAY</div>
                </button>
                <button onClick={() => setShowTournament(true)} className="bg-gradient-to-b from-green-500/15 to-green-900/30 backdrop-blur rounded-2xl p-5 border border-green-500/20 text-left active:scale-[0.97] transition-transform">
                  <div className="w-14 h-14 rounded-full border-2 border-green-500/40 flex items-center justify-center mb-3"><span className="text-2xl">🏆</span></div>
                  <div className="text-white font-black text-sm">TOURNAMENT</div>
                  <div className="text-white/30 text-[10px] mt-1">Win prizes!</div>
                  <div className="mt-4 bg-green-500/20 text-green-300 text-[11px] font-black text-center py-2 rounded-xl border border-green-500/30">VIEW</div>
                </button>
              </div>

              {/* CREATE ROOM */}
              <button onClick={oCreate} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black py-4 rounded-2xl text-base shadow-xl active:scale-[0.97] flex items-center justify-center gap-3 border border-green-400/30 mb-3">
                <span className="text-xl">🏠</span><span>CREATE ROOM</span>
              </button>

              {/* JOIN */}
              <div className="bg-white/[0.05] backdrop-blur rounded-2xl p-4 border border-purple-500/20 mb-3">
                <div className="flex items-center gap-2 mb-3"><span className="text-lg">🚪</span><span className="text-white/50 text-xs font-black">JOIN FRIEND</span></div>
                <div className="flex gap-2">
                  <input type="text" placeholder="CODE..." value={input} onChange={e => setInput(e.target.value.toUpperCase())} className="flex-1 p-3.5 rounded-xl text-center font-black uppercase text-black bg-white/90 text-lg tracking-[0.3em]" maxLength={5} />
                  <button onClick={oJoin} className="bg-gradient-to-r from-purple-500 to-purple-700 text-white font-black px-7 rounded-xl active:scale-95 shadow-lg">JOIN</button>
                </div>
                {joinErr && <p className="text-red-400 text-[10px] text-center mt-2 font-bold">⚠️ {joinErr}</p>}
              </div>

              {status !== "on" && <div className="bg-yellow-500/10 rounded-xl p-3 text-center"><span className="text-yellow-300 text-xs font-bold">⏳ Server starting... </span><button onClick={() => fetch(SOCKET_URL).catch(() => {})} className="text-yellow-400 text-xs underline">Retry</button></div>}
            </div>
          )}

          {/* TOURNAMENT */}
          {menuTab === "play" && showTournament && (
            <div className="p-4 max-w-[500px] mx-auto">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setShowTournament(false)} className="text-white/50 bg-white/10 px-3 py-1.5 rounded-xl text-xs font-bold">← Back</button>
                <div className="text-white font-black text-lg">🏆 TOURNAMENT</div>
                <div className="bg-red-500/20 px-3 py-1 rounded-full text-orange-300 text-xs font-bold">⏰ 23:59:02</div>
              </div>
              <div className="bg-white/[0.05] backdrop-blur rounded-2xl border border-yellow-500/20 overflow-hidden mb-4">
                <div className="bg-yellow-500/10 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded">SOON</span><span className="text-white font-black text-lg">KURDISH CUP</span></div>
                  <div className="flex items-center gap-2"><span className="bg-cyan-500/20 text-cyan-400 text-xs font-bold px-2 py-0.5 rounded border border-cyan-500/30">👥 {getAllPlayers().filter(p => p.inTournament).length}/1000</span><span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded border border-green-500/30">FREE</span></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/10">
                  <div className="text-yellow-400 text-xs font-black mb-3">🏆 PRIZES</div>
                  <div className="space-y-2.5"><div className="flex justify-between"><span className="text-yellow-400 font-black">🥇 1ST</span><span className="text-cyan-400 font-bold">💎 100k</span></div><div className="flex justify-between"><span className="text-gray-300 font-black">🥈 2ND</span><span className="text-cyan-400 font-bold">💎 50K</span></div><div className="flex justify-between"><span className="text-orange-400 font-black">🥉 3RD</span><span className="text-cyan-400 font-bold">💎 10K</span></div></div>
                </div>
                <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/10">
                  <div className="text-yellow-400 text-xs font-black mb-3">👥 PLAYERS</div>
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto">{getAllPlayers().filter(p => p.inTournament).map(p => (<div key={p.username} className="flex items-center gap-2 text-xs text-white/60"><span>{p.avatar}</span><span>{p.username}</span></div>))}{getAllPlayers().filter(p => p.inTournament).length === 0 && <div className="text-white/20 text-[10px]">No players</div>}</div>
                </div>
              </div>
              <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/10 mb-4">
                <div className="text-yellow-400 text-xs font-black mb-3">📋 RULES</div>
                <div className="grid grid-cols-2 gap-2 text-sm"><div className="flex justify-between text-white/40"><span>MODE</span><span className="text-white font-bold">Ranked</span></div><div className="flex justify-between text-white/40"><span>TEAM</span><span className="text-white font-bold">1v1</span></div><div className="flex justify-between text-white/40"><span>ENTRY</span><span className="text-green-400 font-bold">Free</span></div><div className="flex justify-between text-white/40"><span>TIMER</span><span className="text-white font-bold">15s</span></div></div>
              </div>
              <button onClick={toggleTournament} className={`w-full font-black py-4 rounded-2xl text-sm ${account.inTournament ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-gradient-to-r from-green-500 to-green-700 text-white shadow-lg"}`}>
                {account.inTournament ? "↪ LEAVE TOURNAMENT" : "✅ JOIN TOURNAMENT"}
              </button>
            </div>
          )}

          {/* CHAMPIONS */}
          {menuTab === "champions" && (
            <div className="p-4 max-w-[500px] mx-auto">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-4xl border-2 border-yellow-300 shadow-xl">{account.avatar}</div>
                  <div className="flex-1"><div className="text-white font-black text-lg">{account.username}</div><div className="text-white/40 text-xs">Rank #{getAllPlayers().findIndex(p => p.username === account.username) + 1 || "?"}</div></div>
                  <div className="grid grid-cols-3 gap-4 text-center"><div><div className="text-green-400 font-black text-xl">{account.wins}</div><div className="text-white/30 text-[9px]">W</div></div><div><div className="text-red-400 font-black text-xl">{account.losses}</div><div className="text-white/30 text-[9px]">L</div></div><div><div className="text-blue-400 font-black text-xl">{account.games}</div><div className="text-white/30 text-[9px]">G</div></div></div>
                </div>
                <div className="mt-3 h-2.5 bg-black/30 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-500 to-yellow-500 rounded-full" style={{ width: `${account.games > 0 ? (account.wins / account.games) * 100 : 0}%` }} /></div>
              </div>
              <div className="bg-white/[0.04] rounded-2xl border border-white/10 overflow-hidden">
                <div className="bg-white/5 px-4 py-2.5 text-white/40 text-xs font-black">LEADERBOARD</div>
                {getAllPlayers().map((p, idx) => {
                  const isMe = p.username === account.username;
                  const wr = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0;
                  return (
                    <div key={p.username} className={`flex items-center gap-2.5 px-4 py-2.5 border-b border-white/5 ${isMe ? "bg-yellow-500/10" : ""}`}>
                      <div className="w-7 text-center">{idx < 3 ? ["🥇", "🥈", "🥉"][idx] : <span className="text-white/20 text-xs">#{idx + 1}</span>}</div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 ${idx === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600" : idx === 1 ? "bg-gradient-to-br from-gray-300 to-gray-500" : idx === 2 ? "bg-gradient-to-br from-orange-400 to-orange-700" : "bg-white/10"}`}>{p.avatar}</div>
                      <div className="flex-1 min-w-0"><div className={`font-bold text-xs truncate ${isMe ? "text-yellow-400" : "text-white"}`}>{p.username}</div></div>
                      <div className="text-green-400 text-xs font-bold w-8 text-center">{p.wins}</div>
                      <div className="text-red-400 text-xs font-bold w-8 text-center">{p.losses}</div>
                      <div className={`text-xs font-black w-10 text-center ${wr >= 60 ? "text-green-400" : wr >= 40 ? "text-yellow-400" : "text-red-400"}`}>{wr}%</div>
                    </div>
                  );
                })}
                {getAllPlayers().length === 0 && <div className="text-white/15 text-sm text-center py-10">No players yet</div>}
              </div>
            </div>
          )}

          {/* STORE */}
          {menuTab === "store" && (
            <div className="p-4 max-w-[500px] mx-auto">
              <div className="flex mb-4 bg-white/[0.04] rounded-xl overflow-hidden border border-white/10">
                <button onClick={() => setStoreTab("skins")} className={`flex-1 py-3 text-sm font-black ${storeTab === "skins" ? "bg-yellow-500/20 text-yellow-400" : "text-white/25"}`}>SKINS</button>
                <button onClick={() => setStoreTab("gems")} className={`flex-1 py-3 text-sm font-black ${storeTab === "gems" ? "bg-yellow-500/20 text-yellow-400" : "text-white/25"}`}>GEMS</button>
              </div>
              {storeTab === "skins" && (
                <div>
                  <div className="flex items-center gap-2 mb-4"><span className="text-white/40 text-xs font-black">DAILY ITEMS</span><span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-bold px-2 py-0.5 rounded border border-yellow-500/30">REFRESHES IN 12H</span></div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SKINS.map(skin => {
                      const owned = account.ownedSkins.includes(skin.id);
                      const equipped = account.equippedSkin === skin.id;
                      const canBuyIt = account.diamonds >= skin.price;
                      return (
                        <div key={skin.id} className={`bg-white/[0.04] rounded-2xl border overflow-hidden ${equipped ? "border-green-500/40 ring-1 ring-green-500/20" : "border-white/10"}`}>
                          <div className={`h-24 bg-gradient-to-br ${skin.bg} flex items-center justify-center text-5xl`}>{skin.emoji}</div>
                          <div className="p-3">
                            <div className="text-white font-bold text-xs">{skin.name}</div>
                            <div className="text-white/30 text-[10px]">{skin.desc}</div>
                            {equipped ? <div className="mt-2 bg-green-500/20 text-green-400 text-[10px] font-black text-center py-2 rounded-xl border border-green-500/30">✅ EQUIPPED</div>
                              : owned ? <button onClick={() => equipSkin(skin.id)} className="mt-2 w-full bg-blue-500/15 text-blue-400 text-[10px] font-black text-center py-2 rounded-xl border border-blue-500/30">EQUIP</button>
                                : skin.price === 0 ? <div className="mt-2 bg-white/5 text-white/20 text-[10px] font-black text-center py-2 rounded-xl">DEFAULT</div>
                                  : <button onClick={() => buySkin(skin.id, skin.price)} disabled={!canBuyIt} className={`mt-2 w-full text-[10px] font-black text-center py-2 rounded-xl border flex items-center justify-center gap-1 ${canBuyIt ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" : "bg-white/5 text-white/15 border-white/5 cursor-not-allowed"}`}>💎 {skin.price}</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {storeTab === "gems" && (
                <div className="space-y-3">
                  <p className="text-white/40 text-xs text-center mb-4">Win games to earn diamonds!<br /><span className="text-cyan-400">💎 100 per win</span> • <span className="text-white/30">💎 10 per loss</span></p>
                  {[{ g: 500, n: "Starter Pack", b: "" }, { g: 1500, n: "Pro Pack", b: "+200 BONUS" }, { g: 5000, n: "Ultimate", b: "+1000 BONUS" }].map((pk, i) => (
                    <div key={i} className="bg-white/[0.04] rounded-2xl border border-white/10 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3"><span className="text-4xl">💎</span><div><div className="text-white font-bold">{pk.n}</div><div className="text-cyan-400 text-sm font-bold">{pk.g} Gems {pk.b && <span className="text-yellow-400">{pk.b}</span>}</div></div></div>
                      <div className="text-white/20 text-xs font-bold bg-white/5 px-4 py-2 rounded-xl">PLAY TO EARN</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    );
  }

  // ==================== GAME ====================
  return (
    <main className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      {showWin && <WinOverlay onClose={() => setShowWin(false)} />}
      {showLose && <LoseOverlay onClose={() => setShowLose(false)} />}

      <div className="fixed inset-0 z-0"><div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" /><div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" /><div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" /><div className="absolute inset-0 flex items-center justify-center"><Sun s={400} c="opacity-[0.08]" /></div></div>
      <div className="fixed inset-0 z-[1] bg-black/40" />

      {/* Game top bar */}
      <div className="relative z-10 flex items-center justify-between px-2 py-1.5 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button onClick={() => { setView("menu"); setWaiting(false); setShowWin(false); setShowLose(false); }} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm active:bg-white/20">↩</button>
          <span className="bg-yellow-500 text-black px-2.5 py-1 rounded-lg font-black text-[11px]">{room}</span>
          {room !== "BOT" && <button onClick={copy} className="text-white/50 text-[10px] bg-white/10 px-2 py-1 rounded-lg">{copied ? "✅" : "📋"}</button>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-cyan-500/20 border border-cyan-500/30 px-2.5 py-1 rounded-full"><span className="text-[10px]">💎</span><span className="text-white font-bold text-xs">{account.diamonds}</span></div>
          <button onClick={() => { setShowChat(!showChat); if (!showChat) { setTab("chat"); setUnread(0); } else { setTab("board"); } }} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm relative active:bg-white/20">
            💬{unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[7px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{unread}</span>}
          </button>
        </div>
      </div>

      {waiting && (
        <div className="relative z-10 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-center py-2.5 text-[11px]">
          ⏳ Share code: <span className="bg-black text-white px-3 py-1 rounded-lg font-mono mx-1 text-base tracking-widest">{room}</span>
          <button onClick={copy} className="bg-white/50 px-2 py-0.5 rounded text-[10px] font-bold ml-1">{copied ? "✅" : "📋"}</button>
        </div>
      )}

      {gameOver && (
        <div className={`relative z-10 font-black text-center py-3 text-base ${gameOver === "W" ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black" : "bg-gradient-to-r from-red-500 to-red-700 text-white"}`}>
          {gameOver === "W" ? "🏆 YOU WIN! 💎+100" : "💀 YOU LOSE 🤣 💎+10"}
          <button onClick={restart} className="ml-3 bg-black text-white px-4 py-1.5 rounded-xl text-xs font-bold">🔄</button>
        </div>
      )}

      {/* Mobile tabs */}
      <div className="relative z-10 flex sm:hidden">
        <button onClick={() => { setTab("board"); setShowChat(false); }} className={`flex-1 py-2 text-xs font-bold ${tab === "board" ? "bg-green-900/50 text-green-400 border-b-2 border-green-400" : "text-white/30 bg-black/30"}`}>🎮 Game</button>
        <button onClick={() => { setTab("chat"); setUnread(0); setShowChat(true); }} className={`flex-1 py-2 text-xs font-bold relative ${tab === "chat" ? "bg-green-900/50 text-green-400 border-b-2 border-green-400" : "text-white/30 bg-black/30"}`}>
          💬 Chat{unread > 0 && tab !== "chat" && <span className="absolute top-1 right-[30%] bg-red-500 text-white text-[7px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-bounce">{unread}</span>}
        </button>
      </div>

      <div className="relative z-10 flex-1 flex min-h-0">
        {/* Board */}
        <div className={`flex-1 flex flex-col min-h-0 ${tab === "chat" ? "hidden sm:flex" : "flex"}`}>
          {/* Opponent */}
          <div className="bg-black/40 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-red-500/50 bg-black/30 flex items-center justify-center text-sm">👤</div>
              <div><div className="text-white font-bold text-xs">{oppName}</div><div className="text-white/30 text-[9px]">{cOpp} tiles</div></div>
            </div>
            <div className="flex gap-0.5 overflow-hidden max-w-[50%]">{[...Array(Math.min(cOpp, 14))].map((_, i) => <BackTile key={i} />)}</div>
          </div>

          {/* Green table */}
          <div className="flex-1 relative overflow-auto" style={{
            background: "radial-gradient(ellipse at center, rgba(40,110,50,0.85) 0%, rgba(25,80,35,0.9) 50%, rgba(15,55,20,0.95) 100%)",
            boxShadow: "inset 0 0 100px rgba(0,0,0,0.4)",
          }}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]/10" />
              <div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]/10" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Sun s={200} c="opacity-[0.04]" /></div>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ED2024] via-[#FFD700] to-[#21A038]" />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#21A038] via-[#FFD700] to-[#ED2024]" />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-pink-500/30 bg-black/20 flex items-center justify-center text-xs opacity-30">👤</div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-yellow-500/30 bg-black/20 flex items-center justify-center text-xs opacity-30">👤</div>
            <div className="absolute inset-0 flex items-center justify-center overflow-auto p-6 z-10">
              {!board.length ? (
                <div className="text-white/15 text-center"><Sun s={60} c="mx-auto mb-3 opacity-15" /><div className="text-sm font-bold">{waiting ? "Waiting..." : "Play first tile!"}</div></div>
              ) : (<DominoChain board={board} lastIdx={lastIdx} />)}
            </div>
          </div>

          {/* Player bar */}
          <div className="bg-black/50 px-3 py-2 flex items-center justify-between border-t border-yellow-500/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-sm">{account.avatar}</div>
              <div><div className="text-white font-bold text-xs">{playerName}</div><div className="text-white/30 text-[9px]">{hand.length} tiles</div></div>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black ${myTurn ? "bg-green-500 text-black" : "bg-red-500/60 text-white"}`}>{myTurn ? "YOUR TURN" : "WAITING..."}</div>
            <div className="flex gap-1.5">
              <button onClick={draw} disabled={!myTurn || !!gameOver || cPile === 0} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-20 active:bg-blue-500">📦</button>
              {!canAny() && myTurn && !gameOver && cPile === 0 && <button onClick={pass} className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold active:bg-orange-500">⏭️</button>}
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className={`${tab === "board" && !showChat ? "hidden sm:flex" : "flex"} w-full sm:w-56 md:w-64 bg-black/60 backdrop-blur-md flex-col border-l border-white/5`}>
          <div className="bg-white/5 px-4 py-2.5 flex items-center justify-between">
            <span className="text-white/40 font-bold text-xs">💬 Chat</span>
            <button onClick={() => { setShowChat(false); setTab("board"); setUnread(0); }} className="text-white/30 text-xs sm:hidden">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
            {!msgs.length && <div className="text-white/10 text-xs text-center mt-10">No messages yet</div>}
            {msgs.map((m, i) => (
              <div key={i} className={`p-2 rounded-xl text-[11px] ${m.sender === "⚙️" ? "bg-blue-500/10 text-blue-300/70 italic" : m.sender.includes("🤖") ? "bg-red-500/10 text-red-300/70" : "bg-white/5 text-white/70"}`}>
                <div className="flex justify-between mb-0.5"><span className="font-bold text-yellow-400/70 text-[10px]">{m.sender}</span><span className="text-white/10 text-[8px]">{m.time}</span></div>
                <div className="break-words">{m.text}</div>
              </div>
            ))}
            <div ref={btm} />
          </div>
          {showEm && (
            <div className="grid grid-cols-6 gap-1 p-2 bg-black/40 mx-2 rounded-xl max-h-24 overflow-y-auto border border-white/5">
              {emos.map(e => <button key={e} onClick={() => setMsg(p => p + e)} className="text-base p-1 rounded active:bg-white/20">{e}</button>)}
            </div>
          )}
          <div className="flex gap-1.5 p-2">
            <button onClick={() => setShowEm(!showEm)} className={`px-2 py-1.5 rounded-xl text-base ${showEm ? "bg-yellow-500" : "bg-white/10"}`}>😊</button>
            <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendC(msg); }} className="flex-1 bg-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-yellow-500/50 placeholder-white/15 min-w-0" placeholder="Type..." />
            <button onClick={() => sendC(msg)} className="bg-green-600 px-3 py-1.5 rounded-xl text-xs text-white font-bold active:bg-green-500">➤</button>
          </div>
        </div>
      </div>

      {/* ✅ WOODEN RACK - Hand area met houten textuur */}
      <div className="relative z-10">
        <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
        <div className="relative overflow-hidden" style={{
          background: "linear-gradient(180deg, #5C4033 0%, #6B4C3B 15%, #7A5A48 30%, #8B6B56 50%, #7A5A48 70%, #6B4C3B 85%, #5C4033 100%)",
          boxShadow: "inset 0 2px 10px rgba(0,0,0,0.5), inset 0 -2px 10px rgba(0,0,0,0.3)",
        }}>
          {/* Hout textuur */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(0,0,0,0.1) 8px, rgba(0,0,0,0.1) 9px), repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(0,0,0,0.05) 30px, rgba(0,0,0,0.05) 31px)`,
          }} />
          {/* Steen patroon */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 21px)`,
          }} />
          {/* Metalen randen */}
          <div className="absolute left-0 top-0 bottom-0 w-2" style={{ background: "linear-gradient(90deg, #3a3a4a, #5a5a6a, #3a3a4a)" }} />
          <div className="absolute right-0 top-0 bottom-0 w-2" style={{ background: "linear-gradient(90deg, #3a3a4a, #5a5a6a, #3a3a4a)" }} />

          {!canAny() && myTurn && !gameOver && cPile > 0 && (
            <div className="text-center text-red-400/90 text-[10px] font-bold pt-2 animate-pulse">⚠️ No matching tile - draw!</div>
          )}

          <div className="flex justify-center gap-1.5 overflow-x-auto py-3 px-4" style={{ scrollbarWidth: "none" }}>
            {hand.map((t, i) => {
              const ends = getEnds(board);
              const ok = !board.length || canPlay(t, board, ends) !== null;
              return (
                <div key={`${t[0]}-${t[1]}-${i}`} onClick={() => play(t, i)}
                  className={`flex-shrink-0 transition-all duration-200 ${!myTurn || gameOver ? "opacity-15 pointer-events-none" : ok ? "active:scale-90 sm:hover:-translate-y-3 sm:hover:shadow-xl cursor-pointer" : "opacity-20"}`}>
                  <HandTile v={t} hl={ok && myTurn && !gameOver} sm={hand.length > 7} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#21A038] via-[#2D8A3E] to-[#21A038]" />
      </div>
    </main>
  );
}