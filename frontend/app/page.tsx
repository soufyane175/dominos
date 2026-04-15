"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://dominos-app.onrender.com";

type Tile = [number, number];
type Msg = { sender: string; text: string; time: string };
type BE = { tile: Tile; flipped: boolean };
type Account = { username: string; wins: number; losses: number; games: number; avatar: string };

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

const txt = {
  NL: { stenen: "stenen", perSpeler: "per speler", tegenBot: "Tegen Bot", kamerMaken: "Kamer Maken", joinen: "Joinen", jij: "Jij", jouwBeurt: "Jouw beurt", spel: "Spel", chat: "Chat", legEerste: "Leg eerste steen!", wachtVriend: "Wacht op vriend...", pak: "Pak", pas: "Pas", pakUitPot: "Pak uit de pot!", geenBerichten: "Geen berichten", typ: "Typ...", stuurCode: "Stuur code naar je vriend!", vulCode: "Vul code in!", serverStart: "Server start op...", opnieuw: "Opnieuw", verloren: "VERLOREN!", gewonnen: "JIJ WINT!", gefeliciteerd: "Gefeliciteerd!", pastNiet: "Past niet!", gepast: "Gepast.", botPast: "Bot past.", botPakt: "Bot pakt.", jijBegint: "Jij begint!", kopieer: "Kopieer", login: "Inloggen", createAcc: "Account Maken", username: "Gebruikersnaam", password: "Wachtwoord", welkom: "Welkom", stats: "Statistieken", wins: "Wins", losses: "Losses", uitloggen: "Uitloggen", ofSpeel: "of speel als gast", gast: "Gast" },
  KU: { stenen: "تابلۆ", perSpeler: "بۆ هەر یاریزان", tegenBot: "دژی بۆت", kamerMaken: "دروستکردنی ژوور", joinen: "چوونە ناو", jij: "تۆ", jouwBeurt: "نۆبەی تۆ", spel: "یاری", chat: "چات", legEerste: "یەکەم تابلۆ دابنێ!", wachtVriend: "چاوەڕوانی هاوڕێ...", pak: "هەڵگرتن", pas: "تێپەڕاندن", pakUitPot: "لە پۆت هەڵبگرە!", geenBerichten: "هیچ پەیامێک نییە", typ: "بنووسە...", stuurCode: "کۆدەکە بنێرە بۆ هاوڕێکەت!", vulCode: "کۆدەکە بنووسە!", serverStart: "سێرڤەر دەست پێ دەکات...", opnieuw: "دووبارە", verloren: "تۆ دۆڕاویت!", gewonnen: "تۆ بردیت!", gefeliciteerd: "پیرۆزە!", pastNiet: "ناگونجێت!", gepast: "تێپەڕێنرا.", botPast: "بۆت تێپەڕاند.", botPakt: "بۆت هەڵیگرت.", jijBegint: "تۆ دەست پێ دەکەیت!", kopieer: "کۆپی", login: "چوونەژوورەوە", createAcc: "هەژمار دروست بکە", username: "ناوی بەکارهێنەر", password: "وشەی نهێنی", welkom: "بەخێربێیت", stats: "ئامارەکان", wins: "بردن", losses: "دۆڕان", uitloggen: "دەرچوون", ofSpeel: "یان وەک میوان", gast: "میوان" },
};

const D: number[][] = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const Dots = ({ v, sz }: { v: number; sz: number }) => (
  <div className="grid grid-cols-3 gap-px" style={{ width: sz, height: sz }}>
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

function playLaughSound() { try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); [800, 600, 900, 500, 1000, 400, 800, 600].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = f; const t = c.currentTime + i * 0.12; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11); o.start(t); o.stop(t + 0.12); }); } catch (e) { } }
function playWinSound() { try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = f; const t = c.currentTime + i * 0.2; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5); o.start(t); o.stop(t + 0.5); }); } catch (e) { } }
function playTileSound() { try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = 300; g.gain.setValueAtTime(0.3, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15); o.start(); o.stop(c.currentTime + 0.15); } catch (e) { } }

