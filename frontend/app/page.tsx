"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://dominos-app.onrender.com";

type Tile = [number, number];
type Msg = { sender: string; text: string; time: string };
type BE = { tile: Tile; flipped: boolean };
type Account = { username: string; wins: number; losses: number; games: number; avatar: string };

// ✅ FIXED: Correcte ends berekening
function getEnds(b: BE[]): [number, number] {
  if (!b.length) return [-1, -1];
  const f = b[0];
  const l = b[b.length - 1];
  // Links: de buitenste waarde van de eerste tegel
  const leftEnd = f.flipped ? f.tile[1] : f.tile[0];
  // Rechts: de buitenste waarde van de laatste tegel
  const rightEnd = l.flipped ? l.tile[0] : l.tile[1];
  return [leftEnd, rightEnd];
}

// ✅ FIXED: Kan een tegel gespeeld worden?
function canPlay(tile: Tile, board: BE[], ends: [number, number]): "left" | "right" | null {
  if (!board.length) return "right"; // Eerste tegel kan altijd
  const [leftEnd, rightEnd] = ends;
  // Check of een van de twee kanten past aan links of rechts
  if (tile[0] === leftEnd || tile[1] === leftEnd) return "left";
  if (tile[0] === rightEnd || tile[1] === rightEnd) return "right";
  return null;
}

// ✅ FIXED: Bepaal of tegel omgedraaid moet worden
function shouldFlip(tile: Tile, side: "left" | "right", ends: [number, number], boardEmpty: boolean): boolean {
  if (boardEmpty) return false;
  if (side === "left") {
    // Bij links leggen: tile[1] moet gelijk zijn aan leftEnd
    // Dus als tile[0] === leftEnd, moeten we flippen zodat tile[1] (=tile[0] na flip) aan de binnenkant zit
    return tile[0] === ends[0];
  } else {
    // Bij rechts leggen: tile[0] moet gelijk zijn aan rightEnd
    // Dus als tile[1] === rightEnd, moeten we flippen
    return tile[1] === ends[1];
  }
}

function allT(): Tile[] {
  const t: Tile[] = [];
  for (let i = 0; i <= 6; i++)
    for (let j = i; j <= 6; j++)
      t.push([i, j]);
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

const txt = {
  NL: { stenen: "stenen", perSpeler: "per speler", tegenBot: "Tegen Bot", kamerMaken: "Kamer Maken", joinen: "Joinen", jij: "Jij", jouwBeurt: "Jouw beurt", spel: "Spel", chat: "Chat", legEerste: "Leg eerste steen!", wachtVriend: "Wacht op vriend...", pak: "Pak", pas: "Pas", pakUitPot: "Pak uit de pot!", geenBerichten: "Geen berichten", typ: "Typ...", stuurCode: "Stuur code!", vulCode: "Vul code in!", serverStart: "Server start op...", opnieuw: "Opnieuw", verloren: "VERLOREN!", gewonnen: "JIJ WINT!", gefeliciteerd: "Gefeliciteerd!", pastNiet: "Past niet!", gepast: "Gepast.", botPast: "Bot past.", botPakt: "Bot pakt.", jijBegint: "Jij begint!", kopieer: "Kopieer", login: "Inloggen", createAcc: "Account Maken", username: "Gebruikersnaam", password: "Wachtwoord", uitloggen: "Uitloggen", ofSpeel: "of speel als gast" },
  KU: { stenen: "تابلۆ", perSpeler: "بۆ هەر یاریزان", tegenBot: "دژی بۆت", kamerMaken: "دروستکردنی ژوور", joinen: "چوونە ناو", jij: "تۆ", jouwBeurt: "نۆبەی تۆ", spel: "یاری", chat: "چات", legEerste: "یەکەم تابلۆ دابنێ!", wachtVriend: "چاوەڕوانی هاوڕێ...", pak: "هەڵگرتن", pas: "تێپەڕاندن", pakUitPot: "لە پۆت هەڵبگرە!", geenBerichten: "هیچ پەیامێک نییە", typ: "بنووسە...", stuurCode: "کۆدەکە بنێرە!", vulCode: "کۆدەکە بنووسە!", serverStart: "سێرڤەر دەست پێ دەکات...", opnieuw: "دووبارە", verloren: "تۆ دۆڕاویت!", gewonnen: "تۆ بردیت!", gefeliciteerd: "پیرۆزە!", pastNiet: "ناگونجێت!", gepast: "تێپەڕێنرا.", botPast: "بۆت تێپەڕاند.", botPakt: "بۆت هەڵیگرت.", jijBegint: "تۆ دەست پێ دەکەیت!", kopieer: "کۆپی", login: "چوونەژوورەوە", createAcc: "هەژمار دروست بکە", username: "ناوی بەکارهێنەر", password: "وشەی نهێنی", uitloggen: "دەرچوون", ofSpeel: "یان وەک میوان" },
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

function playTileSound() { try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = 250; g.gain.setValueAtTime(0.3, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15); o.start(); o.stop(c.currentTime + 0.15); } catch (e) { } }
function playLaughSound() { try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); [800, 600, 900, 500, 1000, 400, 800, 600].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = f; const t = c.currentTime + i * 0.12; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11); o.start(t); o.stop(t + 0.12); }); } catch (e) { } }
function playWinSound() { try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = f; const t = c.currentTime + i * 0.2; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5); o.start(t); o.stop(t + 0.5); }); } catch (e) { } }

