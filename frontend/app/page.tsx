"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://dominos-app.onrender.com";

type Tile = [number, number];
type Msg = { sender: string; text: string; time: string };
type BE = { tile: Tile; flipped: boolean };
type Account = { username: string; wins: number; losses: number; games: number; avatar: string; created: number };

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
function allT(): Tile[] { const t: Tile[] = []; for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) t.push([i, j]); return t; }
function shuf(a: Tile[]): Tile[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

const txt = {
  NL: { stenen:"stenen",perSpeler:"per speler",tegenBot:"Tegen Bot",kamerMaken:"Kamer Maken",joinen:"Joinen",jij:"Jij",jouwBeurt:"Jouw beurt",spel:"Spel",chat:"Chat",legEerste:"Leg eerste steen!",wachtVriend:"Wacht op vriend...",pak:"Pak",pas:"Pas",pakUitPot:"Pak uit de pot!",geenBerichten:"Geen berichten",typ:"Typ...",stuurCode:"Stuur code!",vulCode:"Vul code in!",serverStart:"Server start op...",opnieuw:"Opnieuw",verloren:"VERLOREN!",gewonnen:"JIJ WINT!",gefeliciteerd:"Gefeliciteerd!",pastNiet:"Past niet!",gepast:"Gepast.",botPast:"Bot past.",botPakt:"Bot pakt.",jijBegint:"Jij begint!",kopieer:"Kopieer",welkom:"Welkom bij",login:"Inloggen",maakAcc:"Account Maken",gebruiker:"Gebruikersnaam",wachtwoord:"Wachtwoord",kiesAvatar:"Kies je avatar",heb:"Heb al een account?",geenAcc:"Nog geen account?",uitloggen:"Uitloggen",wins:"Gewonnen",losses:"Verloren",games:"Gespeeld",ofGast:"Of speel als gast →" },
  KU: { stenen:"تابلۆ",perSpeler:"بۆ هەر یاریزان",tegenBot:"دژی بۆت",kamerMaken:"دروستکردنی ژوور",joinen:"چوونە ناو",jij:"تۆ",jouwBeurt:"نۆبەی تۆ",spel:"یاری",chat:"چات",legEerste:"یەکەم تابلۆ دابنێ!",wachtVriend:"چاوەڕوانی هاوڕێ...",pak:"هەڵگرتن",pas:"تێپەڕاندن",pakUitPot:"لە پۆت هەڵبگرە!",geenBerichten:"هیچ پەیامێک نییە",typ:"بنووسە...",stuurCode:"کۆدەکە بنێرە!",vulCode:"کۆدەکە بنووسە!",serverStart:"سێرڤەر دەست پێ دەکات...",opnieuw:"دووبارە",verloren:"تۆ دۆڕاویت!",gewonnen:"تۆ بردیت!",gefeliciteerd:"پیرۆزە!",pastNiet:"ناگونجێت!",gepast:"تێپەڕێنرا.",botPast:"بۆت تێپەڕاند.",botPakt:"بۆت هەڵیگرت.",jijBegint:"تۆ دەست پێ دەکەیت!",kopieer:"کۆپی",welkom:"بەخێربێیت بۆ",login:"چوونەژوورەوە",maakAcc:"هەژمار دروستکردن",gebruiker:"ناوی بەکارهێنەر",wachtwoord:"وشەی نهێنی",kiesAvatar:"ئاواتارەکەت هەڵبژێرە",heb:"هەژمارت هەیە؟",geenAcc:"هەژمارت نییە؟",uitloggen:"دەرچوون",wins:"بردن",losses:"دۆڕان",games:"یاری",ofGast:"یان وەک میوان بچۆ →" },
};

const D: number[][] = [[],[4],[2,6],[2,4,6],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];
const Dots = ({v,sz}:{v:number;sz:number}) => (<div className="grid grid-cols-3 gap-px" style={{width:sz,height:sz}}>{[...Array(9)].map((_,i)=><div key={i} className={`rounded-full ${D[v].includes(i)?"bg-gray-900":""}`} style={{width:"100%",aspectRatio:"1"}}/>)}</div>);
const Sun = ({s=200,c=""}:{s?:number;c?:string}) => (<svg width={s} height={s} viewBox="0 0 200 200" className={c}>{[...Array(21)].map((_,i)=>{const a=(i*360)/21-90,r=(a*Math.PI)/180,lr=((a-8)*Math.PI)/180,rr=((a+8)*Math.PI)/180;return <polygon key={i} points={`${100+Math.cos(lr)*45},${100+Math.sin(lr)*45} ${100+Math.cos(r)*90},${100+Math.sin(r)*90} ${100+Math.cos(rr)*45},${100+Math.sin(rr)*45}`} fill="#FCBF09"/>})}<circle cx="100" cy="100" r="45" fill="#FCBF09"/></svg>);

function playTileSound(){try{const c=new(window.AudioContext||(window as any).webkitAudioContext)();const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="triangle";o.frequency.value=250;g.gain.setValueAtTime(0.3,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.15);o.start();o.stop(c.currentTime+0.15)}catch(e){}}
function playLaughSound(){try{const c=new(window.AudioContext||(window as any).webkitAudioContext)();[800,600,900,500,1000,400,800,600].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=f;const t=c.currentTime+i*0.12;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.15,t+0.02);g.gain.exponentialRampToValueAtTime(0.001,t+0.11);o.start(t);o.stop(t+0.12)})}catch(e){}}
function playWinSound(){try{const c=new(window.AudioContext||(window as any).webkitAudioContext)();[523,659,784,1047].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=f;const t=c.currentTime+i*0.2;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.2,t+0.05);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);o.start(t);o.stop(t+0.5)})}catch(e){}}

