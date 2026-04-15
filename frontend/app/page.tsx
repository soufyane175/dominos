"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// ✅ Zet hier je ECHTE Railway URL
const SOCKET_URL = "https://jouw-project.up.railway.app";

type Tile = [number, number];
type Message = { sender: string; text: string; time: string };

export default function Home() {
  const [view, setView] = useState<"menu" | "game">("menu");
  const [lang, setLang] = useState<"KU" | "NL">("KU");

  // Game
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [botHand, setBotHand] = useState<Tile[]>([]);
  const [turn, setTurn] = useState<"player" | "bot">("player");

  // Rooms
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");

  // ✅ Socket via ref i.p.v. state (voorkomt null/stale issues)
  const socketRef = useRef<Socket | null>(null);

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMsg, setCurrentMsg] = useState("");

  const emojis = useMemo(() => ["🔥", "👏", "😂", "👋", "😍", "😎", "🤖", "💯"], []);

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    socketRef.current = s;

    s.on("connect", () => {
      console.log("Socket connected:", s.id);
    });

    s.on("connect_error", (err) => {
      console.error("Socket connect_error:", err);
    });

    // ✅ server verwacht: socket.emit('createRoom') -> s.on('roomCreated', code)
    s.on("roomCreated", (code: string) => {
      setRoomCode(code);
      setView("game");
      setBoard([]);
      // (Voor nu jouw vaste hand; idealiter stuurt backend ook de hand)
      setPlayerHand([[6, 6], [5, 4], [2, 1]]);
      setBotHand([]);
      setTurn("player");

      setMessages((prev) => {
        // optioneel: clear als je per room wisselt
        if (prev.length === 0) return prev;
        return prev;
      });
    });

    // ✅ Chat: server broadcast naar alle mensen in dezelfde room
    s.on("chatMessage", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, []);

  const safeEmit = (event: string, payload?: any) => {
    const s = socketRef.current;
    if (!s) return;
    if (!s.connected) return;
    s.emit(event, payload);
  };

  const handleCreateRoom = () => {
    setInputCode(""); // optioneel
    safeEmit("createRoom");
  };

  const handleJoinRoom = () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    safeEmit("joinRoom", { code });
    // Als je server niks terugstuurt, kun je hier roomCode alvast zetten:
    // setRoomCode(code);
    // setView("game");
  };

  const sendChat = (text: string) => {
    const t = text.trim();
    if (!t) return;

    const msg: Message = {
      sender: "Mij",
      text: t,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Optimistic (snel in beeld); als je server ook naar jou terugbroadcast -> kan duplicaat geven.
    setMessages((prev) => [...prev, msg]);

    if (socketRef.current?.connected && roomCode) {
      // ✅ vertel roomCode mee (meestal nodig voor multi-rooms)
      safeEmit("sendMessage", { roomCode, msg });
    }
    setCurrentMsg("");
  };

  const DominoTile = ({ value }: { value: Tile }) => {
    const dots = [[], [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

    return (
      <div className="w-10 h-20 bg-white rounded-lg border-2 border-gray-400 flex flex-col items-center justify-around py-1 shadow-md m-0.5 transition-transform hover:scale-110">
        {[0, 1].map((side, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-0.5 w-6 h-6">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className={`w-1 h-1 rounded-full ${dots[value[side]].includes(i) ? "bg-black" : "bg-transparent"}`}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  // ✅ Bot: simpele lokale bot (random tile op bord zetten)
  const doBotMove = () => {
    setTurn("bot");
    setTimeout(() => {
      setBotHand((prevBot) => {
        if (prevBot.length === 0) {
          setTurn("player");
          return prevBot;
        }
        const idx = Math.floor(Math.random() * prevBot.length);
        const botTile = prevBot[idx];

        setBoard((prev) => [...prev, botTile]);
        setPlayerHand((prevP) => prevP); // niets, alleen om duidelijk te houden

        // verwijder gekozen tile uit botHand
        return prevBot.filter((_, i) => i !== idx);
      });

      setTurn("player");
    }, 600);
  };

  const startBotGame = () => {
    setView("game");
    setRoomCode("BOT");
    setBoard([]);

    // jouw hand
    const pHand: Tile[] = [[6, 6], [5, 4], [2, 1]];
    // simpele bot hand (kan je aanpassen)
    const bHand: Tile[] = [
      [0, 6],
      [2, 2],
      [1, 5],
      [3, 3],
      [4, 0],
    ];

    setPlayerHand(pHand);
    setBotHand(bHand);
    setTurn("player");

    setMessages([
      { sender: "BOT", text: "Hoi! Ik ga random spelen 😄", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    ]);
  };

  const handlePlayTile = (t: Tile, index: number) => {
    if (turn !== "player") return;

    setBoard((prev) => [...prev, t]);
    setPlayerHand((prev) => prev.filter((_, idx) => idx !== index));

    // bot game: laat bot reageren
    if (roomCode === "BOT") {
      doBotMove();
    }
  };

  // scroll chat naar beneden
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <main
      className={`min-h-screen flex flex-col items-center justify-center relative ${
        view === "menu" ? "bg-gradient-to-b from-[#E31E24] via-white to-[#278E43]" : "bg-[#143d1a]"
      }`}
    >
      {/* VERTALING */}
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
          <h1 className="text-6xl font-black text-white italic mb-8 drop-shadow-2xl">DOMINO</h1>

          <button
            onClick={startBotGame}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl border-b-8 border-blue-900 mb-4 active:translate-y-1"
          >
            🤖 {lang === "KU" ? "یاری دژی بۆت" : "Tegen Bot"}
          </button>

          <button
            onClick={handleCreateRoom}
            className="w-full bg-green-600 text-white font-black py-4 rounded-2xl border-b-8 border-green-900 mb-4 active:translate-y-1"
          >
            🏠 {lang === "KU" ? "دروستکردنی ژوور" : "Kamer Maken"}
          </button>

          <div className="bg-purple-600 p-4 rounded-2xl border-b-8 border-purple-900 w-full">
            <input
              type="text"
              placeholder="CODE..."
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="w-full p-2 rounded-lg text-center font-bold mb-2 uppercase text-black"
            />

            {/* ✅ FIX: join button heeft nu onClick */}
            <button
              className="w-full text-white font-black text-sm"
              onClick={handleJoinRoom}
            >
              {lang === "KU" ? "چوونە ناو ژوور" : "Joinen"}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col p-4 max-w-5xl">
          <div className="flex justify-between items-center mb-2">
            <button onClick={() => setView("menu")} className="bg-white/10 text-white px-3 py-1 rounded-lg text-sm">
              ↩
            </button>
            <div className="bg-yellow-500 text-black px-4 py-1 rounded-lg font-bold text-sm">
              ROOM: {roomCode || "—"}
            </div>
          </div>

          <div className="flex gap-4 h-[70vh]">
            {/* Speelveld */}
            <div className="flex-1 border-4 border-white/10 rounded-[30px] bg-black/20 flex items-center justify-center p-4 overflow-auto">
              {board.length === 0 ? (
                <div className="text-white/70 text-xs text-center">
                  {roomCode === "BOT" ? "Speel een tegel voor mij 😄" : "Wacht op tegels..."}
                </div>
              ) : (
                <div className="flex flex-wrap justify-center">
                  {board.map((t, i) => (
                    <DominoTile key={i} value={t} />
                  ))}
                </div>
              )}
            </div>

            {/* CHAT BOX */}
            <div className="w-64 bg-black/30 rounded-[30px] flex flex-col p-4 border border-white/10">
              <div className="flex-1 overflow-y-auto mb-2 space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className="bg-white/10 p-2 rounded-lg text-xs text-white">
                    <span className="font-bold text-yellow-500">{m.sender}: </span>
                    {m.text}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {emojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => sendChat(e)}
                    className="bg-white/5 p-1 rounded hover:bg-white/20"
                    title={`Send ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>

              <div className="flex gap-1">
                <input
                  value={currentMsg}
                  onChange={(e) => setCurrentMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChat(currentMsg);
                  }}
                  className="flex-1 bg-white/10 rounded p-1 text-xs text-white"
                  placeholder="Typ..."
                />
                <button
                  onClick={() => sendChat(currentMsg)}
                  className="bg-green-600 px-2 rounded text-xs text-white font-bold"
                >
                  SEND
                </button>
              </div>
            </div>
          </div>

          {/* Hand van de speler */}
          <div className="bg-black/40 p-4 rounded-[30px] border-t-4 border-yellow-500 mt-4 flex justify-center gap-1 overflow-x-auto">
            {playerHand.map((t, i) => (
              <div
                key={i}
                onClick={() => handlePlayTile(t, i)}
                className={turn !== "player" ? "opacity-50 pointer-events-none" : ""}
                title={turn !== "player" ? "Wacht op bot..." : "Klik om te spelen"}
              >
                <DominoTile value={t} />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}