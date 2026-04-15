"use client";
import React, { useEffect, useRef, useState } from "react";

type Tile = [number, number];
type Message = { sender: string; text: string; time: string };

// Alle 28 domino stenen
function allTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push([i, j]);
    }
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

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Check of tile past aan links of rechts van het bord
function canPlay(tile: Tile, board: Tile[], ends: [number, number]): "left" | "right" | null {
  if (board.length === 0) return "right";
  const [leftEnd, rightEnd] = ends;
  if (tile[0] === leftEnd || tile[1] === leftEnd) return "left";
  if (tile[0] === rightEnd || tile[1] === rightEnd) return "right";
  return null;
}

function getEnds(board: { tile: Tile; flipped: boolean }[]): [number, number] {
  if (board.length === 0) return [-1, -1];
  const first = board[0];
  const last = board[board.length - 1];
  const leftEnd = first.flipped ? first.tile[1] : first.tile[0];
  const rightEnd = last.flipped ? last.tile[0] : last.tile[1];
  return [leftEnd, rightEnd];
}

// Opgeslagen kamers (in-memory voor lokaal spelen)
const rooms: Record<string, { code: string; players: string[] }> = {};

export default function Home() {
  const [view, setView] = useState<"menu" | "game">("menu");
  const [lang, setLang] = useState<"KU" | "NL">("KU");
  const [mode, setMode] = useState<"bot" | "online">("bot");

  // Game state
  const [board, setBoard] = useState<{ tile: Tile; flipped: boolean }[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [botHand, setBotHand] = useState<Tile[]>([]);
  const [pile, setPile] = useState<Tile[]>([]);
  const [turn, setTurn] = useState<"player" | "bot">("player");
  const [gameOver, setGameOver] = useState<string | null>(null);

  // Room
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [playerName, setPlayerName] = useState("Speler");
  const [copied, setCopied] = useState(false);

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMsg, setCurrentMsg] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const emojis = [
    "🔥", "👏", "😂", "👋", "😍", "😎", "🤖", "💯",
    "😡", "🥳", "😭", "🤣", "💀", "🫡", "🎉", "❤️",
    "👑", "🐐", "😈", "🤡", "💪", "🙏", "😤", "🥶"
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start een nieuw spel
  const startGame = (gameMode: "bot" | "online") => {
    const all = shuffle(allTiles());
    const pHand = all.slice(0, 7);
    const bHand = all.slice(7, 14);
    const remaining = all.slice(14);

    setPlayerHand(pHand);
    setBotHand(bHand);
    setPile(remaining);
    setBoard([]);
    setTurn("player");
    setGameOver(null);
    setMode(gameMode);
    setView("game");
    setMessages([]);

    if (gameMode === "bot") {
      setRoomCode("BOT");
      addSystemMsg("🤖 Bot game gestart! Jij begint.");
    }
  };

  const addSystemMsg = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { sender: "⚙️", text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    ]);
  };

  // Kamer maken
  const handleCreateRoom = () => {
    const code = genCode();
    rooms[code] = { code, players: [playerName] };
    setRoomCode(code);
    startGame("online");
    addSystemMsg(`Kamer ${code} aangemaakt! Deel deze code met je vriend.`);
  };

  // Kamer joinen
  const handleJoinRoom = () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    // Simuleer join
    setRoomCode(code);
    startGame("online");
    addSystemMsg(`Je bent gejoind in kamer ${code}!`);
  };

  // Kopieer code
  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Speler speelt een tegel
  const handlePlayTile = (tile: Tile, index: number) => {
    if (turn !== "player" || gameOver) return;

    const ends = getEnds(board);
    const side = canPlay(tile, board.map((b) => b.tile), ends);

    if (!side && board.length > 0) {
      addSystemMsg("❌ Deze tegel past niet! Kies een andere of pak uit de pot.");
      return;
    }

    let flipped = false;

    if (board.length === 0) {
      flipped = false;
    } else if (side === "left") {
      if (tile[1] === ends[0]) {
        flipped = false;
      } else {
        flipped = true;
      }
    } else {
      if (tile[0] === ends[1]) {
        flipped = false;
      } else {
        flipped = true;
      }
    }

    const newBoard =
      side === "left"
        ? [{ tile, flipped }, ...board]
        : [...board, { tile, flipped }];

    setBoard(newBoard);
    const newHand = playerHand.filter((_, idx) => idx !== index);
    setPlayerHand(newHand);

    if (newHand.length === 0) {
      setGameOver("🎉 JIJ WINT!");
      addSystemMsg("🎉 Je hebt gewonnen!");
      return;
    }

    if (mode === "bot") {
      setTurn("bot");
      setTimeout(() => doBotMove(newBoard), 800);
    } else {
      setTurn("player");
    }
  };

  // Pak uit de pot
  const drawFromPile = () => {
    if (turn !== "player" || gameOver) return;
    if (pile.length === 0) {
      addSystemMsg("De pot is leeg! Je moet passen.");
      if (mode === "bot") {
        setTurn("bot");
        setTimeout(() => doBotMove(board), 800);
      }
      return;
    }

    const newPile = [...pile];
    const drawn = newPile.pop()!;
    setPile(newPile);
    setPlayerHand((prev) => [...prev, drawn]);
    addSystemMsg(`📦 Je pakte [${drawn[0]}|${drawn[1]}] uit de pot.`);
  };

  // Bot speelt
  const doBotMove = (currentBoard: { tile: Tile; flipped: boolean }[]) => {
    const ends = getEnds(currentBoard);

    setBotHand((prevBot) => {
      // Vind een tegel die past
      let playIdx = -1;
      let playSide: "left" | "right" | null = null;

      for (let i = 0; i < prevBot.length; i++) {
        const s = canPlay(prevBot[i], currentBoard.map((b) => b.tile), ends);
        if (s) {
          playIdx = i;
          playSide = s;
          break;
        }
      }

      if (playIdx === -1) {
        // Bot kan niet spelen, pak uit pot
        setPile((prevPile) => {
          if (prevPile.length === 0) {
            addSystemMsg("🤖 Bot kan niet spelen en pot is leeg. Bot past.");
            setTurn("player");
            return prevPile;
          }
          const np = [...prevPile];
          const drawn = np.pop()!;
          addSystemMsg(`🤖 Bot pakte uit de pot.`);

          // Probeer opnieuw met getrokken tegel
          const newBotHand = [...prevBot, drawn];
          setBotHand(newBotHand);
          setTurn("player");
          return np;
        });
        return prevBot;
      }

      const botTile = prevBot[playIdx];

      let flipped = false;
      if (currentBoard.length === 0) {
        flipped = false;
      } else if (playSide === "left") {
        flipped = botTile[1] !== ends[0];
      } else {
        flipped = botTile[0] !== ends[1];
      }

      const newBoard =
        playSide === "left"
          ? [{ tile: botTile, flipped }, ...currentBoard]
          : [...currentBoard, { tile: botTile, flipped }];

      setBoard(newBoard);
      addSystemMsg(`🤖 Bot speelde [${botTile[0]}|${botTile[1]}]`);

      const newBotHand = prevBot.filter((_, i) => i !== playIdx);

      if (newBotHand.length === 0) {
        setGameOver("💀 BOT WINT!");
        addSystemMsg("💀 Bot heeft gewonnen!");
      }

      setTurn("player");
      return newBotHand;
    });
  };

  // Check of speler kan spelen
  const canPlayerPlay = (): boolean => {
    if (board.length === 0) return true;
    const ends = getEnds(board);
    return playerHand.some((t) => canPlay(t, board.map((b) => b.tile), ends) !== null);
  };

  const sendChat = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const msg: Message = {
      sender: playerName,
      text: t,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, msg]);
    setCurrentMsg("");
    setShowEmojis(false);

    // Bot reageert op chat
    if (mode === "bot") {
      setTimeout(() => {
        const botReplies = ["Haha 😂", "Oke 👍", "Ik ga winnen 😈", "Nice! 🔥", "GG 💯", "🤖💪", "Hmm...", "Goed gespeeld! 👏"];
        const reply = botReplies[Math.floor(Math.random() * botReplies.length)];
        setMessages((prev) => [
          ...prev,
          { sender: "🤖 Bot", text: reply, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
        ]);
      }, 1000 + Math.random() * 1500);
    }
  };

  // Domino tegel component
  const DominoTile = ({ value, highlight }: { value: Tile; highlight?: boolean }) => {
    const dots: number[][] = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    return (
      <div
        className={`w-10 h-20 bg-white rounded-lg border-2 flex flex-col items-center justify-around py-1 shadow-md m-0.5 transition-all duration-200 hover:scale-110 cursor-pointer ${
          highlight ? "border-yellow-400 ring-2 ring-yellow-400 shadow-yellow-400/50 shadow-lg" : "border-gray-400"
        }`}
      >
        {[0, 1].map((side) => (
          <div key={side} className="grid grid-cols-3 gap-0.5 w-6 h-6">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  dots[value[side]].includes(i) ? "bg-black" : "bg-transparent"
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Bord tegel (kan horizontaal zijn)
  const BoardTile = ({ value, flipped }: { value: Tile; flipped: boolean }) => {
    const display: Tile = flipped ? [value[1], value[0]] : value;
    const dots: number[][] = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    return (
      <div className="w-16 h-8 bg-white rounded-md border-2 border-gray-500 flex flex-row items-center justify-around px-1 shadow-md mx-0.5">
        {[0, 1].map((side) => (
          <div key={side} className="grid grid-cols-3 gap-0.5 w-5 h-5">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className={`w-1 h-1 rounded-full ${
                  dots[display[side]].includes(i) ? "bg-black" : "bg-transparent"
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <main
      className={`min-h-screen flex flex-col items-center justify-center relative ${
        view === "menu" ? "bg-gradient-to-b from-[#E31E24] via-white to-[#278E43]" : "bg-[#143d1a]"
      }`}
    >
      {/* Taal */}
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => setLang("KU")}
          className={`px-3 py-1 rounded-full font-bold text-xs ${
            lang === "KU" ? "bg-yellow-500 text-black" : "bg-white/20 text-white"
          }`}
        >
          KU
        </button>
        <button
          onClick={() => setLang("NL")}
          className={`px-3 py-1 rounded-full font-bold text-xs ${
            lang === "NL" ? "bg-yellow-500 text-black" : "bg-white/20 text-white"
          }`}
        >
          NL
        </button>
      </div>

      {view === "menu" ? (
        <div className="flex flex-col items-center z-10 w-full max-w-xs p-4">
          <h1 className="text-6xl font-black text-white italic mb-2 drop-shadow-2xl">DOMINO</h1>
          <p className="text-white/70 text-sm mb-6">🎲 28 stenen • 7 per speler</p>

          {/* Naam */}
          <input
            type="text"
            placeholder="Je naam..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value || "Speler")}
            className="w-full p-2 rounded-lg text-center font-bold mb-4 text-black"
          />

          <button
            onClick={() => startGame("bot")}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl border-b-8 border-blue-900 mb-4 active:translate-y-1 hover:bg-blue-500 transition-colors"
          >
            🤖 {lang === "KU" ? "یاری دژی بۆت" : "Tegen Bot"}
          </button>

          <button
            onClick={handleCreateRoom}
            className="w-full bg-green-600 text-white font-black py-4 rounded-2xl border-b-8 border-green-900 mb-4 active:translate-y-1 hover:bg-green-500 transition-colors"
          >
            🏠 {lang === "KU" ? "دروستکردنی ژوور" : "Kamer Maken"}
          </button>

          <div className="bg-purple-600 p-4 rounded-2xl border-b-8 border-purple-900 w-full">
            <input
              type="text"
              placeholder="CODE..."
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              className="w-full p-2 rounded-lg text-center font-bold mb-2 uppercase text-black"
              maxLength={5}
            />
            <button
              onClick={handleJoinRoom}
              className="w-full text-white font-black text-sm py-2 bg-purple-800 rounded-lg hover:bg-purple-700 transition-colors"
            >
              {lang === "KU" ? "چوونە ناو ژوور" : "Joinen"}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full h-screen flex flex-col p-2 md:p-4 max-w-6xl">
          {/* Top bar */}
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <button
              onClick={() => setView("menu")}
              className="bg-white/10 text-white px-3 py-1 rounded-lg text-sm hover:bg-white/20"
            >
              ↩ Menu
            </button>

            <div className="flex items-center gap-2">
              <div className="bg-yellow-500 text-black px-4 py-1 rounded-lg font-bold text-sm">
                ROOM: {roomCode}
              </div>
              {roomCode !== "BOT" && (
                <button
                  onClick={copyCode}
                  className="bg-white/20 text-white px-3 py-1 rounded-lg text-xs hover:bg-white/30"
                >
                  {copied ? "✅ Gekopieerd!" : "📋 Kopieer"}
                </button>
              )}
            </div>

            <div className="flex gap-3 text-white text-xs">
              <span>🎴 Jij: {playerHand.length}</span>
              {mode === "bot" && <span>🤖 Bot: {botHand.length}</span>}
              <span>📦 Pot: {pile.length}</span>
            </div>
          </div>

          {/* Game over banner */}
          {gameOver && (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-center py-3 rounded-2xl mb-2 text-xl animate-pulse">
              {gameOver}
              <button
                onClick={() => startGame(mode)}
                className="ml-4 bg-black text-white px-4 py-1 rounded-lg text-sm font-bold"
              >
                🔄 Opnieuw
              </button>
            </div>
          )}

          <div className="flex gap-2 flex-1 min-h-0">
            {/* Speelveld */}
            <div className="flex-1 border-4 border-white/10 rounded-[20px] bg-black/20 flex flex-col items-center justify-center p-2 overflow-auto relative">
              {/* Turn indicator */}
              <div
                className={`absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-bold ${
                  turn === "player" ? "bg-green-500 text-black" : "bg-red-500 text-white"
                }`}
              >
                {turn === "player" ? "🟢 Jouw beurt" : "🔴 Bot denkt..."}
              </div>

              {board.length === 0 ? (
                <div className="text-white/50 text-sm text-center">
                  {lang === "KU" ? "یەکەم تابلۆ دابنێ!" : "Speel je eerste tegel!"}
                  <br />
                  <span className="text-xs">Klik op een tegel hieronder</span>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center items-center gap-0.5 p-2">
                  {board.map((b, i) => (
                    <BoardTile key={i} value={b.tile} flipped={b.flipped} />
                  ))}
                </div>
              )}
            </div>

            {/* CHAT BOX */}
            <div className="w-56 md:w-64 bg-black/30 rounded-[20px] flex flex-col p-3 border border-white/10">
              <div className="text-white font-bold text-xs mb-1 text-center">
                💬 Chat
              </div>

              <div className="flex-1 overflow-y-auto mb-2 space-y-1 min-h-0">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg text-xs ${
                      m.sender === "⚙️"
                        ? "bg-blue-500/20 text-blue-300 italic"
                        : m.sender === "🤖 Bot"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-bold text-yellow-500">{m.sender}</span>
                      <span className="text-white/30 text-[10px]">{m.time}</span>
                    </div>
                    <div className="mt-0.5">{m.text}</div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Emoji picker */}
              {showEmojis && (
                <div className="grid grid-cols-6 gap-1 mb-2 bg-black/40 p-2 rounded-lg max-h-24 overflow-y-auto">
                  {emojis.map((e) => (
                    <button
                      key={e}
                      onClick={() => setCurrentMsg((prev) => prev + e)}
                      className="hover:bg-white/20 rounded p-0.5 text-sm transition-colors"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-1">
                <button
                  onClick={() => setShowEmojis(!showEmojis)}
                  className="bg-white/10 px-2 rounded text-sm hover:bg-white/20"
                >
                  😊
                </button>
                <input
                  value={currentMsg}
                  onChange={(e) => setCurrentMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChat(currentMsg);
                  }}
                  className="flex-1 bg-white/10 rounded p-1 text-xs text-white outline-none focus:ring-1 focus:ring-yellow-500"
                  placeholder="Typ..."
                />
                <button
                  onClick={() => sendChat(currentMsg)}
                  className="bg-green-600 px-2 rounded text-xs text-white font-bold hover:bg-green-500"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>

          {/* Speler hand + acties */}
          <div className="bg-black/40 p-3 rounded-[20px] border-t-4 border-yellow-500 mt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white text-xs font-bold">
                🎴 {lang === "KU" ? "تابلۆکانت" : "Jouw stenen"} ({playerHand.length})
              </span>
              <div className="flex gap-2">
                {!canPlayerPlay() && pile.length > 0 && turn === "player" && !gameOver && (
                  <span className="text-red-400 text-xs animate-pulse">⚠️ Geen opties! Pak uit pot →</span>
                )}
                <button
                  onClick={drawFromPile}
                  disabled={turn !== "player" || pile.length === 0 || !!gameOver}
                  className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  📦 Pak ({pile.length})
                </button>
              </div>
            </div>

            <div className="flex justify-center gap-1 overflow-x-auto pb-1">
              {playerHand.map((t, i) => {
                const ends = getEnds(board);
                const playable =
                  board.length === 0 || canPlay(t, board.map((b) => b.tile), ends) !== null;
                return (
                  <div
                    key={i}
                    onClick={() => handlePlayTile(t, i)}
                    className={`transition-all duration-200 ${
                      turn !== "player" || gameOver
                        ? "opacity-30 pointer-events-none"
                        : playable
                        ? "hover:-translate-y-2"
                        : "opacity-50"
                    }`}
                    title={
                      playable
                        ? `Speel [${t[0]}|${t[1]}]`
                        : "Past niet"
                    }
                  >
                    <DominoTile value={t} highlight={playable && turn === "player"} />
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