function Confetti() {
  const [p] = useState(() => Array.from({ length: 50 }, (_, i) => ({ id: i, x: Math.random() * 100, delay: Math.random() * 2, dur: 2 + Math.random() * 3, size: 6 + Math.random() * 8, color: ["#FF0000", "#FFD700", "#00FF00", "#00BFFF", "#FF69B4", "#FFA500", "#9400D3"][Math.floor(Math.random() * 7)], round: Math.random() > 0.5 })));
  return (<div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">{p.map(x => <div key={x.id} className="absolute" style={{ left: `${x.x}%`, top: "-20px", width: `${x.size}px`, height: `${x.size}px`, backgroundColor: x.color, borderRadius: x.round ? "50%" : "2px", animation: `cfall ${x.dur}s ${x.delay}s linear forwards` }} />)}<style jsx>{`@keyframes cfall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}`}</style></div>);
}
function LaughOverlay({ onClose, lang }: { onClose: () => void; lang: "KU" | "NL" }) {
  const [show, setShow] = useState(true); const L = ["🤣", "😂", "😆"]; const [ci, setCi] = useState(0);
  useEffect(() => { playLaughSound(); const ei = setInterval(() => setCi(p => (p + 1) % L.length), 400); const t = setTimeout(() => { setShow(false); setTimeout(onClose, 500) }, 4000); return () => { clearInterval(ei); clearTimeout(t) } }, [onClose]);
  return (<div className={`fixed inset-0 z-[99] flex items-center justify-center transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}><div className="absolute inset-0 bg-black/60 backdrop-blur-sm" /><div className="relative z-10 flex flex-col items-center"><div style={{ animation: "blgh .8s ease-in-out infinite" }} className="text-[120px] sm:text-[180px] leading-none select-none">{L[ci]}</div><div className="mt-4 text-white font-black text-2xl sm:text-4xl animate-pulse">{lang === "KU" ? "تۆ دۆڕاویت! 😂" : "VERLOREN! 😂"}</div></div><style jsx>{`@keyframes blgh{0%,100%{transform:scale(1)}15%{transform:scale(1.3) rotate(-10deg)}45%{transform:scale(1.2) rotate(5deg)}}`}</style></div>);
}
function WinOverlay({ onClose, lang }: { onClose: () => void; lang: "KU" | "NL" }) {
  const [show, setShow] = useState(true);
  useEffect(() => { playWinSound(); const t = setTimeout(() => { setShow(false); setTimeout(onClose, 500) }, 4000); return () => clearTimeout(t) }, [onClose]);
  return (<div className={`fixed inset-0 z-[99] flex items-center justify-center transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}><div className="absolute inset-0 bg-black/50 backdrop-blur-sm" /><Confetti /><div className="relative z-10 flex flex-col items-center"><div className="text-[100px] sm:text-[150px] leading-none animate-bounce select-none">🏆</div><div className="mt-2 text-3xl animate-bounce">👑</div><div className="mt-4 text-yellow-400 font-black text-3xl sm:text-5xl animate-pulse">{lang === "KU" ? "تۆ بردیت!" : "JIJ WINT!"}</div></div></div>);
}

// ✅ Domino Chain - echte domino layout
function DominoChain({ board, lastIdx }: { board: BE[]; lastIdx: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-[2px] p-2">
      {board.map((entry, idx) => {
        const tile = entry.tile;
        const display: Tile = entry.flipped ? [tile[1], tile[0]] : tile;
        const isDouble = tile[0] === tile[1];
        const isNew = idx === lastIdx;

        if (isDouble) {
          return (
            <div key={idx} className={`flex flex-col items-center justify-around rounded-md border-2 border-[#C4B998] shadow-lg flex-shrink-0 ${isNew ? "animate-pop" : ""}`}
              style={{ width: 26, height: 48, background: "linear-gradient(160deg, #FFFEF5, #F0E6D0)" }}>
              <Dots v={display[0]} sz={10} />
              <div className="w-[70%] h-px bg-[#C4B998]" />
              <Dots v={display[1]} sz={10} />
            </div>
          );
        }
        return (
          <div key={idx} className={`flex flex-row items-center justify-around rounded-md border-2 border-[#C4B998] shadow-lg flex-shrink-0 ${isNew ? "animate-pop" : ""}`}
            style={{ width: 48, height: 26, background: "linear-gradient(160deg, #FFFEF5, #F0E6D0)" }}>
            <Dots v={display[0]} sz={10} />
            <div className="h-[70%] w-px bg-[#C4B998]" />
            <Dots v={display[1]} sz={10} />
          </div>
        );
      })}
      <style jsx>{`@keyframes pop{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}} .animate-pop{animation:pop 0.4s ease-out}`}</style>
    </div>
  );
}

export default function Home() {
  // ✅ Account systeem
  const [account, setAccount] = useState<Account | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "create">("login");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authAvatar, setAuthAvatar] = useState("😎");
  const avatars = ["😎", "🤖", "👑", "🔥", "💀", "🐐", "☀️", "👤", "🎲", "💪", "😈", "🥶"];

  const [view, setView] = useState<"menu" | "game">("menu");
  const [lang, setLang] = useState<"KU" | "NL">("NL");
  const t = txt[lang];
  const [mode, setMode] = useState<"bot" | "online">("bot");
  const [tab, setTab] = useState<"board" | "chat">("board");

  const [board, setBoard] = useState<BE[]>([]);
  const [hand, setHand] = useState<Tile[]>([]);
  const [botHand, setBotHand] = useState<Tile[]>([]);
  const [pile, setPile] = useState<Tile[]>([]);
  const [myTurn, setMyTurn] = useState(true);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [showLaugh, setShowLaugh] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [iWon, setIWon] = useState(false);
  const [lastPlayedIdx, setLastPlayedIdx] = useState(-1);
  const [turnAnim, setTurnAnim] = useState(false);

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

  const sock = useRef<Socket | null>(null);
  const btm = useRef<HTMLDivElement>(null);
  const emos = ["🔥", "👏", "😂", "👋", "😍", "😎", "💯", "😡", "🥳", "😭", "🤣", "💀", "🎉", "❤️", "👑", "🐐", "😈", "💪", "🙏", "☀️"];

  const playerName = account?.username || "Gast";

  // ✅ Load account from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("domino_account");
      if (saved) setAccount(JSON.parse(saved));
    } catch (e) { }
  }, []);

  const saveAccount = (acc: Account) => {
    setAccount(acc);
    localStorage.setItem("domino_account", JSON.stringify(acc));
  };

  const handleAuth = () => {
    if (!authUser.trim()) { setAuthErr("Vul een naam in!"); return; }
    if (!authPass.trim()) { setAuthErr("Vul een wachtwoord in!"); return; }

    const accounts: Record<string, { password: string; account: Account }> = JSON.parse(localStorage.getItem("domino_accounts") || "{}");

    if (authMode === "create") {
      if (accounts[authUser.toLowerCase()]) { setAuthErr("Naam al in gebruik!"); return; }
      const newAcc: Account = { username: authUser, wins: 0, losses: 0, games: 0, avatar: authAvatar };
      accounts[authUser.toLowerCase()] = { password: authPass, account: newAcc };
      localStorage.setItem("domino_accounts", JSON.stringify(accounts));
      saveAccount(newAcc);
      setShowAuth(false);
      setAuthErr("");
    } else {
      const existing = accounts[authUser.toLowerCase()];
      if (!existing) { setAuthErr("Account niet gevonden!"); return; }
      if (existing.password !== authPass) { setAuthErr("Fout wachtwoord!"); return; }
      saveAccount(existing.account);
      setShowAuth(false);
      setAuthErr("");
    }
  };

  const updateStats = (won: boolean) => {
    if (!account) return;
    const updated = { ...account, games: account.games + 1, wins: account.wins + (won ? 1 : 0), losses: account.losses + (won ? 0 : 1) };
    saveAccount(updated);
    const accounts: Record<string, any> = JSON.parse(localStorage.getItem("domino_accounts") || "{}");
    if (accounts[account.username.toLowerCase()]) {
      accounts[account.username.toLowerCase()].account = updated;
      localStorage.setItem("domino_accounts", JSON.stringify(accounts));
    }
  };

  const logout = () => { setAccount(null); localStorage.removeItem("domino_account"); };

  useEffect(() => { btm.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  const trigEnd = useCallback((won: boolean) => { setIWon(won); updateStats(won); if (won) setShowWin(true); else setShowLaugh(true); }, [account]);
  const sys = useCallback((s: string) => {
    setMsgs(p => [...p, { sender: "⚙️", text: s, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; });
  }, []);

  // ✅ Turn change animation
  useEffect(() => { setTurnAnim(true); const t = setTimeout(() => setTurnAnim(false), 600); return () => clearTimeout(t); }, [myTurn]);

  // Socket
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"], reconnection: true, reconnectionAttempts: 50, reconnectionDelay: 1000, timeout: 30000 });
    sock.current = s;
    s.on("connect", () => setStatus("on"));
    s.on("connect_error", () => setStatus("err"));
    s.on("disconnect", () => setStatus("off"));
    s.on("roomCreated", ({ code }: any) => { setRoom(code); setWaiting(true); setMode("online"); setView("game"); setGameOver(null); setMsgs([]); setTab("board"); setShowLaugh(false); setShowWin(false); setLastPlayedIdx(-1); });
    s.on("gameStarted", ({ p1, p2 }: any) => { setWaiting(false); setMode("online"); setView("game"); setGameOver(null); setShowLaugh(false); setShowWin(false); sys(`🎮 ${p1} vs ${p2}`); });
    s.on("gameState", (d: any) => {
      const prevLen = board.length;
      setBoard(d.board || []); setHand(d.hand || []); setPileCount(d.pileCount || 0);
      setOppCount(d.opponentHandCount || 0); setOppName(d.opponentName || "..."); setMyTurn(d.turn === d.playerIndex);
      if (d.board && d.board.length > prevLen) { setLastPlayedIdx(d.board.length - 1); playTileSound(); }
      if (d.started) { setWaiting(false); setView("game"); setMode("online"); }
      if (d.winner && !gameOver) { const w = d.winner.index === d.playerIndex; setGameOver(w ? "🎉" : "💀"); trigEnd(w); }
    });
    s.on("joinError", (m: string) => setJoinErr(m));
    s.on("tilePlayed", ({ playerName: pn, tile }: any) => sys(`🎯 ${pn}: [${tile[0]}|${tile[1]}]`));
    s.on("playerPassed", ({ name: n }: any) => sys(`⏭️ ${n}`));
    s.on("chatMsg", (m: Msg) => { setMsgs(p => [...p, m]); setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; }); });
    s.on("opponentLeft", () => { sys("❌"); setGameOver("❌"); });
    s.on("gameRestarted", () => { setGameOver(null); setShowLaugh(false); setShowWin(false); setLastPlayedIdx(-1); sys("🔄"); });
    s.on("playError", (m: string) => sys(`❌ ${m}`));
    return () => { s.removeAllListeners(); s.disconnect(); };
  }, [sys, trigEnd, gameOver, board.length]);

  // Online
  const oCreate = () => { if (status !== "on") { setJoinErr(t.serverStart); fetch(SOCKET_URL).catch(() => {}); return; } setJoinErr(""); sock.current?.emit("createRoom", { playerName }); };
  const oJoin = () => { const c = input.trim().toUpperCase(); if (!c) { setJoinErr(t.vulCode); return; } if (status !== "on") { setJoinErr(t.serverStart); return; } setJoinErr(""); setRoom(c); setMode("online"); setMsgs([]); setTab("board"); setGameOver(null); sock.current?.emit("joinRoom", { code: c, playerName }); };
  const oPlay = (i: number) => { if (myTurn && !gameOver) sock.current?.emit("playTile", { tileIndex: i }); };
  const oDraw = () => { if (myTurn && !gameOver) sock.current?.emit("drawTile"); };
  const oPass = () => { if (myTurn && !gameOver) sock.current?.emit("passTurn"); };
  const oChat = (s: string) => { if (s.trim()) { sock.current?.emit("sendChat", { text: s.trim() }); setMsg(""); setShowEm(false); } };
  const oRestart = () => { setShowLaugh(false); setShowWin(false); setLastPlayedIdx(-1); sock.current?.emit("restartGame"); };

  // ✅ FIXED Bot - smarter AI
  const startBot = () => {
    const a = shuf(allT()); setHand(a.slice(0, 7)); setBotHand(a.slice(7, 14)); setPile(a.slice(14));
    setBoard([]); setMyTurn(true); setGameOver(null); setMode("bot"); setView("game"); setRoom("BOT");
    setMsgs([]); setTab("board"); setOppName("Bot 🤖"); setOppCount(7); setPileCount(14); setShowLaugh(false); setShowWin(false); setLastPlayedIdx(-1);
    setTimeout(() => sys(`🤖 ${t.jijBegint}`), 100);
  };

  const bPlay = (tile: Tile, idx: number) => {
    if (!myTurn || gameOver) return;
    const ends = getEnds(board); const side = canPlay(tile, board, ends);
    if (!side && board.length > 0) { sys(`❌ ${t.pastNiet}`); return; }
    let fl = false;
    if (board.length > 0) { if (side === "left") fl = tile[1] !== ends[0]; else fl = tile[0] !== ends[1]; }
    const entry: BE = { tile, flipped: fl };
    const nb = side === "left" ? [entry, ...board] : [...board, entry];
    const nh = hand.filter((_, i) => i !== idx);
    setBoard(nb); setHand(nh);
    setLastPlayedIdx(side === "left" ? 0 : nb.length - 1);
    playTileSound();
    if (!nh.length) { setGameOver("🎉"); trigEnd(true); sys(`🎉 ${t.gefeliciteerd}`); return; }
    setMyTurn(false);
    setTimeout(() => botMove(nb), 800);
  };

  // ✅ FIXED Bot AI - tries all tiles, draws from pile, then passes
  const botMove = (currentBoard: BE[]) => {
    setBotHand(prevBotHand => {
      const ends = getEnds(currentBoard);

      // Find best tile to play (prioritize doubles and matching ends)
      let bestIdx = -1;
      let bestSide: "left" | "right" | null = null;
      let bestScore = -1;

      for (let i = 0; i < prevBotHand.length; i++) {
        const tile = prevBotHand[i];
        const side = canPlay(tile, currentBoard, ends);
        if (side) {
          // Score: doubles higher, higher values higher
          const score = (tile[0] === tile[1] ? 10 : 0) + tile[0] + tile[1];
          if (score > bestScore) { bestScore = score; bestIdx = i; bestSide = side; }
        }
      }

      if (bestIdx === -1) {
        // Can't play - draw from pile
        setPile(currentPile => {
          if (currentPile.length === 0) {
            // No pile left - pass
            sys(`🤖 ${t.botPast}`);
            setMyTurn(true);
            return currentPile;
          }

          const newPile = [...currentPile];
          const drawn = newPile.pop()!;
          setPileCount(newPile.length);

          // Try to play drawn tile
          const newBotHand = [...prevBotHand, drawn];
          const drawnSide = canPlay(drawn, currentBoard, ends);

          if (drawnSide) {
            // Play the drawn tile
            let fl = false;
            if (drawnSide === "left") fl = drawn[1] !== ends[0];
            else fl = drawn[0] !== ends[1];
            const entry: BE = { tile: drawn, flipped: fl };
            const nb = drawnSide === "left" ? [entry, ...currentBoard] : [...currentBoard, entry];
            setBoard(nb);
            setLastPlayedIdx(drawnSide === "left" ? 0 : nb.length - 1);
            playTileSound();
            sys(`🤖 [${drawn[0]}|${drawn[1]}]`);

            const remainingBot = prevBotHand; // didn't add drawn, played it directly
            if (remainingBot.length === 0) { setGameOver("💀"); trigEnd(false); }
            setOppCount(remainingBot.length);
            setMyTurn(true);
            setBotHand(remainingBot);
            return newPile;
          } else {
            // Can't play drawn tile either - pass
            sys(`🤖 ${t.botPakt}`);
            setOppCount(newBotHand.length);
            setMyTurn(true);
            setBotHand(newBotHand);
            return newPile;
          }
        });
        return prevBotHand; // return unchanged, setPile callback handles it
      }

      // Play the best tile
      const bt = prevBotHand[bestIdx];
      let fl = false;
      if (currentBoard.length > 0) {
        if (bestSide === "left") fl = bt[1] !== ends[0];
        else fl = bt[0] !== ends[1];
      }
      const entry: BE = { tile: bt, flipped: fl };
      const nb = bestSide === "left" ? [entry, ...currentBoard] : [...currentBoard, entry];
      setBoard(nb);
      setLastPlayedIdx(bestSide === "left" ? 0 : nb.length - 1);
      playTileSound();
      sys(`🤖 [${bt[0]}|${bt[1]}]`);

      const nbh = prevBotHand.filter((_, i) => i !== bestIdx);
      if (nbh.length === 0) { setGameOver("💀"); trigEnd(false); }
      setOppCount(nbh.length);
      setMyTurn(true);
      return nbh;
    });
  };

  const bDraw = () => { if (!myTurn || gameOver || !pile.length) return; const np = [...pile]; const d = np.pop()!; setPile(np); setHand(p => [...p, d]); setPileCount(np.length); sys(`📦 [${d[0]}|${d[1]}]`); };
  const bPass = () => { if (!myTurn || gameOver) return; setMyTurn(false); sys(`⏭️ ${t.gepast}`); setTimeout(() => botMove(board), 800); };
  const bChat = (s: string) => {
    if (!s.trim()) return;
    setMsgs(p => [...p, { sender: playerName, text: s.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); setMsg(""); setShowEm(false);
    setTimeout(() => { const r = ["😂", "🔥", "💯", "💪", "☀️", "👏", "👍", "😈"]; setMsgs(p => [...p, { sender: "🤖", text: r[Math.floor(Math.random() * r.length)], time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); }, 800 + Math.random() * 1200);
  };

  const play = (ti: Tile, i: number) => mode === "bot" ? bPlay(ti, i) : oPlay(i);
  const draw = () => mode === "bot" ? bDraw() : oDraw();
  const pass = () => mode === "bot" ? bPass() : oPass();
  const sendC = (s: string) => mode === "bot" ? bChat(s) : oChat(s);
  const restart = () => mode === "bot" ? startBot() : oRestart();
  const copy = () => { navigator.clipboard.writeText(room).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const canAny = () => !board.length || hand.some(ti => canPlay(ti, board, getEnds(board)) !== null);
  const cPile = mode === "bot" ? pile.length : pileCount;
  const cOpp = mode === "bot" ? botHand.length : oppCount;

  const HandTile = ({ v, hl, sm }: { v: Tile; hl?: boolean; sm?: boolean }) => (
    <div className={`${sm ? "w-[32px] h-[64px]" : "w-[40px] h-[80px]"} rounded-lg flex flex-col items-center justify-around py-0.5 shadow-lg cursor-pointer select-none border-2 transition-all duration-150 active:scale-90 ${hl ? "border-yellow-400 ring-2 ring-yellow-400/60 shadow-yellow-500/40" : "border-[#C4B998]"}`}
      style={{ background: "linear-gradient(160deg, #FFFEF5, #F5EDDA)" }}>
      <Dots v={v[0]} sz={sm ? 12 : 16} />
      <div className="w-[60%] h-px bg-[#C4B998]" />
      <Dots v={v[1]} sz={sm ? 12 : 16} />
    </div>
  );

  const Back = () => (<div className="w-[14px] h-[26px] sm:w-[18px] sm:h-[32px] rounded bg-gradient-to-br from-[#8B0000] to-[#5C0000] border border-[#3D0000] shadow flex items-center justify-center flex-shrink-0"><div className="w-[50%] h-[50%] border border-[#FFD700]/20 rounded-sm" /></div>);

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden">
      {showLaugh && <LaughOverlay onClose={() => setShowLaugh(false)} lang={lang} />}
      {showWin && <><Confetti /><WinOverlay onClose={() => setShowWin(false)} lang={lang} /></>}

      {/* Kurdistan vlag */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" />
        <div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" />
        <div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" />
        <div className="absolute inset-0 flex items-center justify-center"><Sun s={view === "menu" ? 250 : 400} c={view === "menu" ? "opacity-35" : "opacity-[0.12]"} /></div>
      </div>
      {view === "game" && <div className="fixed inset-0 z-[1] bg-black/40" />}

      {/* Lang */}
      <div className="fixed top-2 right-2 flex gap-1 z-50 items-center">
        {view === "menu" && status !== "off" && (<div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full mr-1"><div className={`w-2 h-2 rounded-full ${status === "on" ? "bg-green-400 animate-pulse" : "bg-red-500"}`} /></div>)}
        <button onClick={() => setLang("KU")} className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${lang === "KU" ? "bg-yellow-500 text-black" : "bg-black/40 text-white/60"}`}>کوردی</button>
        <button onClick={() => setLang("NL")} className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${lang === "NL" ? "bg-yellow-500 text-black" : "bg-black/40 text-white/60"}`}>NL</button>
      </div>

      {/* ✅ AUTH MODAL */}
      {showAuth && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl p-5 w-[300px] shadow-2xl border border-white/10">
            <h2 className="text-white font-black text-lg text-center mb-3">{authMode === "login" ? t.login : t.createAcc}</h2>

            {authMode === "create" && (
              <div className="flex justify-center gap-2 mb-3 flex-wrap">
                {avatars.map(a => (
                  <button key={a} onClick={() => setAuthAvatar(a)} className={`text-2xl p-1 rounded-lg transition-all ${authAvatar === a ? "bg-yellow-500 scale-110" : "bg-white/5 hover:bg-white/10"}`}>{a}</button>
                ))}
              </div>
            )}

            <input type="text" placeholder={t.username} value={authUser} onChange={e => setAuthUser(e.target.value)}
              className="w-full p-2.5 rounded-xl text-center font-bold text-black bg-white mb-2 text-sm" />
            <input type="password" placeholder={t.password} value={authPass} onChange={e => setAuthPass(e.target.value)}
              className="w-full p-2.5 rounded-xl text-center font-bold text-black bg-white mb-2 text-sm" />

            {authErr && <p className="text-red-400 text-[10px] text-center mb-2 font-bold">⚠️ {authErr}</p>}

            <button onClick={handleAuth} className="w-full bg-yellow-500 text-black font-black py-2.5 rounded-xl mb-2 active:bg-yellow-400 text-sm">
              {authMode === "login" ? `🔑 ${t.login}` : `✨ ${t.createAcc}`}
            </button>

            <button onClick={() => { setAuthMode(authMode === "login" ? "create" : "login"); setAuthErr(""); }}
              className="w-full text-white/50 text-[10px] text-center py-1">
              {authMode === "login" ? t.createAcc : t.login}
            </button>
            <button onClick={() => setShowAuth(false)} className="w-full text-white/30 text-[10px] text-center py-1">✕</button>
          </div>
        </div>
      )}

      {/* MENU */}
      {view === "menu" ? (
        <div className="flex flex-col items-center z-10 w-full max-w-[300px] px-5 py-3">
          <div className="relative mb-1">
            <Sun s={60} c="absolute -top-1 left-1/2 -translate-x-1/2 opacity-80" />
            <h1 className="text-[40px] font-black text-white italic drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)] relative z-10">DOMINO</h1>
          </div>
          <p className="text-white/80 text-[10px] mb-3 font-bold bg-black/30 px-3 py-1 rounded-full">☀️ 28 {t.stenen} • 7 {t.perSpeler}</p>

          {/* ✅ Account sectie */}
          {account ? (
            <div className="w-full bg-black/30 backdrop-blur-sm rounded-2xl p-3 mb-3 border border-yellow-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{account.avatar}</div>
                  <div>
                    <div className="text-white font-bold text-sm">{account.username}</div>
                    <div className="text-white/40 text-[9px]">🏆{account.wins} 💀{account.losses} 🎮{account.games}</div>
                  </div>
                </div>
                <button onClick={logout} className="text-white/30 text-[9px] bg-white/5 px-2 py-1 rounded-lg">{t.uitloggen}</button>
              </div>
            </div>
          ) : (
            <div className="w-full mb-3">
              <button onClick={() => { setShowAuth(true); setAuthMode("login"); setAuthErr(""); }}
                className="w-full bg-black/30 backdrop-blur-sm text-white font-bold py-2.5 rounded-2xl mb-1.5 border border-white/10 text-sm active:bg-black/50">
                🔑 {t.login} / {t.createAcc}
              </button>
              <p className="text-white/30 text-[9px] text-center">{t.ofSpeel}</p>
            </div>
          )}

          <button onClick={startBot} className="w-full bg-gradient-to-b from-blue-500 to-blue-700 text-white font-black py-3 rounded-2xl border-b-4 border-blue-900 mb-2 active:translate-y-0.5 active:border-b-2 shadow-xl text-sm">🤖 {t.tegenBot}</button>
          <button onClick={oCreate} className="w-full bg-gradient-to-b from-green-500 to-green-700 text-white font-black py-3 rounded-2xl border-b-4 border-green-900 mb-2 active:translate-y-0.5 active:border-b-2 shadow-xl text-sm">🏠 {t.kamerMaken}</button>

          <div className="bg-gradient-to-b from-purple-500 to-purple-700 p-3 rounded-2xl border-b-4 border-purple-900 w-full shadow-xl">
            <input type="text" placeholder="CODE..." value={input} onChange={e => setInput(e.target.value.toUpperCase())} className="w-full p-2.5 rounded-xl text-center font-bold mb-1.5 uppercase text-black bg-white border-2 border-purple-300 text-lg tracking-[0.3em]" maxLength={5} />
            {joinErr && <p className="text-white text-[10px] text-center mb-1.5 font-bold bg-red-500/30 rounded-lg py-1">⚠️ {joinErr}</p>}
            <button onClick={oJoin} className="w-full text-white font-black py-2.5 bg-purple-900/50 rounded-xl active:bg-purple-800 text-sm">🚪 {t.joinen}</button>
          </div>

          {status !== "on" && (<div className="mt-2 bg-yellow-500/20 rounded-xl p-2 w-full"><p className="text-yellow-300 text-[10px] text-center font-bold">⏳ {t.serverStart}</p><button onClick={() => fetch(SOCKET_URL).catch(() => {})} className="w-full mt-1 text-yellow-400 text-[10px] font-bold bg-yellow-500/10 rounded py-1">🔄</button></div>)}
          <p className="text-white/20 text-[10px] mt-2">☀️ Biji Kurdistan</p>
        </div>
      ) : (
        /* GAME */
        <div className="w-full h-[100dvh] flex flex-col z-10">
          {/* Top bar */}
          <div className="flex items-center justify-between px-2 py-1.5 flex-shrink-0 relative overflow-hidden">
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #ED2024 0%, #ED2024 30%, rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.2) 70%, #21A038 70%)" }} />
            <div className="absolute inset-0 bg-black/30" />
            <button onClick={() => { setView("menu"); setWaiting(false); setShowLaugh(false); setShowWin(false); }} className="text-white text-lg px-1 active:scale-90 relative z-10">↩</button>
            <div className="flex items-center gap-1.5 relative z-10">
              <span className="bg-yellow-500 text-black px-2.5 py-0.5 rounded-lg font-black text-[11px]">{room}</span>
              {room !== "BOT" && <button onClick={copy} className="text-white text-[10px] bg-black/30 px-2 py-0.5 rounded-lg font-bold">{copied ? "✅" : "📋"}</button>}
            </div>
            {/* ✅ Turn indicator with animation */}
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black shadow relative z-10 transition-all duration-300 ${myTurn ? "bg-green-500 text-black" : "bg-red-500 text-white"} ${turnAnim ? "scale-125" : "scale-100"}`}>
              {myTurn ? `🟢 ${t.jouwBeurt}` : `🔴 ${oppName}`}
            </div>
          </div>

          {waiting && (<div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-center py-2.5 text-[11px] flex-shrink-0">⏳ {t.stuurCode} <span className="bg-black text-white px-3 py-1 rounded-lg font-mono mx-2 text-base tracking-widest">{room}</span><button onClick={copy} className="bg-white/70 px-2 py-0.5 rounded text-[10px] font-bold">{copied ? "✅" : "📋"}</button></div>)}
          {gameOver && (<div className={`text-black font-black text-center py-3 text-base flex-shrink-0 ${iWon ? "bg-gradient-to-r from-yellow-400 to-orange-500" : "bg-gradient-to-r from-red-500 to-red-700 text-white"}`}>{iWon ? `🏆 ${t.gewonnen}` : `💀 ${t.verloren} 🤣`}<button onClick={restart} className="ml-3 bg-black text-white px-4 py-1.5 rounded-xl text-xs font-bold">🔄 {t.opnieuw}</button></div>)}

          <div className="flex sm:hidden flex-shrink-0">
            <button onClick={() => setTab("board")} className={`flex-1 py-2 text-xs font-bold ${tab === "board" ? "bg-green-900/50 text-green-400 border-b-2 border-green-400" : "text-white/30 bg-black/30"}`}>🎮 {t.spel}</button>
            <button onClick={() => { setTab("chat"); setUnread(0); }} className={`flex-1 py-2 text-xs font-bold relative ${tab === "chat" ? "bg-green-900/50 text-green-400 border-b-2 border-green-400" : "text-white/30 bg-black/30"}`}>💬 {t.chat}{unread > 0 && tab !== "chat" && <span className="absolute top-1 right-[30%] bg-red-500 text-white text-[7px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-bounce">{unread}</span>}</button>
          </div>

          <div className="flex-1 flex min-h-0">
            <div className={`flex-1 flex flex-col min-h-0 ${tab === "chat" ? "hidden sm:flex" : "flex"}`}>
              {/* Opponent - ✅ NO pool count shown */}
              <div className="bg-black/50 px-2 py-1.5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-red-900/80 flex items-center justify-center text-xs shadow">👤</div>
                  <div><div className="text-white font-bold text-[11px]">{oppName}</div><div className="text-white/30 text-[9px]">{cOpp} {t.stenen}</div></div>
                </div>
                <div className="flex gap-px overflow-hidden max-w-[55%]">{[...Array(Math.min(cOpp, 14))].map((_, i) => <Back key={i} />)}</div>
              </div>

              {/* Board - Kurdistan vlag achtergrond */}
              <div className="flex-1 relative overflow-auto">
                <div className="absolute inset-0">
                  <div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]/20" />
                  <div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white/10" />
                  <div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]/20" />
                </div>
                <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(30,100,45,0.75) 0%, rgba(20,70,30,0.85) 60%, rgba(10,50,15,0.92) 100%)" }} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Sun s={250} c="opacity-[0.08]" /></div>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#ED2024] via-[#FFD700] to-[#21A038]" />
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#21A038] via-[#FFD700] to-[#ED2024]" />
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#ED2024] via-[#FFD700] to-[#21A038]" />
                <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-[#ED2024] via-[#FFD700] to-[#21A038]" />

                <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4 z-10">
                  {!board.length ? (
                    <div className="text-white/20 text-center animate-pulse"><Sun s={80} c="mx-auto mb-3 opacity-20" /><div className="text-sm font-bold">{waiting ? t.wachtVriend : t.legEerste}</div></div>
                  ) : (
                    <DominoChain board={board} lastIdx={lastPlayedIdx} />
                  )}
                </div>
              </div>

              {/* ✅ Player bar - NO pool visible, cleaner */}
              <div className="bg-black/60 px-2 py-1.5 flex items-center justify-between flex-shrink-0 border-t border-yellow-500/30">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-yellow-700/80 flex items-center justify-center text-xs shadow">{account?.avatar || "☀️"}</div>
                  <div><div className="text-white font-bold text-[11px]">{playerName}</div><div className="text-white/30 text-[9px]">{hand.length} {t.stenen}</div></div>
                </div>
                <div className="flex gap-1.5 items-center">
                  {!canAny() && myTurn && !gameOver && cPile > 0 && <span className="text-red-400 text-[8px] animate-pulse">⚠️</span>}
                  {/* ✅ Pak knop - geen "(14)" meer, cleaner */}
                  <button onClick={draw} disabled={!myTurn || !!gameOver || cPile === 0} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-25 active:bg-blue-500 shadow">📦 {t.pak}</button>
                  {!canAny() && myTurn && !gameOver && cPile === 0 && <button onClick={pass} className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold active:bg-orange-500 shadow">⏭️ {t.pas}</button>}
                </div>
              </div>
            </div>

            {/* Chat */}
            <div className={`w-full sm:w-52 md:w-56 bg-black/50 flex flex-col border-l border-yellow-500/10 ${tab === "board" ? "hidden sm:flex" : "flex"}`}>
              <div className="text-white/40 font-bold text-[10px] text-center py-1.5 bg-yellow-500/10 hidden sm:block">💬 {t.chat}</div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
                {!msgs.length && <div className="text-white/15 text-[10px] text-center mt-8">{t.geenBerichten}</div>}
                {msgs.map((m, i) => (
                  <div key={i} className={`p-1.5 rounded-lg text-[10px] animate-slideIn ${m.sender === "⚙️" ? "bg-blue-500/10 text-blue-300/80 italic" : m.sender.includes("🤖") ? "bg-red-500/10 text-red-300/80" : "bg-white/5 text-white/80"}`}>
                    <div className="flex justify-between"><span className="font-bold text-yellow-400/80 text-[9px]">{m.sender}</span><span className="text-white/10 text-[7px]">{m.time}</span></div>
                    <div className="break-words mt-px">{m.text}</div>
                  </div>
                ))}
                <div ref={btm} />
              </div>
              {showEm && (<div className="grid grid-cols-8 gap-0.5 p-1.5 bg-black/50 mx-1.5 rounded-lg max-h-20 overflow-y-auto border border-white/5">{emos.map(e => <button key={e} onClick={() => setMsg(p => p + e)} className="text-sm p-0.5 rounded active:bg-white/20">{e}</button>)}</div>)}
              <div className="flex gap-1 p-2 pt-1">
                <button onClick={() => setShowEm(!showEm)} className={`px-1.5 py-1 rounded-lg text-sm ${showEm ? "bg-yellow-500" : "bg-white/10"}`}>😊</button>
                <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendC(msg); }} className="flex-1 bg-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:ring-1 focus:ring-yellow-500/50 placeholder-white/20 min-w-0" placeholder={t.typ} />
                <button onClick={() => sendC(msg)} className="bg-green-600 px-2.5 py-1 rounded-lg text-[10px] text-white font-bold active:bg-green-500">➤</button>
              </div>
            </div>
          </div>

          {/* Hand */}
          <div className="px-1.5 py-2 border-t-2 border-yellow-500/40 flex-shrink-0" style={{ background: "linear-gradient(to top, #070710, #0d1117, #161b22)" }}>
            {!canAny() && myTurn && !gameOver && cPile > 0 && (<div className="text-center text-red-400/80 text-[9px] font-bold mb-1 animate-pulse">⚠️ {t.pakUitPot}</div>)}
            <div className="flex justify-center gap-[3px] overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
              {hand.map((ti, i) => {
                const ends = getEnds(board);
                const ok = !board.length || canPlay(ti, board, ends) !== null;
                return (
                  <div key={`${ti[0]}-${ti[1]}-${i}`} onClick={() => play(ti, i)}
                    className={`flex-shrink-0 transition-all duration-200 ${!myTurn || gameOver ? "opacity-20 pointer-events-none" : ok ? "active:scale-90 sm:hover:-translate-y-3 hover:shadow-xl" : "opacity-25"}`}>
                    <HandTile v={ti} hl={ok && myTurn && !gameOver} sm={hand.length > 6} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ✅ CSS Animaties */}
          <style jsx global>{`
            @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .animate-slideIn { animation: slideIn 0.3s ease-out; }
          `}</style>
        </div>
      )}
    </main>
  );
}