function Confetti(){const[p]=useState(()=>Array.from({length:50},(_,i)=>({id:i,x:Math.random()*100,delay:Math.random()*2,dur:2+Math.random()*3,size:6+Math.random()*8,color:["#FF0000","#FFD700","#00FF00","#00BFFF","#FF69B4","#FFA500","#9400D3"][Math.floor(Math.random()*7)],round:Math.random()>0.5})));return(<div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">{p.map(x=><div key={x.id} className="absolute" style={{left:`${x.x}%`,top:"-20px",width:`${x.size}px`,height:`${x.size}px`,backgroundColor:x.color,borderRadius:x.round?"50%":"2px",animation:`cfall ${x.dur}s ${x.delay}s linear forwards`}}/>)}<style jsx>{`@keyframes cfall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}`}</style></div>)}
function LaughOverlay({onClose,lang}:{onClose:()=>void;lang:"KU"|"NL"}){const[show,setShow]=useState(true);const L=["🤣","😂","😆"];const[ci,setCi]=useState(0);useEffect(()=>{playLaughSound();const ei=setInterval(()=>setCi(p=>(p+1)%L.length),400);const tm=setTimeout(()=>{setShow(false);setTimeout(onClose,500)},4000);return()=>{clearInterval(ei);clearTimeout(tm)}},[onClose]);return(<div className={`fixed inset-0 z-[99] flex items-center justify-center transition-opacity duration-500 ${show?"opacity-100":"opacity-0"}`}><div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/><div className="relative z-10 flex flex-col items-center"><div style={{animation:"blgh .8s ease-in-out infinite"}} className="text-[120px] sm:text-[180px] leading-none select-none">{L[ci]}</div><div className="mt-4 text-white font-black text-2xl sm:text-4xl animate-pulse">{lang==="KU"?"تۆ دۆڕاویت! 😂":"VERLOREN! 😂"}</div></div><style jsx>{`@keyframes blgh{0%,100%{transform:scale(1)}15%{transform:scale(1.3) rotate(-10deg)}45%{transform:scale(1.2) rotate(5deg)}}`}</style></div>)}
function WinOverlay({onClose,lang}:{onClose:()=>void;lang:"KU"|"NL"}){const[show,setShow]=useState(true);useEffect(()=>{playWinSound();const tm=setTimeout(()=>{setShow(false);setTimeout(onClose,500)},4000);return()=>clearTimeout(tm)},[onClose]);return(<div className={`fixed inset-0 z-[99] flex items-center justify-center transition-opacity duration-500 ${show?"opacity-100":"opacity-0"}`}><div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/><Confetti/><div className="relative z-10 flex flex-col items-center"><div className="text-[100px] sm:text-[150px] leading-none animate-bounce select-none">🏆</div><div className="mt-2 text-3xl animate-bounce">👑</div><div className="mt-4 text-yellow-400 font-black text-3xl sm:text-5xl animate-pulse">{lang==="KU"?"تۆ بردیت!":"JIJ WINT!"}</div></div></div>)}

function DominoChain({board,lastIdx}:{board:BE[];lastIdx:number}){
  return(<div className="flex flex-wrap items-center justify-center gap-[2px] p-2">{board.map((entry,idx)=>{const tile=entry.tile;const d:Tile=entry.flipped?[tile[1],tile[0]]:tile;const isDouble=tile[0]===tile[1];const isNew=idx===lastIdx;
  if(isDouble){return(<div key={idx} className={`flex flex-col items-center justify-around rounded-md border-2 border-[#C4B998] shadow-lg flex-shrink-0 ${isNew?"animate-pop":""}`} style={{width:28,height:52,background:"linear-gradient(160deg, #FFFEF5, #F0E6D0)"}}><Dots v={d[0]} sz={11}/><div className="w-[70%] h-px bg-[#C4B998]"/><Dots v={d[1]} sz={11}/></div>)}
  return(<div key={idx} className={`flex flex-row items-center justify-around rounded-md border-2 border-[#C4B998] shadow-lg flex-shrink-0 ${isNew?"animate-pop":""}`} style={{width:52,height:28,background:"linear-gradient(160deg, #FFFEF5, #F0E6D0)"}}><Dots v={d[0]} sz={11}/><div className="h-[70%] w-px bg-[#C4B998]"/><Dots v={d[1]} sz={11}/></div>)})}<style jsx>{`@keyframes pop{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}.animate-pop{animation:pop 0.4s ease-out}`}</style></div>)}

export default function Home() {
  // ✅ STAP 1: Account is VERPLICHT - begin op login scherm
  const [account, setAccount] = useState<Account | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "create">("create");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authAvatar, setAuthAvatar] = useState("😎");
  const [authStep, setAuthStep] = useState(1); // 1=avatar, 2=credentials
  const avatars = ["😎","🤖","👑","🔥","💀","🐐","☀️","🦁","🎲","💪","😈","🥶","🧔","⚡","🌟","🎯"];

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
  const emos = ["🔥","👏","😂","👋","😍","😎","💯","😡","🥳","😭","🤣","💀","🎉","❤️","👑","🐐","😈","💪","🙏","☀️"];

  const playerName = account?.username || "Gast";

  // ✅ Load saved account
  useEffect(() => {
    try { const s = localStorage.getItem("domino_account"); if (s) setAccount(JSON.parse(s)); } catch(e){}
    setAuthLoaded(true);
  }, []);

  const saveAccount = (a: Account) => { setAccount(a); localStorage.setItem("domino_account", JSON.stringify(a)); };

  const handleAuth = () => {
    if (authMode === "create" && authStep === 1) { setAuthStep(2); return; }
    if (!authUser.trim()) { setAuthErr(lang === "KU" ? "ناوەکە بنووسە!" : "Vul een naam in!"); return; }
    if (authUser.trim().length < 2) { setAuthErr(lang === "KU" ? "ناوەکە کورتە!" : "Naam te kort!"); return; }
    if (!authPass.trim()) { setAuthErr(lang === "KU" ? "وشەی نهێنی بنووسە!" : "Vul wachtwoord in!"); return; }
    if (authPass.trim().length < 3) { setAuthErr(lang === "KU" ? "وشەی نهێنی کورتە!" : "Wachtwoord te kort!"); return; }

    const accs: Record<string, any> = JSON.parse(localStorage.getItem("domino_accounts") || "{}");
    if (authMode === "create") {
      if (accs[authUser.toLowerCase()]) { setAuthErr(lang === "KU" ? "ئەم ناوە بەکارهاتووە!" : "Naam al in gebruik!"); return; }
      const a: Account = { username: authUser.trim(), wins: 0, losses: 0, games: 0, avatar: authAvatar, created: Date.now() };
      accs[authUser.toLowerCase()] = { password: authPass, account: a };
      localStorage.setItem("domino_accounts", JSON.stringify(accs));
      saveAccount(a);
    } else {
      const e = accs[authUser.toLowerCase()];
      if (!e) { setAuthErr(lang === "KU" ? "هەژمار نەدۆزرایەوە!" : "Account niet gevonden!"); return; }
      if (e.password !== authPass) { setAuthErr(lang === "KU" ? "وشەی نهێنی هەڵەیە!" : "Fout wachtwoord!"); return; }
      saveAccount(e.account);
    }
    setAuthErr("");
  };

  const updateStats = useCallback((won: boolean) => {
    setAccount(prev => { if (!prev) return prev; const u = { ...prev, games: prev.games + 1, wins: prev.wins + (won ? 1 : 0), losses: prev.losses + (won ? 0 : 1) }; localStorage.setItem("domino_account", JSON.stringify(u)); const accs: Record<string, any> = JSON.parse(localStorage.getItem("domino_accounts") || "{}"); if (accs[prev.username.toLowerCase()]) { accs[prev.username.toLowerCase()].account = u; localStorage.setItem("domino_accounts", JSON.stringify(accs)); } return u; });
  }, []);

  const logout = () => { setAccount(null); localStorage.removeItem("domino_account"); setAuthMode("create"); setAuthStep(1); setAuthUser(""); setAuthPass(""); setAuthErr(""); };

  useEffect(() => { btm.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  const trigEnd = useCallback((won: boolean) => { setIWon(won); updateStats(won); if (won) setShowWin(true); else setShowLaugh(true); }, [updateStats]);
  const sys = useCallback((s: string) => { setMsgs(p => [...p, { sender: "⚙️", text: s, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; }); }, []);

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"], reconnection: true, reconnectionAttempts: 50, reconnectionDelay: 1000, timeout: 30000 });
    sock.current = s;
    s.on("connect", () => setStatus("on")); s.on("connect_error", () => setStatus("err")); s.on("disconnect", () => setStatus("off"));
    s.on("roomCreated", ({ code }: any) => { setRoom(code); setWaiting(true); setMode("online"); setView("game"); setGameOver(null); setMsgs([]); setTab("board"); setShowLaugh(false); setShowWin(false); setLastIdx(-1); });
    s.on("gameStarted", ({ p1, p2 }: any) => { setWaiting(false); setMode("online"); setView("game"); setGameOver(null); sys(`🎮 ${p1} vs ${p2}`); });
    s.on("gameState", (d: any) => { setBoard(prev => { if (d.board?.length > prev.length) { setLastIdx(d.board.length - 1); playTileSound(); } return d.board || []; }); setHand(d.hand || []); setPileCount(d.pileCount || 0); setOppCount(d.opponentHandCount || 0); setOppName(d.opponentName || "..."); setMyTurn(d.turn === d.playerIndex); if (d.started) { setWaiting(false); setView("game"); setMode("online"); } if (d.winner && !gameOver) { trigEnd(d.winner.index === d.playerIndex); setGameOver(d.winner.index === d.playerIndex ? "🎉" : "💀"); } });
    s.on("joinError", (m: string) => setJoinErr(m)); s.on("tilePlayed", ({ playerName: pn, tile }: any) => sys(`🎯 ${pn}: [${tile[0]}|${tile[1]}]`)); s.on("playerPassed", ({ name: n }: any) => sys(`⏭️ ${n}`));
    s.on("chatMsg", (m: Msg) => { setMsgs(p => [...p, m]); setTab(prev => { if (prev !== "chat") setUnread(c => c + 1); return prev; }); });
    s.on("opponentLeft", () => { sys("❌"); setGameOver("❌"); }); s.on("gameRestarted", () => { setGameOver(null); setShowLaugh(false); setShowWin(false); setLastIdx(-1); sys("🔄"); }); s.on("playError", (m: string) => sys(`❌ ${m}`));
    return () => { s.removeAllListeners(); s.disconnect(); };
  }, [sys, trigEnd, gameOver]);

  const oCreate = () => { if (status !== "on") { setJoinErr(t.serverStart); fetch(SOCKET_URL).catch(() => {}); return; } setJoinErr(""); sock.current?.emit("createRoom", { playerName }); };
  const oJoin = () => { const c = input.trim().toUpperCase(); if (!c) { setJoinErr(t.vulCode); return; } if (status !== "on") { setJoinErr(t.serverStart); return; } setJoinErr(""); setRoom(c); setMode("online"); setMsgs([]); setTab("board"); setGameOver(null); sock.current?.emit("joinRoom", { code: c, playerName }); };
  const oPlay = (i: number) => { if (myTurn && !gameOver) sock.current?.emit("playTile", { tileIndex: i }); };
  const oDraw = () => { if (myTurn && !gameOver) sock.current?.emit("drawTile"); };
  const oPass = () => { if (myTurn && !gameOver) sock.current?.emit("passTurn"); };
  const oChat = (s: string) => { if (s.trim()) { sock.current?.emit("sendChat", { text: s.trim() }); setMsg(""); setShowEm(false); } };
  const oRestart = () => { setShowLaugh(false); setShowWin(false); setLastIdx(-1); sock.current?.emit("restartGame"); };

  const startBot = () => { const a = shuf(allT()); setHand(a.slice(0,7)); setBotHand(a.slice(7,14)); setPile(a.slice(14)); setBoard([]); setMyTurn(true); setGameOver(null); setMode("bot"); setView("game"); setRoom("BOT"); setMsgs([]); setTab("board"); setOppName("Bot 🤖"); setOppCount(7); setPileCount(14); setShowLaugh(false); setShowWin(false); setLastIdx(-1); setTimeout(() => sys(`🤖 ${t.jijBegint}`), 100); };

  const bPlay = (tile: Tile, idx: number) => {
    if (!myTurn || gameOver) return;
    if (!board.length) { const nb = [{ tile, flipped: false }]; setBoard(nb); setLastIdx(0); playTileSound(); const nh = hand.filter((_, i) => i !== idx); setHand(nh); sys(`🎯 ${playerName}: [${tile[0]}|${tile[1]}]`); if (!nh.length) { setGameOver("🎉"); trigEnd(true); return; } setMyTurn(false); setTimeout(() => botMove(nb), 800); return; }
    const ends = getEnds(board); const side = canPlay(tile, board, ends);
    if (!side) { sys(`❌ ${t.pastNiet}`); return; }
    const fl = shouldFlip(tile, side, ends, false); const entry: BE = { tile, flipped: fl };
    const nb = side === "left" ? [entry, ...board] : [...board, entry]; const ni = side === "left" ? 0 : nb.length - 1;
    setBoard(nb); setLastIdx(ni); playTileSound(); const nh = hand.filter((_, i) => i !== idx); setHand(nh); sys(`🎯 ${playerName}: [${tile[0]}|${tile[1]}]`);
    if (!nh.length) { setGameOver("🎉"); trigEnd(true); return; } setMyTurn(false); setTimeout(() => botMove(nb), 800);
  };

  const botMove = (cb: BE[]) => {
    setBotHand(prev => {
      const ends = getEnds(cb); let bi = -1, bs: "left" | "right" | null = null, bsc = -1;
      for (let i = 0; i < prev.length; i++) { const s = canPlay(prev[i], cb, ends); if (s) { const sc = (prev[i][0] === prev[i][1] ? 10 : 0) + prev[i][0] + prev[i][1]; if (sc > bsc) { bsc = sc; bi = i; bs = s; } } }
      if (bi === -1) { setPile(cp => { if (!cp.length) { sys(`🤖 ${t.botPast}`); setMyTurn(true); return cp; } const np = [...cp]; const dr = np.pop()!; setPileCount(np.length); const ds = canPlay(dr, cb, ends); if (ds) { const fl = shouldFlip(dr, ds, ends, false); const nb = ds === "left" ? [{ tile: dr, flipped: fl }, ...cb] : [...cb, { tile: dr, flipped: fl }]; setBoard(nb); setLastIdx(ds === "left" ? 0 : nb.length - 1); playTileSound(); sys(`🤖 [${dr[0]}|${dr[1]}]`); setOppCount(prev.length); if (!prev.length) { setGameOver("💀"); trigEnd(false); } setMyTurn(true); return np; } sys(`🤖 ${t.botPakt}`); setBotHand(bh => [...bh, dr]); setOppCount(prev.length + 1); setMyTurn(true); return np; }); return prev; }
      const bt = prev[bi]; const fl = shouldFlip(bt, bs!, ends, cb.length === 0); const nb = bs === "left" ? [{ tile: bt, flipped: fl }, ...cb] : [...cb, { tile: bt, flipped: fl }];
      setBoard(nb); setLastIdx(bs === "left" ? 0 : nb.length - 1); playTileSound(); sys(`🤖 [${bt[0]}|${bt[1]}]`);
      const nbh = prev.filter((_, i) => i !== bi); setOppCount(nbh.length); if (!nbh.length) { setGameOver("💀"); trigEnd(false); } setMyTurn(true); return nbh;
    });
  };

  const bDraw = () => { if (!myTurn || gameOver || !pile.length) return; const np = [...pile]; const d = np.pop()!; setPile(np); setHand(p => [...p, d]); setPileCount(np.length); sys(`📦 [${d[0]}|${d[1]}]`); };
  const bPass = () => { if (!myTurn || gameOver) return; setMyTurn(false); sys(`⏭️ ${t.gepast}`); setTimeout(() => botMove(board), 800); };
  const bChat = (s: string) => { if (!s.trim()) return; setMsgs(p => [...p, { sender: playerName, text: s.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); setMsg(""); setShowEm(false); setTimeout(() => { const r = ["😂","🔥","💯","💪","☀️","👏","👍","😈"]; setMsgs(p => [...p, { sender: "🤖", text: r[Math.floor(Math.random() * r.length)], time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); }, 800 + Math.random() * 1200); };

  const play = (ti: Tile, i: number) => mode === "bot" ? bPlay(ti, i) : oPlay(i);
  const draw = () => mode === "bot" ? bDraw() : oDraw();
  const pass = () => mode === "bot" ? bPass() : oPass();
  const sendC = (s: string) => mode === "bot" ? bChat(s) : oChat(s);
  const restart = () => mode === "bot" ? startBot() : oRestart();
  const copy = () => { navigator.clipboard.writeText(room).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const canAny = () => !board.length || hand.some(ti => canPlay(ti, board, getEnds(board)) !== null);
  const cPile = mode === "bot" ? pile.length : pileCount;
  const cOpp = mode === "bot" ? botHand.length : oppCount;

  const HandTile = ({v,hl,sm}:{v:Tile;hl?:boolean;sm?:boolean}) => (<div className={`${sm?"w-[32px] h-[64px]":"w-[40px] h-[80px]"} rounded-lg flex flex-col items-center justify-around py-0.5 shadow-lg cursor-pointer select-none border-2 transition-all duration-150 active:scale-90 ${hl?"border-yellow-400 ring-2 ring-yellow-400/60 shadow-yellow-500/40":"border-[#C4B998]"}`} style={{background:"linear-gradient(160deg, #FFFEF5, #F5EDDA)"}}><Dots v={v[0]} sz={sm?12:16}/><div className="w-[60%] h-px bg-[#C4B998]"/><Dots v={v[1]} sz={sm?12:16}/></div>);
  const Back = () => (<div className="w-[14px] h-[26px] sm:w-[18px] sm:h-[32px] rounded bg-gradient-to-br from-[#8B0000] to-[#5C0000] border border-[#3D0000] shadow flex items-center justify-center flex-shrink-0"><div className="w-[50%] h-[50%] border border-[#FFD700]/20 rounded-sm"/></div>);

  // ✅ Wacht tot auth geladen is
  if (!authLoaded) return <div className="min-h-screen bg-black flex items-center justify-center"><Sun s={60} c="animate-spin opacity-50" /></div>;

  // ✅ LOGIN SCHERM - EERST voordat je iets kunt doen
  if (!account) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Kurdistan vlag achtergrond */}
        <div className="fixed inset-0 z-0">
          <div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" />
          <div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" />
          <div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" />
          <div className="absolute inset-0 flex items-center justify-center"><Sun s={300} c="opacity-30" /></div>
        </div>
        <div className="fixed inset-0 z-[1] bg-black/40" />

        {/* Taal switcher */}
        <div className="fixed top-3 right-3 flex gap-1.5 z-50">
          <button onClick={() => setLang("KU")} className={`px-3 py-1 rounded-full font-bold text-xs ${lang === "KU" ? "bg-yellow-500 text-black" : "bg-black/40 text-white/60"}`}>کوردی</button>
          <button onClick={() => setLang("NL")} className={`px-3 py-1 rounded-full font-bold text-xs ${lang === "NL" ? "bg-yellow-500 text-black" : "bg-black/40 text-white/60"}`}>NL</button>
        </div>

        {/* ✅ Mooie login card */}
        <div className="relative z-10 w-full max-w-[360px] px-4">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="relative inline-block">
              <Sun s={80} c="mx-auto mb-2 opacity-90" />
              <h1 className="text-5xl sm:text-6xl font-black text-white italic drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">DOMINO</h1>
            </div>
            <p className="text-white/60 text-xs mt-2 font-medium">{t.welkom} Domino ☀️</p>
          </div>

          {/* Auth Card */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
            
            {/* Tabs */}
            <div className="flex">
              <button onClick={() => { setAuthMode("create"); setAuthStep(1); setAuthErr(""); }}
                className={`flex-1 py-3.5 text-sm font-black transition-all ${authMode === "create" ? "bg-yellow-500 text-black" : "bg-transparent text-white/40"}`}>
                ✨ {t.maakAcc}
              </button>
              <button onClick={() => { setAuthMode("login"); setAuthStep(2); setAuthErr(""); }}
                className={`flex-1 py-3.5 text-sm font-black transition-all ${authMode === "login" ? "bg-yellow-500 text-black" : "bg-transparent text-white/40"}`}>
                🔑 {t.login}
              </button>
            </div>

            <div className="p-5">
              {/* ✅ STAP 1: Avatar kiezen (alleen bij account maken) */}
              {authMode === "create" && authStep === 1 && (
                <div className="animate-fadeIn">
                  <p className="text-white/70 text-xs text-center mb-4 font-bold">{t.kiesAvatar}</p>
                  
                  {/* Geselecteerde avatar groot */}
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-5xl shadow-xl shadow-yellow-500/30 border-4 border-yellow-300">
                      {authAvatar}
                    </div>
                  </div>

                  {/* Avatar grid */}
                  <div className="grid grid-cols-8 gap-2 mb-5">
                    {avatars.map(a => (
                      <button key={a} onClick={() => setAuthAvatar(a)}
                        className={`text-2xl p-1.5 rounded-xl transition-all duration-200 ${authAvatar === a ? "bg-yellow-500 scale-110 shadow-lg shadow-yellow-500/30 ring-2 ring-yellow-300" : "bg-white/5 hover:bg-white/10 active:scale-95"}`}>
                        {a}
                      </button>
                    ))}
                  </div>

                  <button onClick={() => setAuthStep(2)}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black py-3.5 rounded-2xl text-sm shadow-lg shadow-yellow-500/20 active:scale-[0.98] transition-transform">
                    {lang === "KU" ? "دواتر →" : "Volgende →"}
                  </button>
                </div>
              )}

              {/* ✅ STAP 2: Naam + wachtwoord */}
              {authStep === 2 && (
                <div className="animate-fadeIn">
                  {authMode === "create" && (
                    <div className="flex justify-center mb-4">
                      <button onClick={() => setAuthStep(1)} className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg border-2 border-yellow-300 active:scale-95 transition-transform">
                        {authAvatar}
                      </button>
                    </div>
                  )}

                  {authMode === "login" && (
                    <div className="flex justify-center mb-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-3xl shadow-lg border-2 border-blue-300">
                        🔑
                      </div>
                    </div>
                  )}

                  {/* Username */}
                  <div className="relative mb-3">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">👤</div>
                    <input type="text" placeholder={t.gebruiker} value={authUser} onChange={e => { setAuthUser(e.target.value); setAuthErr(""); }}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-bold text-sm placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all" />
                  </div>

                  {/* Password */}
                  <div className="relative mb-3">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔒</div>
                    <input type="password" placeholder={t.wachtwoord} value={authPass} onChange={e => { setAuthPass(e.target.value); setAuthErr(""); }}
                      onKeyDown={e => { if (e.key === "Enter") handleAuth(); }}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-bold text-sm placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all" />
                  </div>

                  {/* Error */}
                  {authErr && (
                    <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-3 py-2 mb-3 animate-shake">
                      <p className="text-red-400 text-xs text-center font-bold">⚠️ {authErr}</p>
                    </div>
                  )}

                  {/* Submit button */}
                  <button onClick={handleAuth}
                    className={`w-full font-black py-3.5 rounded-2xl text-sm shadow-lg active:scale-[0.98] transition-transform mb-3 ${
                      authMode === "create"
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow-yellow-500/20"
                        : "bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-blue-500/20"
                    }`}>
                    {authMode === "create" ? `✨ ${t.maakAcc}` : `🔑 ${t.login}`}
                  </button>

                  {/* Switch mode */}
                  <button onClick={() => { setAuthMode(authMode === "login" ? "create" : "login"); setAuthStep(authMode === "login" ? 1 : 2); setAuthErr(""); }}
                    className="w-full text-white/30 text-xs text-center py-1 hover:text-white/50 transition-colors">
                    {authMode === "login" ? `${t.geenAcc} → ${t.maakAcc}` : `${t.heb} → ${t.login}`}
                  </button>
                </div>
              )}

              {/* Gast optie */}
              <button onClick={() => saveAccount({ username: "Gast_" + Math.floor(Math.random() * 999), wins: 0, losses: 0, games: 0, avatar: "👤", created: Date.now() })}
                className="w-full text-white/20 text-[10px] text-center py-2 mt-2 hover:text-white/40 transition-colors">
                {t.ofGast}
              </button>
            </div>
          </div>

          <p className="text-white/15 text-[10px] text-center mt-4">☀️ Biji Kurdistan</p>
        </div>

        <style jsx>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
          @keyframes shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-5px); } 40%,80% { transform: translateX(5px); } }
          .animate-shake { animation: shake 0.4s ease-out; }
        `}</style>
      </main>
    );
  }

  // ✅ INGELOGD - MENU & GAME
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden">
      {showLaugh && <LaughOverlay onClose={() => setShowLaugh(false)} lang={lang} />}
      {showWin && <><Confetti /><WinOverlay onClose={() => setShowWin(false)} lang={lang} /></>}

      <div className="fixed inset-0 z-0"><div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]" /><div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white" /><div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]" /><div className="absolute inset-0 flex items-center justify-center"><Sun s={view === "menu" ? 250 : 400} c={view === "menu" ? "opacity-35" : "opacity-[0.12]"} /></div></div>
      {view === "game" && <div className="fixed inset-0 z-[1] bg-black/40" />}

      <div className="fixed top-2 right-2 flex gap-1 z-50">
        {view === "menu" && <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full mr-1"><div className={`w-2 h-2 rounded-full ${status === "on" ? "bg-green-400 animate-pulse" : "bg-red-500"}`} /></div>}
        <button onClick={() => setLang("KU")} className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${lang === "KU" ? "bg-yellow-500 text-black" : "bg-black/40 text-white/60"}`}>کوردی</button>
        <button onClick={() => setLang("NL")} className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${lang === "NL" ? "bg-yellow-500 text-black" : "bg-black/40 text-white/60"}`}>NL</button>
      </div>

      {view === "menu" ? (
        <div className="flex flex-col items-center z-10 w-full max-w-[300px] px-5 py-3">
          <div className="relative mb-1"><Sun s={60} c="absolute -top-1 left-1/2 -translate-x-1/2 opacity-80" /><h1 className="text-[40px] font-black text-white italic drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)] relative z-10">DOMINO</h1></div>
          <p className="text-white/80 text-[10px] mb-3 font-bold bg-black/30 px-3 py-1 rounded-full">☀️ 28 {t.stenen} • 7 {t.perSpeler}</p>

          {/* ✅ Account card */}
          <div className="w-full bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-3 mb-3 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xl shadow-lg border-2 border-yellow-300/50">{account.avatar}</div>
                <div>
                  <div className="text-white font-black text-sm">{account.username}</div>
                  <div className="flex gap-2 text-[9px]">
                    <span className="text-green-400">🏆 {account.wins}</span>
                    <span className="text-red-400">💀 {account.losses}</span>
                    <span className="text-white/30">🎮 {account.games}</span>
                  </div>
                </div>
              </div>
              <button onClick={logout} className="text-white/20 text-[9px] bg-white/5 px-2 py-1 rounded-lg hover:bg-white/10 active:scale-95 transition-all">{t.uitloggen}</button>
            </div>
          </div>

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
          <div className="flex items-center justify-between px-2 py-1.5 flex-shrink-0 relative overflow-hidden"><div className="absolute inset-0" style={{background:"linear-gradient(90deg, #ED2024 0%, #ED2024 30%, rgba(255,255,255,0.2) 30%, rgba(255,255,255,0.2) 70%, #21A038 70%)"}}/><div className="absolute inset-0 bg-black/30"/><button onClick={() => {setView("menu");setWaiting(false);setShowLaugh(false);setShowWin(false)}} className="text-white text-lg px-1 relative z-10">↩</button><div className="flex items-center gap-1.5 relative z-10"><span className="bg-yellow-500 text-black px-2.5 py-0.5 rounded-lg font-black text-[11px]">{room}</span>{room!=="BOT"&&<button onClick={copy} className="text-white text-[10px] bg-black/30 px-2 py-0.5 rounded-lg font-bold">{copied?"✅":"📋"}</button>}</div><div className={`px-2.5 py-1 rounded-lg text-[10px] font-black shadow relative z-10 ${myTurn?"bg-green-500 text-black":"bg-red-500 text-white"}`}>{myTurn?`🟢 ${t.jouwBeurt}`:`🔴 ${oppName}`}</div></div>
          {waiting&&(<div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-center py-2.5 text-[11px] flex-shrink-0">⏳ {t.stuurCode} <span className="bg-black text-white px-3 py-1 rounded-lg font-mono mx-2 text-base tracking-widest">{room}</span><button onClick={copy} className="bg-white/70 px-2 py-0.5 rounded text-[10px] font-bold">{copied?"✅":"📋"}</button></div>)}
          {gameOver&&(<div className={`text-black font-black text-center py-3 text-base flex-shrink-0 ${iWon?"bg-gradient-to-r from-yellow-400 to-orange-500":"bg-gradient-to-r from-red-500 to-red-700 text-white"}`}>{iWon?`🏆 ${t.gewonnen}`:`💀 ${t.verloren} 🤣`}<button onClick={restart} className="ml-3 bg-black text-white px-4 py-1.5 rounded-xl text-xs font-bold">🔄 {t.opnieuw}</button></div>)}

          <div className="flex sm:hidden flex-shrink-0"><button onClick={()=>setTab("board")} className={`flex-1 py-2 text-xs font-bold ${tab==="board"?"bg-green-900/50 text-green-400 border-b-2 border-green-400":"text-white/30 bg-black/30"}`}>🎮 {t.spel}</button><button onClick={()=>{setTab("chat");setUnread(0)}} className={`flex-1 py-2 text-xs font-bold relative ${tab==="chat"?"bg-green-900/50 text-green-400 border-b-2 border-green-400":"text-white/30 bg-black/30"}`}>💬 {t.chat}{unread>0&&tab!=="chat"&&<span className="absolute top-1 right-[30%] bg-red-500 text-white text-[7px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-bounce">{unread}</span>}</button></div>

          <div className="flex-1 flex min-h-0">
            <div className={`flex-1 flex flex-col min-h-0 ${tab==="chat"?"hidden sm:flex":"flex"}`}>
              <div className="bg-black/50 px-2 py-1.5 flex items-center justify-between flex-shrink-0"><div className="flex items-center gap-1.5"><div className="w-7 h-7 rounded-full bg-red-900/80 flex items-center justify-center text-xs">👤</div><div><div className="text-white font-bold text-[11px]">{oppName}</div><div className="text-white/30 text-[9px]">{cOpp} {t.stenen}</div></div></div><div className="flex gap-px overflow-hidden max-w-[55%]">{[...Array(Math.min(cOpp,14))].map((_,i)=><Back key={i}/>)}</div></div>

              <div className="flex-1 relative overflow-auto">
                <div className="absolute inset-0"><div className="absolute top-0 left-0 right-0 h-1/3 bg-[#ED2024]/20"/><div className="absolute top-1/3 left-0 right-0 h-1/3 bg-white/10"/><div className="absolute top-2/3 left-0 right-0 h-1/3 bg-[#21A038]/20"/></div>
                <div className="absolute inset-0" style={{background:"radial-gradient(ellipse at center, rgba(30,100,45,0.75) 0%, rgba(20,70,30,0.85) 60%, rgba(10,50,15,0.92) 100%)"}}/><div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Sun s={250} c="opacity-[0.08]"/></div>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#ED2024] via-[#FFD700] to-[#21A038]"/><div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#21A038] via-[#FFD700] to-[#ED2024]"/><div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#ED2024] via-[#FFD700] to-[#21A038]"/><div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-[#ED2024] via-[#FFD700] to-[#21A038]"/>
                <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4 z-10">{!board.length?(<div className="text-white/20 text-center animate-pulse"><Sun s={80} c="mx-auto mb-3 opacity-20"/><div className="text-sm font-bold">{waiting?t.wachtVriend:t.legEerste}</div></div>):(<DominoChain board={board} lastIdx={lastIdx}/>)}</div>
              </div>

              <div className="bg-black/60 px-2 py-1.5 flex items-center justify-between flex-shrink-0 border-t border-yellow-500/30"><div className="flex items-center gap-1.5"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-sm shadow border border-yellow-300/50">{account.avatar}</div><div><div className="text-white font-bold text-[11px]">{playerName}</div><div className="text-white/30 text-[9px]">{hand.length} {t.stenen}</div></div></div><div className="flex gap-1.5 items-center">{!canAny()&&myTurn&&!gameOver&&cPile>0&&<span className="text-red-400 text-[8px] animate-pulse">⚠️</span>}<button onClick={draw} disabled={!myTurn||!!gameOver||cPile===0} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-25 active:bg-blue-500 shadow">📦 {t.pak}</button>{!canAny()&&myTurn&&!gameOver&&cPile===0&&<button onClick={pass} className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold active:bg-orange-500 shadow">⏭️ {t.pas}</button>}</div></div>
            </div>

            <div className={`w-full sm:w-52 md:w-56 bg-black/50 flex flex-col border-l border-yellow-500/10 ${tab==="board"?"hidden sm:flex":"flex"}`}>
              <div className="text-white/40 font-bold text-[10px] text-center py-1.5 bg-yellow-500/10 hidden sm:block">💬 {t.chat}</div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">{!msgs.length&&<div className="text-white/15 text-[10px] text-center mt-8">{t.geenBerichten}</div>}{msgs.map((m,i)=>(<div key={i} className={`p-1.5 rounded-lg text-[10px] ${m.sender==="⚙️"?"bg-blue-500/10 text-blue-300/80 italic":m.sender.includes("🤖")?"bg-red-500/10 text-red-300/80":"bg-white/5 text-white/80"}`}><div className="flex justify-between"><span className="font-bold text-yellow-400/80 text-[9px]">{m.sender}</span><span className="text-white/10 text-[7px]">{m.time}</span></div><div className="break-words mt-px">{m.text}</div></div>))}<div ref={btm}/></div>
              {showEm&&(<div className="grid grid-cols-8 gap-0.5 p-1.5 bg-black/50 mx-1.5 rounded-lg max-h-20 overflow-y-auto border border-white/5">{emos.map(e=><button key={e} onClick={()=>setMsg(p=>p+e)} className="text-sm p-0.5 rounded active:bg-white/20">{e}</button>)}</div>)}
              <div className="flex gap-1 p-2 pt-1"><button onClick={()=>setShowEm(!showEm)} className={`px-1.5 py-1 rounded-lg text-sm ${showEm?"bg-yellow-500":"bg-white/10"}`}>😊</button><input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendC(msg)}} className="flex-1 bg-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:ring-1 focus:ring-yellow-500/50 placeholder-white/20 min-w-0" placeholder={t.typ}/><button onClick={()=>sendC(msg)} className="bg-green-600 px-2.5 py-1 rounded-lg text-[10px] text-white font-bold active:bg-green-500">➤</button></div>
            </div>
          </div>

          <div className="px-1.5 py-2 border-t-2 border-yellow-500/40 flex-shrink-0" style={{background:"linear-gradient(to top, #070710, #0d1117, #161b22)"}}>
            {!canAny()&&myTurn&&!gameOver&&cPile>0&&(<div className="text-center text-red-400/80 text-[9px] font-bold mb-1 animate-pulse">⚠️ {t.pakUitPot}</div>)}
            <div className="flex justify-center gap-[3px] overflow-x-auto pb-0.5" style={{scrollbarWidth:"none"}}>{hand.map((ti,i)=>{const ends=getEnds(board);const ok=!board.length||canPlay(ti,board,ends)!==null;return(<div key={`${ti[0]}-${ti[1]}-${i}`} onClick={()=>play(ti,i)} className={`flex-shrink-0 transition-all duration-200 ${!myTurn||gameOver?"opacity-20 pointer-events-none":ok?"active:scale-90 sm:hover:-translate-y-3":"opacity-25"}`}><HandTile v={ti} hl={ok&&myTurn&&!gameOver} sm={hand.length>6}/></div>)})}</div>
          </div>
        </div>
      )}
    </main>
  );
}