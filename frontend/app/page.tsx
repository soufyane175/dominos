"use client";

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// --- Types ---
type Tile = [number, number];

// --- Translations ---
const translations = {
  ku: {
    title: "دۆمینۆ",
    draw: "بەرد بێنە",
    pass: "تێپەڕین",
    win: "پیرۆزە! بردیەتەوە!",
    loss: "دۆڕاندی! جارێکی تر هەوڵ بدەوە.",
    turn: "نۆرەی تۆیە",
    botTurn: "نۆرەی بۆتە",
    hand: "دەستی تۆ",
    boneyard: "بەردەماوەکان",
  },
  nl: {
    title: "Domino",
    draw: "Pak Steen",
    pass: "Pas",
    win: "Gefeliciteerd! Je hebt gewonnen!",
    loss: "Helaas! Volgende keer beter.",
    turn: "Jouw beurt",
    botTurn: "Beurt van de bot",
    hand: "Jouw stenen",
    boneyard: "Pot",
  }
};

// --- Helpers ---
const generateTiles = (): Tile[] => {
  const tiles: Tile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push([i, j]);
    }
  }
  return tiles.sort(() => Math.random() - 0.5);
};

// --- Components ---
const DominoTile = ({ value, onClick, disabled }: { value: Tile, onClick: () => void, disabled: boolean }) => {
  const pipMap: Record<number, number[][]> = {
    0: [],
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  };

  const renderHalf = (pips: number, isTop: boolean) => (
    <div className={`relative w-full h-1/2 p-1 ${isTop ? 'border-b border-black/10' : ''}`}>
      {pipMap[pips].map(([r, c], i) => (
        <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-black" 
             style={{ top: `${20 + r * 30}%`, left: `${20 + c * 30}%` }} />
      ))}
    </div>
  );

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`w-12 h-20 bg-white rounded-lg border-2 border-gray-300 shadow-md flex flex-col items-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100`}
    >
      {renderHalf(value[0], true)}
      {renderHalf(value[1], false)}
    </button>
  );
};