function Confetti() {
  const [p] = useState(() => Array.from({ length: 50 }, (_, i) => ({ id: i, x: Math.random() * 100, delay: Math.random() * 2, dur: 2 + Math.random() * 3, size: 6 + Math.random() * 8, color: ["#FF0000", "#FFD700", "#00FF00", "#00BFFF", "#FF69B4", "#FFA500", "#9400D3"][Math.floor(Math.random() * 7)], round: Math.random() > 0.5 })));
  return (<div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">{p.map(x => <div key={x.id} className="absolute" style={{ left: `${x.x}%`, top: "-20px", width: `${x.size}px`, height: `${x.size}px`, backgroundColor: x.color, borderRadius: x.round ? "50%" : "2px", animation: `cfall ${x.dur}s ${x.delay}s linear forwards` }} />)}<style jsx>{`@keyframes cfall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}`}</style></div>);
}

function LaughOverlay({ onClose, lang }: { onClose: () => void; lang: "KU" | "NL" }) {
  const [show, setShow] = useState(true); const L = ["🤣", "😂", "😆"]; const [ci, setCi] = useState(0);
  useEffect(() => { playLaughSound(); const ei = setInterval(() => setCi(p => (p + 1) % L.length), 400); const tm = setTimeout(() => { setShow(false); setTimeout(onClose, 500) }, 4000); return () => { clearInterval(ei); clearTimeout(tm) } }, [onClose]);
  return (<div className={`fixed inset-0 z-[99] flex items-center justify-center transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}><div className="absolute inset-0 bg-black/60 backdrop-blur-sm" /><div className="relative z-10 flex flex-col items-center"><div style={{ animation: "blgh .8s ease-in-out infinite" }} className="text-[120px] sm:text-[180px] leading-none select-none">{L[ci]}</div><div className="mt-4 text-white font-black text-2xl sm:text-4xl animate-pulse">{lang === "KU" ? "تۆ دۆڕاویت! 😂" : "VERLOREN! 😂"}</div></div><style jsx>{`@keyframes blgh{0%,100%{transform:scale(1)}15%{transform:scale(1.3) rotate(-10deg)}45%{transform:scale(1.2) rotate(5deg)}}`}</style></div>);
}

function WinOverlay({ onClose, lang }: { onClose: () => void; lang: "KU" | "NL" }) {
  const [show, setShow] = useState(true);
  useEffect(() => { playWinSound(); const tm = setTimeout(() => { setShow(false); setTimeout(onClose, 500) }, 4000); return () => clearTimeout(tm) }, [onClose]);
  return (<div className={`fixed inset-0 z-[99] flex items-center justify-center transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}><div className="absolute inset-0 bg-black/50 backdrop-blur-sm" /><Confetti /><div className="relative z-10 flex flex-col items-center"><div className="text-[100px] sm:text-[150px] leading-none animate-bounce select-none">🏆</div><div className="mt-2 text-3xl animate-bounce">👑</div><div className="mt-4 text-yellow-400 font-black text-3xl sm:text-5xl animate-pulse">{lang === "KU" ? "تۆ بردیت!" : "JIJ WINT!"}</div></div></div>);
}

// ✅ Domino Chain - echte layout: dubbelen staan verticaal, rest horizontaal
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
              <Dots v={d[0]} sz={11} />
              <div className="w-[70%] h-px bg-[#C4B998]" />
              <Dots v={d[1]} sz={11} />
            </div>
          );
        }
        return (
          <div key={idx} className={`flex flex-row items-center justify-around rounded-md border-2 border-[#C4B998] shadow-lg flex-shrink-0 ${isNew ? "animate-pop" : ""}`}
            style={{ width: 52, height: 28, background: "linear-gradient(160deg, #FFFEF5, #F0E6D0)" }}>
            <Dots v={d[0]} sz={11} />
            <div className="h-[70%] w-px bg-[#C4B998]" />
            <Dots v={d[1]} sz={11} />
          </div>
        );
      })}
      <style jsx>{`@keyframes pop{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}.animate-pop{animation:pop 0.4s ease-out}`}</style>
    </div>
  );
}

export default function Home() {
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

  const sock = useRef<Socket | null>(null);
  const btm = useRef<HTMLDivElement>(null);
  const emos = ["🔥", "👏", "😂", "👋", "😍", "😎", "💯", "😡", "🥳", "😭", "🤣", "💀", "🎉", "❤️", "👑", "🐐", "😈", "💪", "🙏", "☀️"];

  const playerName = account?.username || "Gast";

  useEffect(() => { try { const s = localStorage.getItem("domino_account"); if (s) setAccount(JSON.parse(s)); } catch (e) { } }, []);
  const saveAccount = (a: Account) => { setAccount(a); localStorage.setItem("domino_account", JSON.stringify(a)); };
  const handleAuth = () => {
    if (!authUser.trim() || !authPass.trim()) { setAuthErr("Vul alles in!"); return; }
    const accs: Record<string, any> = JSON.parse(localStorage.getItem("domino_accounts") || "{}");
    if (authMode === "create") {
      if (accs[authUser.toLowerCase()]) { setAuthErr("Naam bezet!"); return; }
      const a: Account = { username: authUser, wins: 0, losses: 0, games: 0, avatar: authAvatar };
      accs[authUser.toLowerCase()] = { password: authPass, account: a };
      localStorage.setItem("domino_accounts", JSON.stringify(accs));
      saveAccount(a); setShowAuth(false); setAuthErr("");
    } else {
      const e = accs[authUser.toLowerCase()];
      if (!e) { setAuthErr("Niet gevonden!"); return; }
      if (e.password !== authPass) { setAuthErr("Fout wachtwoord!"); return; }
      saveAccount(e.account); setShowAuth(false); setAuthErr("");
    }
  };
  const updateStats = useCallback((won: boolean) => {
    setAccount(prev => {
      if (!prev) return prev;
      const u = { ...prev, games: prev.games + 1, wins: prev.wins + (won ? 1 : 0), losses: prev.losses + (won ? 0 : 1) };
      localStorage.setItem("domino_account", JSON.stringify(u));
      return u;
    });
  }, []);
  const logout = () => { setAccount(null); localStorage.removeItem("domino_account"); };

  useEffect(() => { btm.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  const trigEnd = useCallback((won: boolean) => { setIWon(won); updateStats(won); if (won) setShowWin(true); else setShowLaugh(true); }, [updateStats]);
  const sys = useCallback((s: string) => {
    setMsgs(p => [...p, { sender: "⚙️", text: s, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; });
  }, []);

  // Socket
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"], reconnection: true, reconnectionAttempts: 50, reconnectionDelay: 1000, timeout: 30000 });
    sock.current = s;
    s.on("connect", () => setStatus("on"));
    s.on("connect_error", () => setStatus("err"));
    s.on("disconnect", () => setStatus("off"));
    s.on("roomCreated", ({ code }: any) => { setRoom(code); setWaiting(true); setMode("online"); setView("game"); setGameOver(null); setMsgs([]); setTab("board"); setShowLaugh(false); setShowWin(false); setLastIdx(-1); });
    s.on("gameStarted", ({ p1, p2 }: any) => { setWaiting(false); setMode("online"); setView("game"); setGameOver(null); setShowLaugh(false); setShowWin(false); sys(`🎮 ${p1} vs ${p2}`); });
    s.on("gameState", (d: any) => {
      setBoard(prev => { if (d.board && d.board.length > prev.length) { setLastIdx(d.board.length - 1); playTileSound(); } return d.board || []; });
      setHand(d.hand || []); setPileCount(d.pileCount || 0); setOppCount(d.opponentHandCount || 0);
      setOppName(d.opponentName || "..."); setMyTurn(d.turn === d.playerIndex);
      if (d.started) { setWaiting(false); setView("game"); setMode("online"); }
      if (d.winner && !gameOver) { const w = d.winner.index === d.playerIndex; setGameOver(w ? "🎉" : "💀"); trigEnd(w); }
    });
    s.on("joinError", (m: string) => setJoinErr(m));
    s.on("tilePlayed", ({ playerName: pn, tile }: any) => sys(`🎯 ${pn}: [${tile[0]}|${tile[1]}]`));
    s.on("playerPassed", ({ name: n }: any) => sys(`⏭️ ${n}`));
    s.on("chatMsg", (m: Msg) => { setMsgs(p => [...p, m]); setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; }); });
    s.on("opponentLeft", () => { sys("❌"); setGameOver("❌"); });
    s.on("gameRestarted", () => { setGameOver(null); setShowLaugh(false); setShowWin(false); setLastIdx(-1); sys("🔄"); });
    s.on("playError", (m: string) => sys(`❌ ${m}`));
    return () => { s.removeAllListeners(); s.disconnect(); };
  }, [sys, trigEnd, gameOver]);

  const oCreate = () => { if (status !== "on") { setJoinErr(t.serverStart); fetch(SOCKET_URL).catch(() => {}); return; } setJoinErr(""); sock.current?.emit("createRoom", { playerName }); };
  const oJoin = () => { const c = input.trim().toUpperCase(); if (!c) { setJoinErr(t.vulCode); return; } if (status !== "on") { setJoinErr(t.serverStart); return; } setJoinErr(""); setRoom(c); setMode("online"); setMsgs([]); setTab("board"); setGameOver(null); sock.current?.emit("joinRoom", { code: c, playerName }); };
  const oPlay = (i: number) => { if (myTurn && !gameOver) sock.current?.emit("playTile", { tileIndex: i }); };
  const oDraw = () => { if (myTurn && !gameOver) sock.current?.emit("drawTile"); };
  const oPass = () => { if (myTurn && !gameOver) sock.current?.emit("passTurn"); };
  const oChat = (s: string) => { if (s.trim()) { sock.current?.emit("sendChat", { text: s.trim() }); setMsg(""); setShowEm(false); } };
  const oRestart = () => { setShowLaugh(false); setShowWin(false); setLastIdx(-1); sock.current?.emit("restartGame"); };

  // ✅ FIXED Bot game
  const startBot = () => {
    const a = shuf(allT());
    setHand(a.slice(0, 7)); setBotHand(a.slice(7, 14)); setPile(a.slice(14));
    setBoard([]); setMyTurn(true); setGameOver(null); setMode("bot"); setView("game"); setRoom("BOT");
    setMsgs([]); setTab("board"); setOppName("Bot 🤖"); setOppCount(7); setPileCount(14);
    setShowLaugh(false); setShowWin(false); setLastIdx(-1);
    setTimeout(() => sys(`🤖 ${t.jijBegint}`), 100);
  };

  // ✅ FIXED: Speler legt een tegel
  const bPlay = (tile: Tile, idx: number) => {
    if (!myTurn || gameOver) return;

    const ends = getEnds(board);
    const side = canPlay(tile, board, ends);

    // Eerste tegel kan altijd
    if (!board.length) {
      const entry: BE = { tile, flipped: false };
      const nb = [entry];
      setBoard(nb); setLastIdx(0); playTileSound();
      const nh = hand.filter((_, i) => i !== idx); setHand(nh);
      sys(`🎯 ${playerName}: [${tile[0]}|${tile[1]}]`);
      if (!nh.length) { setGameOver("🎉"); trigEnd(true); return; }
      setMyTurn(false); setTimeout(() => botMove(nb), 800);
      return;
    }

    if (!side) { sys(`❌ ${t.pastNiet}`); return; }

    const fl = shouldFlip(tile, side, ends, false);
    const entry: BE = { tile, flipped: fl };

    let nb: BE[];
    let newIdx: number;
    if (side === "left") {
      nb = [entry, ...board];
      newIdx = 0;
    } else {
      nb = [...board, entry];
      newIdx = nb.length - 1;
    }

    setBoard(nb); setLastIdx(newIdx); playTileSound();
    const nh = hand.filter((_, i) => i !== idx); setHand(nh);
    sys(`🎯 ${playerName}: [${tile[0]}|${tile[1]}]`);

    if (!nh.length) { setGameOver("🎉"); trigEnd(true); return; }
    setMyTurn(false); setTimeout(() => botMove(nb), 800);
  };

  // ✅ FIXED Bot AI
  const botMove = (currentBoard: BE[]) => {
    setBotHand(prevBot => {
      const ends = getEnds(currentBoard);

      // Zoek beste tegel
      let bestIdx = -1;
      let bestSide: "left" | "right" | null = null;
      let bestScore = -1;

      for (let i = 0; i < prevBot.length; i++) {
        const side = canPlay(prevBot[i], currentBoard, ends);
        if (side) {
          const score = (prevBot[i][0] === prevBot[i][1] ? 10 : 0) + prevBot[i][0] + prevBot[i][1];
          if (score > bestScore) { bestScore = score; bestIdx = i; bestSide = side; }
        }
      }

      if (bestIdx === -1) {
        // Kan niet spelen - pak uit pot
        setPile(currentPile => {
          if (!currentPile.length) {
            sys(`🤖 ${t.botPast}`); setMyTurn(true); return currentPile;
          }
          const np = [...currentPile]; const drawn = np.pop()!;
          setPileCount(np.length);

          // Probeer getrokken tegel te spelen
          const drawnSide = canPlay(drawn, currentBoard, ends);
          if (drawnSide) {
            const fl = shouldFlip(drawn, drawnSide, ends, false);
            const entry: BE = { tile: drawn, flipped: fl };
            const nb = drawnSide === "left" ? [entry, ...currentBoard] : [...currentBoard, entry];
            setBoard(nb); setLastIdx(drawnSide === "left" ? 0 : nb.length - 1); playTileSound();
            sys(`🤖 [${drawn[0]}|${drawn[1]}]`);
            setOppCount(prevBot.length);
            if (prevBot.length === 0) { setGameOver("💀"); trigEnd(false); }
            setMyTurn(true);
            return np;
          } else {
            sys(`🤖 ${t.botPakt}`);
            setBotHand(bh => [...bh, drawn]);
            setOppCount(prevBot.length + 1);
            setMyTurn(true);
            return np;
          }
        });
        return prevBot;
      }

      // Speel de beste tegel
      const bt = prevBot[bestIdx];
      const fl = shouldFlip(bt, bestSide!, ends, currentBoard.length === 0);
      const entry: BE = { tile: bt, flipped: fl };
      const nb = bestSide === "left" ? [entry, ...currentBoard] : [...currentBoard, entry];
      setBoard(nb); setLastIdx(bestSide === "left" ? 0 : nb.length - 1); playTileSound();
      sys(`🤖 [${bt[0]}|${bt[1]}]`);

      const nbh = prevBot.filter((_, i) => i !== bestIdx);
      setOppCount(nbh.length);
      if (!nbh.length) { setGameOver("💀"); trigEnd(false); }
      setMyTurn(true);
      return nbh;
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
    setMyTurn(false); sys(`⏭️ ${t.gepast}`);
    setTimeout(() => botMove(board), 800);
  };
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

      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" />
        <div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" />
        <div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" />
        <div className="absolute inset-0 flex items-center justify-center"><Sun s={view === "menu" ? 250 : 400} c={view === "menu" ? "opacity-35" : "opacity-[0.12]"} /></div>
      </div>
      {view === "game" && <div className="fixed inset-0 z-[1] bg-black/40" />}

      <div className="fixed top-2 right-2 flex gap-1 z-50">
        {view === "menu" && <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full mr-1"><div className={`w-2 h-2 rounded-full ${status === "on" ? "bg-green-400 animate-pulse" : "bg-red-500"}`} /></div>}
        <button onClick={() => setLang("KU")} className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${lang === "KU" ? "bg-yellow-500 text-black" : "bg-black/40 text-white/60"}`}>کوردی</button>
        <button onClick={() => setLang("NL")} className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${lang === "NL" ? "bg-yellow-500 text-black" : "bg-black/40 text-white/60"}`}>NL</button>
      </div>

      {showAuth && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl p-5 w-[300px] shadow-2xl border border-white/10">
            <h2 className="text-white font-black text-lg text-center mb-3">{authMode === "login" ? t.login : t.createAcc}</h2>
            {authMode === "create" && (<div className="flex justify-center gap-2 mb-3 flex-wrap">{avatars.map(a => (<button key={a} onClick={() => setAuthAvatar(a)} className={`text-2xl p-1 rounded-lg ${authAvatar === a ? "bg-yellow-500 scale-110" : "bg-white/5"}`}>{a}</button>))}</div>)}
            <input type="text" placeholder={t.username} value={authUser} onChange={e => setAuthUser(e.target.value)} className="w-full p-2.5 rounded-xl text-center font-bold text-black bg-white mb-2 text-sm" />
            <input type="password" placeholder={t.password} value={authPass} onChange={e => setAuthPass(e.target.value)} className="w-full p-2.5 rounded-xl text-center font-bold text-black bg-white mb-2 text-sm" />
            {authErr && <p className="text-red-400 text-[10px] text-center mb-2 font-bold">⚠️ {authErr}</p>}
            <button onClick={handleAuth} className="w-full bg-yellow-500 text-black font-black py-2.5 rounded-xl mb-2 text-sm">{authMode === "login" ? `🔑 ${t.login}` : `✨ ${t.createAcc}`}</button>
            <button onClick={() => { setAuthMode(authMode === "login" ? "create" : "login"); setAuthErr(""); }} className="w-full text-white/50 text-[10px] text-center py-1">{authMode === "login" ? t.createAcc : t.login}</button>
            <button onClick={() => setShowAuth(false)} className="w-full text-white/30 text-[10px] text-center py-1">✕</button>
          </div>
        </div>
      )}

      {view === "menu" ? (
        <div className="flex flex-col items-center z-10 w-full max-w-[300px] px-5 py-3">
          <div className="relative mb-1"><Sun s={60} c="absolute -top-1 left-1/2 -translate-x-1/2 opacity-80" /><h1 className="text-[40px] font-black text-white italic drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)] relative z-10">DOMINO</h1></div>
          <p className="text-white/80 text-[10px] mb-3 font-bold bg-black/30 px-3 py-1 rounded-full">☀️ 28 {t.stenen} • 7 {t.perSpeler}</p>

          {account ? (
            <div className="w-full bg-black/30 rounded-2xl p-3 mb-3 border border-yellow-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{account.avatar}</div>
                  <div><div className="text-white font-bold text-sm">{account.username}</div><div className="text-white/40 text-[9px]">🏆{account.wins} 💀{account.losses} 🎮{account.games}</div></div>
                </div>
                <button onClick={logout} className="text-white/30 text-[9px] bg-white/5 px-2 py-1 rounded-lg">{t.uitloggen}</button>
              </div>
            </div>
          ) : (
            <div className="w-full mb-3">
              <button onClick={() => { setShowAuth(true); setAuthMode("login"); setAuthErr(""); }} className="w-full bg-black/30 text-white font-bold py-2.5 rounded-2xl mb-1.5 border border-white/10 text-sm">🔑 {t.login} / {t.createAcc}</button>
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
        <div className="w-full h-[100dvh] flex flex-col z-10">
          <div className="flex items-center justify-between px-2 py-1.5 flex-shrink-0 relative overflow-hidden">
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #ED2024 0%, #ED2024 30%, rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.2) 70%, #21A038 70%)" }} />
            <div className="absolute inset-0 bg-black/30" />
            <button onClick={() => { setView("menu"); setWaiting(false); setShowLaugh(false); setShowWin(false); }} className="text-white text-lg px-1 relative z-10">↩</button>
            <div className="flex items-center gap-1.5 relative z-10">
              <span className="bg-yellow-500 text-black px-2.5 py-0.5 rounded-lg font-black text-[11px]">{room}</span>
              {room !== "BOT" && <button onClick={copy} className="text-white text-[10px] bg-black/30 px-2 py-0.5 rounded-lg font-bold">{copied ? "✅" : "📋"}</button>}
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black shadow relative z-10 ${myTurn ? "bg-green-500 text-black" : "bg-red-500 text-white"}`}>
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
              <div className="bg-black/50 px-2 py-1.5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-1.5"><div className="w-7 h-7 rounded-full bg-red-900/80 flex items-center justify-center text-xs">👤</div><div><div className="text-white font-bold text-[11px]">{oppName}</div><div className="text-white/30 text-[9px]">{cOpp} {t.stenen}</div></div></div>
                <div className="flex gap-px overflow-hidden max-w-[55%]">{[...Array(Math.min(cOpp, 14))].map((_, i) => <Back key={i} />)}</div>
              </div>

              <div className="flex-1 relative overflow-auto">
                <div className="absolute inset-0"><div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]/20" /><div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white/10" /><div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]/20" /></div>
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
                    <DominoChain board={board} lastIdx={lastIdx} />
                  )}
                </div>
              </div>

              <div className="bg-black/60 px-2 py-1.5 flex items-center justify-between flex-shrink-0 border-t border-yellow-500/30">
                <div className="flex items-center gap-1.5"><div className="w-7 h-7 rounded-full bg-yellow-700/80 flex items-center justify-center text-xs">{account?.avatar || "☀️"}</div><div><div className="text-white font-bold text-[11px]">{playerName}</div><div className="text-white/30 text-[9px]">{hand.length} {t.stenen}</div></div></div>
                <div className="flex gap-1.5 items-center">
                  {!canAny() && myTurn && !gameOver && cPile > 0 && <span className="text-red-400 text-[8px] animate-pulse">⚠️</span>}
                  <button onClick={draw} disabled={!myTurn || !!gameOver || cPile === 0} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-25 active:bg-blue-500 shadow">📦 {t.pak}</button>
                  {!canAny() && myTurn && !gameOver && cPile === 0 && <button onClick={pass} className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold active:bg-orange-500 shadow">⏭️ {t.pas}</button>}
                </div>
              </div>
            </div>

            <div className={`w-full sm:w-52 md:w-56 bg-black/50 flex flex-col border-l border-yellow-500/10 ${tab === "board" ? "hidden sm:flex" : "flex"}`}>
              <div className="text-white/40 font-bold text-[10px] text-center py-1.5 bg-yellow-500/10 hidden sm:block">💬 {t.chat}</div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
                {!msgs.length && <div className="text-white/15 text-[10px] text-center mt-8">{t.geenBerichten}</div>}
                {msgs.map((m, i) => (
                  <div key={i} className={`p-1.5 rounded-lg text-[10px] ${m.sender === "⚙️" ? "bg-blue-500/10 text-blue-300/80 italic" : m.sender.includes("🤖") ? "bg-red-500/10 text-red-300/80" : "bg-white/5 text-white/80"}`}>
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

          <div className="px-1.5 py-2 border-t-2 border-yellow-500/40 flex-shrink-0" style={{ background: "linear-gradient(to top, #070710, #0d1117, #161b22)" }}>
            {!canAny() && myTurn && !gameOver && cPile > 0 && (<div className="text-center text-red-400/80 text-[9px] font-bold mb-1 animate-pulse">⚠️ {t.pakUitPot}</div>)}
            <div className="flex justify-center gap-[3px] overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
              {hand.map((ti, i) => {
                const ends = getEnds(board);
                const ok = !board.length || canPlay(ti, board, ends) !== null;
                return (
                  <div key={`${ti[0]}-${ti[1]}-${i}`} onClick={() => play(ti, i)}
                    className={`flex-shrink-0 transition-all duration-200 ${!myTurn || gameOver ? "opacity-20 pointer-events-none" : ok ? "active:scale-90 sm:hover:-translate-y-3" : "opacity-25"}`}>
                    <HandTile v={ti} hl={ok && myTurn && !gameOver} sm={hand.length > 6} />
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