export default function Home() {
  const [lang, setLang] = useState<'ku' | 'nl'>('ku');
  const t = translations[lang];
  
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [botHand, setBotHand] = useState<Tile[]>([]);
  const [boneyard, setBoneyard] = useState<Tile[]>([]);
  const [board, setBoard] = useState<Tile[]>([]);
  const [turn, setTurn] = useState<'player' | 'bot'>('player');
  const [winner, setWinner] = useState<string | null>(null);

  // Initialiseer spel
  useEffect(() => {
    const allTiles = generateTiles();
    setPlayerHand(allTiles.slice(0, 7));
    setBotHand(allTiles.slice(7, 14));
    setBoneyard(allTiles.slice(14));
  }, []);

  const playTile = (tile: Tile) => {
    if (turn !== 'player' || winner) return;

    // Eerste steen
    if (board.length === 0) {
      setBoard([tile]);
      setPlayerHand(playerHand.filter(t => t !== tile));
      setTurn('bot');
      return;
    }

    const first = board[0][0];
    const last = board[board.length - 1][1];

    if (tile[0] === last || tile[1] === last) {
      const newTile: Tile = tile[0] === last ? [tile[0], tile[1]] : [tile[1], tile[0]];
      setBoard([...board, newTile]);
      setPlayerHand(playerHand.filter(t => t !== tile));
      setTurn('bot');
    } else if (tile[0] === first || tile[1] === first) {
      const newTile: Tile = tile[1] === first ? [tile[0], tile[1]] : [tile[1], tile[0]];
      setBoard([newTile, ...board]);
      setPlayerHand(playerHand.filter(t => t !== tile));
      setTurn('bot');
    }
  };

  // Bot Logica
  useEffect(() => {
    if (turn === 'bot' && !winner) {
      const timer = setTimeout(() => {
        const playableIndex = botHand.findIndex(tile => {
          if (board.length === 0) return true;
          const first = board[0][0];
          const last = board[board.length - 1][1];
          return tile.includes(first) || tile.includes(last);
        });

        if (playableIndex !== -1) {
          const tile = botHand[playableIndex];
          const first = board[0][0];
          const last = board[board.length - 1][1];

          if (tile.includes(last)) {
            const newTile: Tile = tile[0] === last ? [tile[0], tile[1]] : [tile[1], tile[0]];
            setBoard([...board, newTile]);
          } else {
            const newTile: Tile = tile[1] === first ? [tile[0], tile[1]] : [tile[1], tile[0]];
            setBoard([newTile, ...board]);
          }
          setBotHand(botHand.filter((_, i) => i !== playableIndex));
        } else if (boneyard.length > 0) {
          const newBoneyard = [...boneyard];
          const pulled = newBoneyard.pop();
          if (pulled) {
            setBotHand([...botHand, pulled]);
            setBoneyard(newBoneyard);
          }
        }
        setTurn('player');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [turn, botHand, board, boneyard, winner]);

  // Winnaar check
  useEffect(() => {
    if (playerHand.length === 0 && board.length > 0) setWinner('Player');
    if (botHand.length === 0 && board.length > 0) setWinner('Bot');
  }, [playerHand, botHand, board]);

  return (
    <main className="min-h-screen bg-green-800 p-4 flex flex-col items-center text-white font-sans">
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <h1 className="text-4xl font-black italic tracking-tighter shadow-sm">{t.title}</h1>
        <button 
          onClick={() => setLang(lang === 'ku' ? 'nl' : 'ku')}
          className="bg-white/20 px-4 py-1 rounded-full text-sm font-bold"
        >
          {lang === 'ku' ? 'Nederlands' : 'Kurdî'}
        </button>
      </div>

      {/* Speelveld */}
      <div className="flex-1 w-full flex items-center justify-center overflow-x-auto p-10">
        <div className="flex gap-1 min-w-max">
          {board.map((tile, i) => (
            <div key={i} className="w-10 h-16 bg-white rounded-md border border-black/10 flex flex-col items-center rotate-90 scale-90">
               <div className="h-1/2 flex items-center justify-center text-black font-bold">{tile[0]}</div>
               <div className="w-full border-t border-black/20" />
               <div className="h-1/2 flex items-center justify-center text-black font-bold">{tile[1]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Bericht */}
      <div className="mb-4">
        {winner ? (
          <div className="text-2xl font-bold animate-bounce text-yellow-400">
            {winner === 'Player' ? t.win : t.loss}
          </div>
        ) : (
          <div className="bg-black/30 px-6 py-2 rounded-full font-bold">
            {turn === 'player' ? `● ${t.turn}` : t.botTurn}
          </div>
        )}
      </div>

      {/* Hand van de speler */}
      <div className="w-full max-w-4xl bg-black/40 p-6 rounded-3xl border-t-4 border-yellow-500/50 backdrop-blur-md">
        <div className="flex justify-between mb-4 px-2">
          <span className="uppercase text-xs font-black tracking-widest opacity-50">{t.hand}</span>
          <span className="uppercase text-xs font-black tracking-widest opacity-50">{t.boneyard}: {boneyard.length}</span>
        </div>
        
        <div className="flex flex-wrap gap-3 justify-center mb-6">
          {playerHand.map((tile, i) => (
            <DominoTile 
              key={i} 
              value={tile} 
              onClick={() => playTile(tile)} 
              disabled={turn !== 'player' || !!winner} 
            />
          ))}
        </div>

        {/* Knoppen */}
        <div className="flex justify-center gap-4">
          <button 
            disabled={turn !== 'player' || boneyard.length === 0 || !!winner}
            onClick={() => {
              const newBoneyard = [...boneyard];
              const pulled = newBoneyard.pop();
              if (pulled) {
                setPlayerHand([...playerHand, pulled]);
                setBoneyard(newBoneyard);
              }
            }}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 text-black px-8 py-3 rounded-xl font-black transition-all active:scale-95 shadow-xl"
          >
            {t.draw}
          </button>
          
          <button 
            disabled={turn !== 'player' || !!winner}
            onClick={() => setTurn('bot')}
            className="bg-white/10 hover:bg-white/20 px-8 py-3 rounded-xl font-black transition-all"
          >
            {t.pass}
          </button>
        </div>
      </div>
    </main>
  );
}