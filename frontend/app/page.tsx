"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = "https://dominos-app.onrender.com";

type Tile = [number, number];
type Message = { sender: string; text: string; time: string };
type UserData = {
  id: string;
  username: string;
  avatar: string;
  diamonds: number;
  selectedSkin: string;
  ownedSkins: string[];
  stats: { wins: number; losses: number; games: number; streak: number };
  createdAt?: string;
};

type Skin = {
  id: string;
  name: string;
  type: 'table' | 'tiles' | 'rack';
  price: number;
  emoji: string;
  colors: { primary: string; secondary: string; accent: string };
};

type Tournament = {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  entryFee: number;
  maxPlayers: number;
  players: { id: string; name: string; avatar: string; wins: number }[];
  prizes: { first: number; second: number; third: number };
  status: 'soon' | 'active' | 'finished';
};

export default function Home() {
  const [view, setView] = useState<'loading' | 'login' | 'menu' | 'game' | 'waiting' | 'stats' | 'store' | 'champions' | 'tournament'>('loading');
  const [activeTab, setActiveTab] = useState<'play' | 'champions' | 'store'>('play');
  const [playMode, setPlayMode] = useState<'quick' | 'ranked' | 'turbo' | 'tournament' | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [connected, setConnected] = useState(false);
  
  // Auth
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('🎲');
  
  // Game
  const [board, setBoard] = useState<{tile: Tile, side: 'left' | 'right'}[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [opponentHand, setOpponentHand] = useState<Tile[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>('player');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [gameMode, setGameMode] = useState<'quick' | 'ranked' | 'turbo' | 'bot'>('quick');
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [roundNumber, setRoundNumber] = useState(1);
  const [turnTimer, setTurnTimer] = useState(15);
  const [isTurbo, setIsTurbo] = useState(false);
  
  // Room
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [playersInRoom, setPlayersInRoom] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);
  
  // UI
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMsg, setCurrentMsg] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showLaugh, setShowLaugh] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [shakeLogin, setShakeLogin] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);
  
  // Stats
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [statsSortBy, setStatsSortBy] = useState<'wins' | 'games' | 'losses' | 'winrate' | 'diamonds'>('wins');
  const [statsSearch, setStatsSearch] = useState('');
  
  // Store
  const [storeTab, setStoreTab] = useState<'skins' | 'gems'>('skins');
  const [dailyRefresh, setDailyRefresh] = useState('12:00:00');
  
  // Tournament
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [tournamentTimer, setTournamentTimer] = useState('23:59:59');

  // Skins
  const skins: Skin[] = [
    { id: 'default', name: 'کلاسیک', type: 'table', price: 0, emoji: '🎲', colors: { primary: '#2d5a27', secondary: '#1a3d15', accent: '#8B4513' } },
    { id: 'neon', name: 'نیۆن', type: 'table', price: 100, emoji: '💜', colors: { primary: '#1a0033', secondary: '#330066', accent: '#9933ff' } },
    { id: 'gold', name: 'زێڕین', type: 'table', price: 250, emoji: '✨', colors: { primary: '#4a3000', secondary: '#6b4400', accent: '#ffd700' } },
    { id: 'ocean', name: 'ئاویان', type: 'table', price: 150, emoji: '🌊', colors: { primary: '#003366', secondary: '#006699', accent: '#00ccff' } },
    { id: 'fire', name: 'ئاگرین', type: 'table', price: 200, emoji: '🔥', colors: { primary: '#330000', secondary: '#660000', accent: '#ff3300' } },
    { id: 'kurdistan', name: 'کوردستان', type: 'table', price: 300, emoji: '🇨🇺', colors: { primary: '#278E43', secondary: '#ED1C24', accent: '#FFC800' } },
  ];

  // Loading
  useEffect(() => {
    setTimeout(() => {
      const saved = localStorage.getItem('domino_user');
      if (saved) {
        const user = JSON.parse(saved);
        // Ensure all fields exist
        if (!user.diamonds) user.diamonds = 500;
        if (!user.ownedSkins) user.ownedSkins = ['default'];
        if (!user.selectedSkin) user.selectedSkin = 'default';
        if (!user.stats.streak) user.stats.streak = 0;
        setCurrentUser(user);
        setPlayerName(user.username);
        setView('menu');
      } else {
        setView('login');
      }
    }, 1500);
  }, []);

  // Load users
  useEffect(() => {
    loadAllUsers();
    createDefaultTournament();
  }, []);

  // Timer for tournament
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentTournament) {
        const now = Date.now();
        const diff = currentTournament.endTime - now;
        if (diff > 0) {
          const hours = Math.floor(diff / 3600000);
          const minutes = Math.floor((diff % 3600000) / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setTournamentTimer(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentTournament]);

  // Turbo timer
  useEffect(() => {
    if (!isTurbo || currentTurn !== 'player' || gameOver || view !== 'game') return;
    
    const timer = setInterval(() => {
      setTurnTimer(prev => {
        if (prev <= 1) {
          // Auto play random tile
          if (playerHand.length > 0) {
            const playable = playerHand.map((tile, index) => ({
              tile, index,
              left: canPlayTile(tile, 'left'),
              right: canPlayTile(tile, 'right')
            })).filter(t => t.left || t.right);
            
            if (playable.length > 0) {
              const move = playable[0];
              playTile(move.tile, move.index, move.right ? 'right' : 'left');
            }
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isTurbo, currentTurn, gameOver, view, playerHand]);

  const loadAllUsers = () => {
    const users = JSON.parse(localStorage.getItem('domino_users') || '[]');
    const safeUsers = users.map((u: any) => ({
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      diamonds: u.diamonds || 500,
      selectedSkin: u.selectedSkin || 'default',
      ownedSkins: u.ownedSkins || ['default'],
      stats: { ...u.stats, streak: u.stats.streak || 0 },
      createdAt: u.createdAt
    }));
    setAllUsers(safeUsers);
    
    // Update tournament players
    if (currentTournament) {
      const updatedTournament = { ...currentTournament };
      updatedTournament.players = safeUsers.slice(0, 1000).map(u => ({
        id: u.id,
        name: u.username,
        avatar: u.avatar,
        wins: u.stats.wins
      }));
      setCurrentTournament(updatedTournament);
    }
  };

  const createDefaultTournament = () => {
    const now = Date.now();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    setCurrentTournament({
      id: 'daily',
      name: 'KURDISH CUP',
      startTime: now,
      endTime: endOfDay.getTime(),
      entryFee: 0,
      maxPlayers: 1000,
      players: [],
      prizes: { first: 10000, second: 5000, third: 2500 },
      status: 'active'
    });
  };

  // Socket
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('roomCreated', (data) => {
      setRoomCode(data.roomCode);
      setIsInRoom(true);
      setIsHost(true);
      setPlayersInRoom(data.players || []);
      setView('waiting');
    });

    socket.on('roomJoined', (data) => {
      setRoomCode(data.roomCode);
      setIsInRoom(true);
      setIsHost(data.isHost || false);
      setPlayersInRoom(data.players || []);
      setView('waiting');
    });

    socket.on('playerJoined', (data) => {
      setPlayersInRoom(data.players || []);
    });

    socket.on('gameStarted', (data) => {
      setPlayerHand(data.playerHand || []);
      setOpponentHand(data.opponentHand || []);
      setBoard([]);
      setCurrentTurn('player');
      setGameOver(false);
      setWinner(null);
      setView('game');
    });

    socket.on('moveMade', (data) => {
      addTileToBoardLocal(data.tile, data.side);
      setOpponentHand(prev => prev.slice(1));
      setCurrentTurn('player');
      setTurnTimer(15);
    });

    socket.on('chatMessage', (msg: Message) => setMessages(prev => [...prev, msg]));

    return () => socket.disconnect();
  }, []);

  // Auth
  const handleLogin = () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setAuthError('هەموو فیڵدەکان پێویستن');
      triggerShake();
      return;
    }
    
    setIsLoading(true);
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('domino_users') || '[]');
      const user = users.find((u: any) => u.username === loginUsername && u.password === loginPassword);
      
      if (user) {
        const safeUser: UserData = { 
          id: user.id, username: user.username, avatar: user.avatar || '🎲',
          diamonds: user.diamonds ?? 500,
          selectedSkin: user.selectedSkin || 'default',
          ownedSkins: user.ownedSkins || ['default'],
          stats: { ...user.stats, streak: user.stats.streak || 0 },
          createdAt: user.createdAt
        };
        setCurrentUser(safeUser);
        localStorage.setItem('domino_user', JSON.stringify(safeUser));
        setPlayerName(safeUser.username);
        setAuthError('');
        setView('loading');
        setTimeout(() => setView('menu'), 800);
      } else {
        setAuthError('ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە');
        triggerShake();
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleRegister = () => {
    if (!registerUsername.trim() || !registerPassword.trim()) {
      setAuthError('هەموو فیڵدەکان پێویستن');
      triggerShake();
      return;
    }
    if (registerPassword !== registerConfirm) {
      setAuthError('وشەی نهێنی یەک نینن');
      triggerShake();
      return;
    }
    if (registerUsername.length < 3) {
      setAuthError('ناوی بەکارهێنەر دەبێت لانیکەم ٣ پیت بێت');
      triggerShake();
      return;
    }
    
    setIsLoading(true);
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('domino_users') || '[]');
      if (users.find((u: any) => u.username === registerUsername)) {
        setAuthError('ئەم ناوی بەکارهێنەرە پێشتر هەیە');
        triggerShake();
        setIsLoading(false);
        return;
      }
      
      const newUser = {
        id: Date.now().toString(),
        username: registerUsername,
        password: registerPassword,
        avatar: selectedAvatar,
        diamonds: 500,
        selectedSkin: 'default',
        ownedSkins: ['default'],
        stats: { wins: 0, losses: 0, games: 0, streak: 0 },
        createdAt: new Date().toISOString()
      };
      
      users.push(newUser);
      localStorage.setItem('domino_users', JSON.stringify(users));
      
      const safeUser: UserData = { 
        id: newUser.id, username: newUser.username, avatar: newUser.avatar,
        diamonds: newUser.diamonds, selectedSkin: newUser.selectedSkin,
        ownedSkins: newUser.ownedSkins, stats: newUser.stats,
        createdAt: newUser.createdAt
      };
      setCurrentUser(safeUser);
      localStorage.setItem('domino_user', JSON.stringify(safeUser));
      setPlayerName(safeUser.username);
      setAuthError('');
      setView('loading');
      setTimeout(() => setView('menu'), 800);
      setIsLoading(false);
      loadAllUsers();
    }, 1000);
  };

  const triggerShake = () => {
    setShakeLogin(true);
    setTimeout(() => setShakeLogin(false), 500);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('domino_user');
    setView('login');
    setLoginUsername('');
    setLoginPassword('');
  };

  // Game functions
  const createDeck = (): Tile[] => {
    const deck: Tile[] = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        deck.push([i, j]);
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  const startGame = (mode: 'quick' | 'ranked' | 'turbo' | 'bot', difficulty?: 'easy' | 'medium' | 'hard') => {
    const deck = createDeck();
    setGameMode(mode);
    setIsTurbo(mode === 'turbo');
    setTurnTimer(15);
    
    if (mode === 'bot') {
      setBotDifficulty(difficulty || 'medium');
    }
    
    setPlayerHand(deck.slice(0, 7));
    setOpponentHand(deck.slice(7, 14));
    setBoard([]);
    setCurrentTurn('player');
    setGameOver(false);
    setWinner(null);
    setMessages([]);
    setRoundNumber(prev => prev + 1);
    setView('game');
  };

  const getBoardEnds = (): { left: Tile | null, right: Tile | null } => {
    if (board.length === 0) return { left: null, right: null };
    return { left: board[0].tile, right: board[board.length - 1].tile };
  };

  const canPlayTile = (tile: Tile, side: 'left' | 'right'): boolean => {
    if (board.length === 0) return true;
    const ends = getBoardEnds();
    const target = side === 'left' ? ends.left : ends.right;
    if (!target) return true;
    return tile[0] === target[0] || tile[0] === target[1] || tile[1] === target[0] || tile[1] === target[1];
  };

  const getPlayableSides = (tile: Tile): ('left' | 'right' | 'both' | 'none') => {
    const canLeft = canPlayTile(tile, 'left');
    const canRight = canPlayTile(tile, 'right');
    if (canLeft && canRight) return 'both';
    if (canLeft) return 'left';
    if (canRight) return 'right';
    return 'none';
  };

  const addTileToBoardLocal = (tile: Tile, side: 'left' | 'right') => {
    setBoard(prev => {
      if (prev.length === 0) return [{ tile, side: 'right' }];
      if (side === 'left') return [{ tile, side: 'left' }, ...prev];
      return [...prev, { tile, side: 'right' }];
    });
  };

  const playTile = (tile: Tile, index: number, side: 'left' | 'right') => {
    if (currentTurn !== 'player' || gameOver) return;
    if (!canPlayTile(tile, side)) return;
    
    if (gameMode !== 'bot' && socketRef.current) {
      socketRef.current.emit('makeMove', { roomCode, tile, side, handIndex: index });
    }
    
    addTileToBoardLocal(tile, side);
    const newHand = playerHand.filter((_, i) => i !== index);
    setPlayerHand(newHand);
    setTurnTimer(15);
    
    if (soundEnabled) playMoveSound();
    
    if (newHand.length === 0) {
      handleWin();
      return;
    }
    
    setCurrentTurn('opponent');
    if (gameMode === 'bot') {
      setTimeout(() => botPlay(), isTurbo ? 500 : 1000);
    }
  };

  const handleWin = () => {
    setGameOver(true);
    setWinner('player');
    
    // Calculate diamonds
    let diamondReward = 100; // Base reward
    if (gameMode === 'ranked') diamondReward = 150;
    if (gameMode === 'turbo') diamondReward = 200;
    
    // Win streak bonus
    if (currentUser) {
      const newStreak = (currentUser.stats.streak || 0) + 1;
      const streakBonus = Math.min(newStreak * 10, 100); // Max 100 bonus
      diamondReward += streakBonus;
      
      const updated: UserData = {
        ...currentUser,
        diamonds: currentUser.diamonds + diamondReward,
        stats: {
          wins: currentUser.stats.wins + 1,
          losses: currentUser.stats.losses,
          games: currentUser.stats.games + 1,
          streak: newStreak
        }
      };
      setCurrentUser(updated);
      localStorage.setItem('domino_user', JSON.stringify(updated));
      
      // Update in storage
      const users = JSON.parse(localStorage.getItem('domino_users') || '[]');
      const idx = users.findIndex((u: any) => u.id === currentUser.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updated };
        localStorage.setItem('domino_users', JSON.stringify(users));
      }
      
      // Show reward
      addSystemMessage(`🏆 بریار! +${diamondReward} 💎 (Win streak: ${newStreak}x)`);
    }
    
    if (soundEnabled) playWinSound();
  };

  const handleLose = () => {
    setGameOver(true);
    setWinner('opponent');
    
    // Reset streak
    if (currentUser) {
      const updated: UserData = {
        ...currentUser,
        stats: {
          ...currentUser.stats,
          losses: currentUser.stats.losses + 1,
          games: currentUser.stats.games + 1,
          streak: 0
        }
      };
      setCurrentUser(updated);
      localStorage.setItem('domino_user', JSON.stringify(updated));
      
      const users = JSON.parse(localStorage.getItem('domino_users') || '[]');
      const idx = users.findIndex((u: any) => u.id === currentUser.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updated };
        localStorage.setItem('domino_users', JSON.stringify(users));
      }
    }
    
    if (soundEnabled) playLoseSound();
    triggerLoseAnimation();
  };

  const botPlay = () => {
    if (gameOver || currentTurn !== 'opponent') return;
    
    let possibleMoves: Array<{tile: Tile, index: number, side: 'left' | 'right'}> = [];
    
    opponentHand.forEach((tile, index) => {
      if (canPlayTile(tile, 'left')) possibleMoves.push({ tile, index, side: 'left' });
      if (canPlayTile(tile, 'right')) possibleMoves.push({ tile, index, side: 'right' });
    });
    
    if (possibleMoves.length === 0) {
      handleWin();
      return;
    }
    
    let chosenMove = possibleMoves[0];
    if (botDifficulty === 'easy') {
      chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    } else if (botDifficulty === 'medium') {
      const doubles = possibleMoves.filter(m => m.tile[0] === m.tile[1]);
      chosenMove = doubles.length > 0 ? doubles[0] : possibleMoves[0];
    } else {
      const scored = possibleMoves.map(m => ({
        ...m,
        score: m.tile[0] + m.tile[1] + (m.tile[0] === m.tile[1] ? 10 : 0)
      }));
      scored.sort((a, b) => b.score - a.score);
      chosenMove = scored[0];
    }
    
    addTileToBoardLocal(chosenMove.tile, chosenMove.side);
    const newBotHand = opponentHand.filter((_, i) => i !== chosenMove.index);
    setOpponentHand(newBotHand);
    
    if (soundEnabled) playMoveSound();
    
    if (newBotHand.length === 0) {
      handleLose();
      return;
    }
    
    setCurrentTurn('player');
    setTurnTimer(15);
  };

  // Sounds
  const playMoveSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const playWinSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.2);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.2);
      });
    } catch (e) {}
  };

  const playLoseSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [400, 350, 300, 250].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.3);
      });
    } catch (e) {}
  };

  const triggerLoseAnimation = () => {
    setShowLaugh(true);
    setTimeout(() => setShowLaugh(false), 4000);
  };

  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, {
      sender: 'سیستەم',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  // Multiplayer
  const handleCreateRoom = () => {
    if (!connected) return alert('پەیوەندی نییە!');
    setGameMode('quick');
    socketRef.current?.emit('createRoom', { playerName });
  };

  const handleJoinRoom = () => {
    if (!connected) return alert('پەیوەندی نییە!');
    if (!inputCode.trim()) return alert('کۆدەکە بنووسە!');
    socketRef.current?.emit('joinRoom', { roomCode: inputCode.trim().toUpperCase(), playerName });
    setInputCode('');
  };

  const handleStartGame = () => {
    if (playersInRoom.length < 2) return alert('چاوەڕوانی یاریزانێکی دیە!');
    socketRef.current?.emit('startGame', { roomCode });
  };

  const sendChat = (text: string) => {
    if (!text.trim()) return;
    const msg: Message = { 
      sender: playerName, 
      text, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    if (roomCode && socketRef.current) {
      socketRef.current.emit('sendMessage', { roomCode, msg });
    }
    setMessages(prev => [...prev, msg]);
    setCurrentMsg('');
  };

  // Store
  const buySkin = (skin: Skin) => {
    if (!currentUser) return;
    if (currentUser.ownedSkins.includes(skin.id)) {
      // Equip
      const updated = { ...currentUser, selectedSkin: skin.id };
      setCurrentUser(updated);
      localStorage.setItem('domino_user', JSON.stringify(updated));
      addSystemMessage(`✅ پێکهاتەی "${skin.name}" چالاک کرا!`);
    } else if (currentUser.diamonds >= skin.price) {
      // Buy
      const updated = {
        ...currentUser,
        diamonds: currentUser.diamonds - skin.price,
        ownedSkins: [...currentUser.ownedSkins, skin.id],
        selectedSkin: skin.id
      };
      setCurrentUser(updated);
      localStorage.setItem('domino_user', JSON.stringify(updated));
      
      const users = JSON.parse(localStorage.getItem('domino_users') || '[]');
      const idx = users.findIndex((u: any) => u.id === currentUser.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updated };
        localStorage.setItem('domino_users', JSON.stringify(users));
      }
      
      addSystemMessage(`🎉 "${skin.name}" کڕی! -${skin.price} 💎`);
    } else {
      addSystemMessage(`❌ 💎 پێویستە!`);
    }
  };

  // Stats
  const getFilteredAndSortedUsers = () => {
    let filtered = allUsers.filter(user => 
      user.username.toLowerCase().includes(statsSearch.toLowerCase())
    );
    
    filtered.sort((a, b) => {
      switch (statsSortBy) {
        case 'wins': return b.stats.wins - a.stats.wins;
        case 'games': return b.stats.games - a.stats.games;
        case 'losses': return b.stats.losses - a.stats.losses;
        case 'diamonds': return b.diamonds - a.diamonds;
        case 'winrate':
          const rateA = a.stats.games > 0 ? (a.stats.wins / a.stats.games) : 0;
          const rateB = b.stats.games > 0 ? (b.stats.wins / b.stats.games) : 0;
          return rateB - rateA;
        default: return 0;
      }
    });
    
    return filtered;
  };

  const calculateWinRate = (user: UserData) => {
    if (user.stats.games === 0) return 0;
    return Math.round((user.stats.wins / user.stats.games) * 100);
  };

  const getRank = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const avatars = ['😎', '🎮', '🏆', '🔥', '💫', '🌟', '👾', '🤖', '👊', '💪', '🎯', '🎲', '🃏', '👑', '💎', '⚡', '🎲', '🎯', '🏆', '👑'];

  // ==================== DOMINO TILE ====================
  const DominoTile = ({ 
    tile, onClick, size = 'normal', disabled = false, showButtons = false, onPlayLeft, onPlayRight
  }: { 
    tile: Tile, onClick?: () => void, size?: 'small' | 'normal' | 'large', disabled?: boolean,
    showButtons?: boolean, onPlayLeft?: () => void, onPlayRight?: () => void
  }) => {
    const getDotPositions = (n: number): number[] => {
      const dots: { [key: number]: number[] } = {
        0: [], 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
      };
      return dots[n] || [];
    };
    
    const sizeConfig = {
      small: { width: 'w-8', height: 'h-14', dot: 'w-1 h-1', grid: 'w-4 h-4' },
      normal: { width: 'w-10', height: 'h-18', dot: 'w-1.5 h-1.5', grid: 'w-5 h-5' },
      large: { width: 'w-14', height: 'h-24', dot: 'w-2 h-2', grid: 'w-7 h-7' },
      xlarge: { width: 'w-16', height: 'h-28', dot: 'w-2.5 h-2.5', grid: 'w-8 h-8' }
    };
    
    const config = sizeConfig[size];
    
    const renderDots = (value: number) => (
      <div className={`grid grid-cols-3 gap-0.5 ${config.grid}`}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((pos) => (
          <div key={pos} className={`${config.dot} rounded-full ${getDotPositions(value).includes(pos) ? 'bg-gray-800' : 'transparent'}`} />
        ))}
      </div>
    );
    
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          onClick={disabled ? undefined : onClick}
          className={`
            ${config.width} ${config.height}
            bg-gradient-to-b from-white via-gray-50 to-gray-200
            rounded-lg border-2 border-gray-400 shadow-lg flex flex-col
            ${!disabled && onClick ? 'cursor-pointer hover:shadow-xl hover:scale-105 active:scale-95' : ''}
            ${disabled ? 'opacity-50' : ''}
            transition-all duration-150
          `}
        >
          <div className="flex-1 flex items-center justify-center border-b-2 border-gray-300">{renderDots(tile[0])}</div>
          <div className="flex-1 flex items-center justify-center">{renderDots(tile[1])}</div>
        </div>
        
        {showButtons && !disabled && (
          <div className="flex gap-1">
            {onPlayLeft && (
              <button onClick={onPlayLeft} className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded font-bold animate-pulse">
                ⬅️
              </button>
            )}
            {onPlayRight && (
              <button onClick={onPlayRight} className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded font-bold animate-pulse">
                ➡️
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // ==================== BOARD TILE ====================
  const BoardTileDisplay = ({ tile, isFirst, isLast }: { tile: Tile, isFirst: boolean, isLast: boolean }) => {
    const getDotPositions = (n: number): number[] => {
      const dots: { [key: number]: number[] } = {
        0: [], 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
      };
      return dots[n] || [];
    };
    
    return (
      <div className={`
        w-12 h-20 md:w-14 md:h-24
        bg-gradient-to-b from-white via-gray-50 to-gray-200
        rounded-lg border-2 border-gray-400 shadow-lg flex flex-col flex-shrink-0
        ${isFirst ? 'border-l-4 border-l-green-500' : ''}
        ${isLast ? 'border-r-4 border-r-green-500' : ''}
      `}>
        <div className="flex-1 flex items-center justify-center border-b-2 border-gray-300">
          <div className="grid grid-cols-3 gap-0.5 w-6 h-6">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((pos) => (
              <div key={pos} className={`w-1.5 h-1.5 rounded-full ${getDotPositions(tile[0]).includes(pos) ? 'bg-gray-800' : 'transparent'}`} />
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-0.5 w-6 h-6">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((pos) => (
              <div key={pos} className={`w-1.5 h-1.5 rounded-full ${getDotPositions(tile[1]).includes(pos) ? 'bg-gray-800' : 'transparent'}`} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ==================== KURDISTAN BACKGROUND ====================
  const KurdistanBackground = ({ opacity = 0.15 }: { opacity?: number }) => (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{
        background: `linear-gradient(180deg, #ED1C24 0%, #ED1C24 33%, #FFFFFF 33%, #FFFFFF 66%, #278E43 66%, #278E43 100%)`,
        opacity
      }} />
      <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: opacity * 2 }}>
        <div className="w-40 h-40 md:w-60 md:h-60 rounded-full animate-pulse" style={{
          background: `radial-gradient(circle, #FFC800 0%, #FFC800 30%, rgba(255, 200, 0, 0.5) 50%, transparent 70%)`,
          boxShadow: '0 0 150px 75px rgba(255, 200, 0, 0.2)'
        }} />
      </div>
    </div>
  );

  // ==================== DIAMOND BADGE ====================
  const DiamondBadge = ({ diamonds, size = 'normal' }: { diamonds: number, size?: 'small' | 'normal' | 'large' }) => {
    const sizeClasses = {
      small: 'text-sm px-2 py-1',
      normal: 'text-base px-3 py-1.5',
      large: 'text-xl px-4 py-2'
    };
    
    return (
      <div className={`inline-flex items-center gap-1 bg-purple-600/80 backdrop-blur-sm rounded-full ${sizeClasses[size]} text-white font-bold border border-purple-400`}>
        <span>💎</span>
        <span>{diamonds.toLocaleString()}</span>
      </div>
    );
  };

  // ==================== LOADING SCREEN ====================
  if (view === 'loading') {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <KurdistanBackground opacity={0.3} />
        <div className="relative z-10 text-center">
          <div className="text-8xl mb-6 animate-bounce">🎲</div>
          <h1 className="text-5xl md:text-6xl font-black italic mb-4 animate-pulse" 
              style={{ color: '#FFC800', textShadow: '3px 3px 0 #ED1C24, 6px 6px 0 #278E43' }}>
            DOMINO
          </h1>
          <p className="text-white font-bold text-xl mb-8 animate-pulse">دومینۆی کوردستان</p>
          <div className="w-64 h-3 bg-white/20 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ==================== LOGIN SCREEN ====================
  if (view === 'login') {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        <KurdistanBackground opacity={0.25} />
        
        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(10deg); }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-shake { animation: shake 0.5s ease-in-out; }
          .animate-slide-up { animation: slideUp 0.6s ease-out; }
          .animate-scale-in { animation: scaleIn 0.5s ease-out; }
        `}</style>

        <div className="relative z-10 w-full max-w-md animate-scale-in">
          <div className="text-center mb-8 animate-slide-up">
            <div className="inline-block p-6 bg-white/10 rounded-full backdrop-blur-sm mb-4 border-4 border-yellow-500/50">
              <div className="text-7xl md:text-8xl">🎲</div>
            </div>
            <h1 className="text-5xl md:text-7xl font-black italic mb-2" 
                style={{ color: '#FFC800', textShadow: '3px 3px 0 #ED1C24, 6px 6px 0 #278E43' }}>
              DOMINO
            </h1>
            <p className="text-white font-bold text-lg">🇨🇺 دومینۆی کوردستان 🇨🇺</p>
          </div>

          <div className={`bg-white/95 backdrop-blur-lg rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-yellow-500 ${shakeLogin ? 'animate-shake' : ''}`}>
            <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => { setIsRegister(false); setAuthError(''); }}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                  !isRegister ? 'bg-green-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                🎮 چونە ناو
              </button>
              <button
                onClick={() => { setIsRegister(true); setAuthError(''); }}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                  isRegister ? 'bg-green-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                📝 هەژمار بسازە
              </button>
            </div>

            {authError && (
              <div className="bg-red-50 border-2 border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <span className="font-bold text-sm">{authError}</span>
              </div>
            )}

            {isRegister ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-3 text-gray-700">هەیبەتەکەت هەڵبژێرە</label>
                  <div className="grid grid-cols-8 gap-2">
                    {avatars.map((avatar) => (
                      <button
                        key={avatar}
                        onClick={() => setSelectedAvatar(avatar)}
                        className={`text-2xl p-2 rounded-xl transition-all transform hover:scale-110 ${
                          selectedAvatar === avatar 
                            ? 'bg-yellow-400 scale-110 shadow-lg ring-2 ring-yellow-500' 
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">ناوی بەکارهێنەر</label>
                  <input
                    type="text"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                    placeholder="لانیکەم ٣ پیت..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">وشەی نهێنی</label>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                    placeholder="لانیکەم ٤ پیت..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">دووبارە وشەی نهێنی</label>
                  <input
                    type="password"
                    value={registerConfirm}
                    onChange={(e) => setRegisterConfirm(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                    placeholder="دووبارە وشەی نهێنی..."
                    onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
                  />
                </div>

                <button
                  onClick={handleRegister}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 rounded-xl border-b-4 border-green-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg"
                >
                  {isLoading ? '⏳ دروستکردن...' : `${selectedAvatar} هەژمار بسازە`}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">ناوی بەکارهێنەر</label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none text-lg"
                    placeholder="ناوی بەکارهێنەر..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-gray-700">وشەی نهێنی</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none text-lg"
                    placeholder="وشەی نهێنی..."
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>

                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 rounded-xl border-b-4 border-green-700 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg text-lg"
                >
                  {isLoading ? '⏳ چاوەڕوان بە...' : '🎮 چونە ناو'}
                </button>
              </div>
            )}

            {!isRegister && (
              <div className="mt-6 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-blue-800 text-sm text-center">
                  💡 بۆ تاقیکردنەوە: <strong>test</strong> / <strong>test</strong>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN MENU - LIKE PHOTO 2 ====================
  if (view === 'menu') {
    return (
      <div className="min-h-screen relative">
        {/* Background - wooden table with dominoes */}
        <div className="fixed inset-0 -z-10" style={{
          background: `linear-gradient(135deg, #3d2914 0%, #5c3d1e 50%, #2d1f0f 100%)`
        }}>
          {/* Domino pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        
        <LaughOverlay />
        
        <div className="relative z-10 min-h-screen p-4">
          {/* Top Bar */}
          <div className="flex justify-between items-center mb-6">
            {/* User Info */}
            {currentUser && (
              <div className="flex items-center gap-3">
                <div className="text-4xl">{currentUser.avatar}</div>
                <div>
                  <div className="font-bold text-white text-lg">{currentUser.username}</div>
                  <div className="flex items-center gap-2">
                    <DiamondBadge diamonds={currentUser.diamonds} size="small" />
                    {currentUser.stats.streak > 0 && (
                      <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                        🔥 {currentUser.stats.streak}x
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Top Right */}
            <div className="flex items-center gap-3">
              <button onClick={handleLogout} className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm">
                چونە دەرەوە
              </button>
            </div>
          </div>
          
          {/* Main Logo */}
          <div className="text-center mb-6">
            <h1 className="text-4xl md:text-6xl font-black italic" 
                style={{ color: '#FFC800', textShadow: '3px 3px 0 #ED1C24, 6px 6px 0 #278E43' }}>
              DOMINO
            </h1>
          </div>
          
          {/* Navigation Tabs - LIKE PHOTO 2 */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-1 flex gap-1">
              <button
                onClick={() => setActiveTab('play')}
                className={`px-6 py-2 rounded-xl font-bold transition-all ${
                  activeTab === 'play' ? 'bg-amber-500 text-black' : 'text-white hover:bg-white/10'
                }`}
              >
                🎮 PLAY
              </button>
              <button
                onClick={() => { setActiveTab('champions'); setView('champions'); loadAllUsers(); }}
                className={`px-6 py-2 rounded-xl font-bold transition-all ${
                  activeTab === 'champions' ? 'bg-amber-500 text-black' : 'text-white hover:bg-white/10'
                }`}
              >
                👑 CHAMPIONS
              </button>
              <button
                onClick={() => { setActiveTab('store'); setView('store'); }}
                className={`px-6 py-2 rounded-xl font-bold transition-all ${
                  activeTab === 'store' ? 'bg-amber-500 text-black' : 'text-white hover:bg-white/10'
                }`}
              >
                🏪 STORE
              </button>
            </div>
          </div>
          
          {/* Play Modes - LIKE PHOTO 2 */}
          {activeTab === 'play' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {/* Quick Play */}
              <div className="bg-gradient-to-br from-red-600/90 to-red-800/90 backdrop-blur-sm rounded-3xl p-6 border border-red-400/30 shadow-2xl hover:scale-105 transition-all cursor-pointer group"
                   onClick={() => startGame('quick')}>
                <div className="w-20 h-20 mx-auto mb-4 bg-red-500/30 rounded-full flex items-center justify-center group-hover:bg-red-500/50 transition-all">
                  <div className="text-5xl">▶️</div>
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">QUICK PLAY</h3>
                <p className="text-white/70 text-xs text-center mb-4">کلاسیک یاری، دەستبەجێ</p>
                <button className="w-full bg-red-800 hover:bg-red-700 text-white font-bold py-2 rounded-xl border border-red-500/50">
                  PLAY
                </button>
              </div>
              
              {/* Ranked */}
              <div className="bg-gradient-to-br from-amber-600/90 to-amber-800/90 backdrop-blur-sm rounded-3xl p-6 border border-amber-400/30 shadow-2xl hover:scale-105 transition-all cursor-pointer group"
                   onClick={() => startGame('ranked')}>
                <div className="w-20 h-20 mx-auto mb-4 bg-amber-500/30 rounded-full flex items-center justify-center group-hover:bg-amber-500/50 transition-all">
                  <div className="text-5xl">👑</div>
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">RANKED</h3>
                <p className="text-white/70 text-xs text-center mb-4">پێشبڕکێ بۆ ئاستی جهانی</p>
                <button className="w-full bg-amber-800 hover:bg-amber-700 text-white font-bold py-2 rounded-xl border border-amber-500/50">
                  PLAY
                </button>
              </div>
              
              {/* Turbo */}
              <div className="bg-gradient-to-br from-orange-600/90 to-orange-800/90 backdrop-blur-sm rounded-3xl p-6 border border-orange-400/30 shadow-2xl hover:scale-105 transition-all cursor-pointer group"
                   onClick={() => startGame('turbo')}>
                <div className="w-20 h-20 mx-auto mb-4 bg-orange-500/30 rounded-full flex items-center justify-center group-hover:bg-orange-500/50 transition-all">
                  <div className="text-5xl">⚡</div>
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">TURBO</h3>
                <p className="text-white/70 text-xs text-center mb-4">یاری خێرا کۆنترۆل</p>
                <button className="w-full bg-orange-800 hover:bg-orange-700 text-white font-bold py-2 rounded-xl border border-orange-500/50">
                  PLAY
                </button>
              </div>
              
              {/* Tournament */}
              <div className="bg-gradient-to-br from-purple-600/90 to-purple-800/90 backdrop-blur-sm rounded-3xl p-6 border border-purple-400/30 shadow-2xl hover:scale-105 transition-all cursor-pointer group"
                   onClick={() => setView('tournament')}>
                <div className="w-20 h-20 mx-auto mb-4 bg-purple-500/30 rounded-full flex items-center justify-center group-hover:bg-purple-500/50 transition-all">
                  <div className="text-5xl">🏆</div>
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">TOURNAMENT</h3>
                <p className="text-white/70 text-xs text-center mb-4">بە قەزا بۆ جایزە</p>
                <button className="w-full bg-purple-800 hover:bg-purple-700 text-white font-bold py-2 rounded-xl border border-purple-500/50">
                  PLAY
                </button>
              </div>
            </div>
          )}
          
          {/* Bottom Bar */}
          <div className="fixed bottom-4 left-4 right-4 flex justify-between items-center">
            <button
              onClick={() => setView('stats')}
              className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-bold hover:bg-white/30 transition-all"
            >
              📊 ئاست
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="bg-white/20 backdrop-blur-sm text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/30 transition-all"
              >
                ⚙️
              </button>
            </div>
          </div>
          
          {/* Settings Modal */}
          {showSettings && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-white/95 rounded-2xl p-6 max-w-sm w-full">
                <h2 className="text-2xl font-bold mb-4 text-center">⚙️ ڕێکخستن</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">🔊 دەنگ</span>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`px-4 py-2 rounded-full font-bold ${soundEnabled ? 'bg-green-500 text-white' : 'bg-gray-300'}`}
                    >
                      {soundEnabled ? 'کریە' : 'کوژاوە'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full mt-4 bg-gray-600 text-white font-bold py-2 rounded-xl"
                >
                  داخستن
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== CHAMPIONS SCREEN ====================
  if (view === 'champions') {
    const filteredUsers = getFilteredAndSortedUsers();
    
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 -z-10" style={{
          background: `linear-gradient(135deg, #3d2914 0%, #5c3d1e 50%, #2d1f0f 100%)`
        }} />
        
        <div className="relative z-10 min-h-screen p-4">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setView('menu')}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-bold transition-all">
                ↩ گەڕانەوە
              </button>
              <h1 className="text-3xl font-black text-white">👑 CHAMPIONS</h1>
              <DiamondBadge diamonds={currentUser?.diamonds || 0} />
            </div>
            
            {/* Search & Filter */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  type="text"
                  value={statsSearch}
                  onChange={(e) => setStatsSearch(e.target.value)}
                  className="flex-1 p-3 rounded-xl bg-white/20 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="🔍 گەڕان بە ناو..."
                />
                <select
                  value={statsSortBy}
                  onChange={(e) => setStatsSortBy(e.target.value as any)}
                  className="p-3 rounded-xl bg-white/20 text-white outline-none"
                >
                  <option value="wins">🏆 بریار</option>
                  <option value="diamonds">💎 جواهر</option>
                  <option value="games">🎮 یاری</option>
                  <option value="winrate">📈 ئاستی بریار</option>
                </select>
              </div>
            </div>
            
            {/* Top 3 Podium */}
            {filteredUsers.length >= 3 && (
              <div className="flex justify-center items-end gap-2 mb-8">
                {/* 2nd */}
                <div className="text-center">
                  <div className="text-4xl mb-2">{filteredUsers[1].avatar}</div>
                  <div className="bg-gray-200 rounded-lg p-2 w-28">
                    <div className="font-bold text-sm truncate">{filteredUsers[1].username}</div>
                    <div className="text-xs text-gray-600">🥈 {filteredUsers[1].stats.wins}W</div>
                  </div>
                  <div className="h-16 bg-gray-400 rounded-t-lg mt-1"></div>
                </div>
                
                {/* 1st */}
                <div className="text-center">
                  <div className="text-5xl mb-2">{filteredUsers[0].avatar}</div>
                  <div className="bg-yellow-100 rounded-lg p-3 w-32 border-2 border-yellow-400">
                    <div className="font-bold truncate">{filteredUsers[0].username}</div>
                    <div className="text-sm text-yellow-700">🥇 {filteredUsers[0].stats.wins}W</div>
                  </div>
                  <div className="h-24 bg-yellow-500 rounded-t-lg mt-1"></div>
                </div>
                
                {/* 3rd */}
                <div className="text-center">
                  <div className="text-4xl mb-2">{filteredUsers[2].avatar}</div>
                  <div className="bg-orange-100 rounded-lg p-2 w-28">
                    <div className="font-bold text-sm truncate">{filteredUsers[2].username}</div>
                    <div className="text-xs text-gray-600">🥉 {filteredUsers[2].stats.wins}W</div>
                  </div>
                  <div className="h-12 bg-orange-400 rounded-t-lg mt-1"></div>
                </div>
              </div>
            )}
            
            {/* Leaderboard List */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
              {filteredUsers.map((user, index) => (
                <div key={user.id} className={`flex items-center gap-4 p-4 border-b border-white/10 ${
                  currentUser?.id === user.id ? 'bg-yellow-500/20' : 'hover:bg-white/5'
                }`}>
                  <div className="w-8 text-center font-bold text-white text-lg">{getRank(index)}</div>
                  <div className="text-3xl">{user.avatar}</div>
                  <div className="flex-1">
                    <div className="font-bold text-white">{user.username}</div>
                    <div className="text-white/60 text-sm flex gap-3">
                      <span>🏆 {user.stats.wins}</span>
                      <span>💔 {user.stats.losses}</span>
                      <span>💎 {user.diamonds}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-yellow-400 font-bold">{calculateWinRate(user)}%</div>
                    <div className="text-white/60 text-xs">winrate</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== STORE SCREEN - LIKE PHOTO 4 ====================
  if (view === 'store') {
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 -z-10" style={{
          background: `linear-gradient(135deg, #3d2914 0%, #5c3d1e 50%, #2d1f0f 100%)`
        }} />
        
        <style jsx>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .shimmer {
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
            background-size: 200% 100%;
            animation: shimmer 2s infinite;
          }
        `}</style>
        
        <div className="relative z-10 min-h-screen p-4">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setView('menu')}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-bold transition-all">
                ↩ گەڕانەوە
              </button>
              <h1 className="text-3xl font-black text-white">🏪 STORE</h1>
              <DiamondBadge diamonds={currentUser?.diamonds || 0} size="large" />
            </div>
            
            {/* Store Tabs */}
            <div className="flex justify-center mb-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-1 flex gap-1">
                <button
                  onClick={() => setStoreTab('skins')}
                  className={`px-8 py-3 rounded-xl font-bold transition-all ${
                    storeTab === 'skins' ? 'bg-amber-500 text-black' : 'text-white hover:bg-white/10'
                  }`}
                >
                  🎨 SKINS
                </button>
                <button
                  onClick={() => setStoreTab('gems')}
                  className={`px-8 py-3 rounded-xl font-bold transition-all ${
                    storeTab === 'gems' ? 'bg-amber-500 text-black' : 'text-white hover:bg-white/10'
                  }`}
                >
                  💎 GEMS
                </button>
              </div>
            </div>
            
            {storeTab === 'skins' && (
              <>
                {/* Daily Items */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-white font-bold">DAILY ITEMS</span>
                  <span className="bg-amber-500/30 text-amber-300 px-2 py-1 rounded text-xs">REFRESHES IN 12H</span>
                </div>
                
                {/* Skins Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {skins.map((skin) => {
                    const owned = currentUser?.ownedSkins.includes(skin.id);
                    const equipped = currentUser?.selectedSkin === skin.id;
                    const canBuy = currentUser && currentUser.diamonds >= skin.price;
                    
                    return (
                      <div key={skin.id} className={`bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 ${
                        equipped ? 'border-green-500' : 'border-white/20'
                      }`}>
                        {/* Skin Preview */}
                        <div className="h-40 flex items-center justify-center relative overflow-hidden"
                             style={{
                               background: `linear-gradient(135deg, ${skin.colors.primary}, ${skin.colors.secondary})`
                             }}>
                          <div className="absolute inset-0 shimmer" />
                          <div className="text-6xl">{skin.emoji}</div>
                          {equipped && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                              EQUIPPED
                            </div>
                          )}
                        </div>
                        
                        {/* Skin Info */}
                        <div className="p-4">
                          <h3 className="text-xl font-bold text-white mb-1">{skin.name}</h3>
                          <p className="text-white/60 text-sm mb-4">
                            {skin.type === 'table' ? 'ڕووی تەختە' : skin.type === 'tiles' ? 'دومینۆ' : 'ڕەک'}
                          </p>
                          
                          {owned ? (
                            <button
                              onClick={() => buySkin(skin)}
                              className={`w-full font-bold py-2 rounded-xl transition-all ${
                                equipped 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              {equipped ? '✅ چالاکە' : '🎯 بەکاربهینە'}
                            </button>
                          ) : (
                            <button
                              onClick={() => buySkin(skin)}
                              disabled={!canBuy}
                              className={`w-full font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition-all ${
                                canBuy 
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <span>💎</span>
                              <span>{skin.price}</span>
                              {!canBuy && <span className="text-xs">(پێویستە)</span>}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            
            {storeTab === 'gems' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Small Pack */}
                <div className="bg-gradient-to-br from-blue-600/30 to-blue-800/30 backdrop-blur-sm rounded-2xl p-6 border border-blue-400/30">
                  <div className="text-5xl text-center mb-4">💎</div>
                  <h3 className="text-xl font-bold text-white text-center mb-2">کۆمپلیمینت</h3>
                  <div className="text-3xl font-bold text-blue-400 text-center mb-4">100 💎</div>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">
                    ٣.٩٩ $
                  </button>
                </div>
                
                {/* Medium Pack */}
                <div className="bg-gradient-to-br from-purple-600/30 to-purple-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-400/30 relative">
                  <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold">
                    مەعروف!
                  </div>
                  <div className="text-5xl text-center mb-4">💎💎💎</div>
                  <h3 className="text-xl font-bold text-white text-center mb-2">پاشەکەوت</h3>
                  <div className="text-3xl font-bold text-purple-400 text-center mb-4">500 💎</div>
                  <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl">
                    ٩.٩٩ $
                  </button>
                </div>
                
                {/* Large Pack */}
                <div className="bg-gradient-to-br from-amber-600/30 to-amber-800/30 backdrop-blur-sm rounded-2xl p-6 border border-amber-400/30">
                  <div className="text-5xl text-center mb-4">💎👑</div>
                  <h3 className="text-xl font-bold text-white text-center mb-2">خۆشاوێک</h3>
                  <div className="text-3xl font-bold text-amber-400 text-center mb-4">1500 💎</div>
                  <button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl">
                    ٢٤.٩٩ $
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== TOURNAMENT SCREEN - LIKE PHOTO 3 ====================
  if (view === 'tournament') {
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 -z-10" style={{
          background: `linear-gradient(135deg, #3d2914 0%, #5c3d1e 50%, #2d1f0f 100%)`
        }} />
        
        <div className="relative z-10 min-h-screen p-4">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setView('menu')}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-bold transition-all">
                ↩
              </button>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                🏆 TOURNAMENT
              </h1>
              <div className="flex items-center gap-2">
                <div className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-xl font-mono text-lg">
                  ⏰ {tournamentTimer}
                </div>
              </div>
            </div>
            
            {currentTournament && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
                {/* Tournament Header */}
                <div className="bg-gradient-to-r from-amber-600/50 to-amber-800/50 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-amber-500 text-black px-2 py-1 rounded text-xs font-bold">SOON</span>
                        <span className="text-white text-2xl font-black">{currentTournament.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-white/70 text-sm">
                        <span>👥 {currentTournament.players.length}/{currentTournament.maxPlayers}</span>
                        <span>💰 FREE</span>
                      </div>
                    </div>
                    <div className="text-green-500 text-3xl">✓</div>
                  </div>
                </div>
                
                {/* Tournament Content */}
                <div className="grid md:grid-cols-2 gap-4 p-6">
                  {/* Prizes */}
                  <div>
                    <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                      🏆 PRIZES
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                        <span className="text-yellow-400">🥇 1ST</span>
                        <span className="text-white font-bold">{currentTournament.prizes.first.toLocaleString()} 💎</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                        <span className="text-gray-300">🥈 2ND</span>
                        <span className="text-white font-bold">{currentTournament.prizes.second.toLocaleString()} 💎</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                        <span className="text-orange-400">🥉 3RD</span>
                        <span className="text-white font-bold">{currentTournament.prizes.third.toLocaleString()} 💎</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Rules */}
                  <div>
                    <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2">
                      📋 RULES
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                        <span className="text-white/60">MODE</span>
                        <span className="text-white font-bold">Ranked</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                        <span className="text-white/60">TEAM</span>
                        <span className="text-white font-bold">1v1</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                        <span className="text-white/60">ENTRY</span>
                        <span className="text-green-400 font-bold">Free</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                        <span className="text-white/60">TIMER</span>
                        <span className="text-white font-bold">15s</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Players List */}
                <div className="px-6 pb-6">
                  <h3 className="text-purple-400 font-bold mb-3 flex items-center gap-2">
                    👥 PLAYERS ({currentTournament.players.length})
                  </h3>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {currentTournament.players.slice(0, 10).map((player, idx) => (
                      <div key={player.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-2">
                        <span className="text-white/60 w-6">#{idx + 1}</span>
                        <span className="text-2xl">{player.avatar}</span>
                        <span className="text-white flex-1">{player.name}</span>
                        <span className="text-amber-400 text-sm">{player.wins}W</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Join Button */}
                <div className="p-6 pt-0">
                  <button 
                    onClick={() => {
                      startGame('ranked');
                      addSystemMessage('🏆 Tournament match begonnen! +100 💎 voor winst!');
                    }}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 rounded-xl text-lg transition-all"
                  >
                    🎮 JOIN TOURNAMENT
                  </button>
                </div>
              </div>
            )}
            
            {/* Leave Button */}
            <button
              onClick={() => setView('menu')}
              className="w-full mt-4 bg-red-600/50 hover:bg-red-600 text-white font-bold py-3 rounded-xl"
            >
              ↩ LEAVE TOURNAMENT
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== GAME SCREEN - LIKE PHOTO 1 ====================
  return (
    <div className="min-h-screen relative overflow-hidden">
      <LaughOverlay />
      
      {/* Green felt table background */}
      <div className="fixed inset-0 -z-10" style={{
        background: `
          radial-gradient(ellipse at center, #2d5a27 0%, #1a3d15 50%, #0f2a0d 100%)
        `
      }}>
        {/* Texture overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,0.1) 2px,
              rgba(0,0,0,0.1) 4px
            )
          `
        }} />
      </div>
      
      {/* Table wooden frame */}
      <div className="fixed inset-2 border-8 border-amber-900 rounded-3xl shadow-2xl" />
      <div className="fixed inset-4 border-4 border-amber-800 rounded-2xl" />
      
      {/* Kurdistan stripe */}
      <div className="fixed bottom-4 left-8 right-8 h-2 flex rounded overflow-hidden z-20">
        <div className="flex-1" style={{ background: '#ED1C24' }} />
        <div className="flex-1" style={{ background: '#FFFFFF' }} />
        <div className="flex-1" style={{ background: '#278E43' }} />
      </div>
      
      <div className="relative z-10 min-h-screen flex flex-col p-3">
        {/* Top Bar - LIKE PHOTO 1 */}
        <div className="flex justify-between items-center mb-2">
          {/* Round & Score */}
          <div className="flex items-center gap-2">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
              <button className="text-white/70 hover:text-white">🔄</button>
              <span className="text-white font-bold">{roundNumber}/3</span>
              <span className="text-white/50">=</span>
              <span className="text-white font-bold">0</span>
            </div>
          </div>
          
          {/* Center - Player */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-3 border-green-500 bg-black/40 flex items-center justify-center text-2xl">
              {currentUser?.avatar || '👤'}
            </div>
            <span className="text-white text-xs mt-1 font-bold">{playerName}</span>
          </div>
          
          {/* Right buttons */}
          <div className="flex items-center gap-2">
            {isTurbo && (
              <div className={`px-3 py-2 rounded-xl font-bold ${turnTimer <= 5 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'} text-white`}>
                ⏱️ {turnTimer}s
              </div>
            )}
            <button onClick={() => setShowChat(!showChat)} className="bg-black/40 hover:bg-black/60 text-white w-10 h-10 rounded-xl flex items-center justify-center">
              💬
            </button>
            <button onClick={() => setShowGameMenu(!showGameMenu)} className="bg-black/40 hover:bg-black/60 text-white w-10 h-10 rounded-xl flex items-center justify-center">
              ☰
            </button>
          </div>
        </div>
        
        {/* Opponent (top) */}
        <div className="flex justify-center mb-2">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-4 py-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-red-500 bg-black/40 flex items-center justify-center">
              🤖
            </div>
            <div>
              <div className="text-white font-bold text-sm">بۆت</div>
              <div className="text-white/60 text-xs">{opponentHand.length} خشتە</div>
            </div>
            {/* Opponent rack */}
            <div className="flex gap-1 ml-2">
              {opponentHand.slice(0, 7).map((_, i) => (
                <div key={i} className="w-6 h-10 bg-gradient-to-b from-amber-700 to-amber-900 rounded border border-amber-600 shadow-md" />
              ))}
            </div>
          </div>
        </div>
        
        {/* Board - CENTER */}
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-black/20 backdrop-blur-sm rounded-3xl p-6 min-h-[180px] flex items-center justify-center max-w-4xl w-full">
            {board.length === 0 ? (
              <div className="text-white/80 text-center animate-pulse">
                <div className="text-6xl mb-3">🎯</div>
                <p className="font-bold text-xl">خشتەیەک هەڵببە</p>
                <p className="text-sm text-white/60 mt-1">کلیک لە خشتەیەک بکە بۆ دەستپێکردن</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto py-4 px-2">
                {board.map((item, i) => (
                  <BoardTileDisplay key={i} tile={item.tile} isFirst={i === 0} isLast={i === board.length - 1} />
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Player's rack - WOODEN RACK STYLE */}
        <div className="bg-gradient-to-t from-amber-900 via-amber-800 to-amber-700 rounded-t-3xl p-4 border-t-4 border-amber-600 shadow-2xl relative">
          {/* Rack metallic edge */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-gray-400 to-gray-600 rounded-t-3xl" />
          
          <div className="flex justify-between items-center mb-3 mt-2">
            <div className="text-white text-sm">
              <span className="font-bold">🖐️ دەستەکەت</span>
              <span className="ml-2 bg-yellow-500 text-black px-2 py-0.5 rounded-full text-xs font-bold">
                {playerHand.length}
              </span>
            </div>
            
            {gameOver && (
              <div className={`font-bold px-4 py-2 rounded-xl ${
                winner === 'player' ? 'bg-green-500' : 'bg-red-500'
              } text-white animate-bounce`}>
                {winner === 'player' ? '🏆 بریار! +100 💎' : '🤣 شکست!'}
              </div>
            )}
          </div>
          
          {/* Player's tiles in rack */}
          <div className="flex justify-center gap-3 flex-wrap">
            {playerHand.map((tile, i) => {
              const playableSides = getPlayableSides(tile);
              const canPlay = currentTurn === 'player' && !gameOver && playableSides !== 'none';
              
              return (
                <DominoTile
                  key={i}
                  tile={tile}
                  size="large"
                  disabled={!canPlay}
                  showButtons={canPlay}
                  onClick={() => {
                    if (playableSides === 'both' || playableSides === 'right') playTile(tile, i, 'right');
                    else if (playableSides === 'left') playTile(tile, i, 'left');
                  }}
                  onPlayLeft={playableSides === 'left' || playableSides === 'both' ? () => playTile(tile, i, 'left') : undefined}
                  onPlayRight={playableSides === 'right' || playableSides === 'both' ? () => playTile(tile, i, 'right') : undefined}
                />
              );
            })}
          </div>
          
          {/* Bottom buttons */}
          <div className="flex justify-between items-center mt-3">
            <button onClick={() => setView('menu')}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold">
              ↩ گەڕانەوە
            </button>
            
            <div className="flex gap-2">
              <button onClick={() => { if (gameOver) startGame(gameMode); }}
                className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold ${!gameOver ? 'opacity-50' : ''}`}>
                🔄 نوێ
              </button>
            </div>
          </div>
        </div>
        
        {/* Chat Panel (slide in from right) */}
        {showChat && (
          <div className="fixed right-4 top-20 bottom-24 w-72 bg-black/80 backdrop-blur-sm rounded-2xl p-4 flex flex-col z-30">
            <div className="flex justify-between items-center mb-3">
              <span className="text-white font-bold">💬 چات</span>
              <button onClick={() => setShowChat(false)} className="text-white/60 hover:text-white">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {messages.slice(-20).map((msg, i) => (
                <div key={i} className={`p-2 rounded-lg text-xs ${
                  msg.sender === 'سیستەم' ? 'bg-blue-600/40 text-blue-200' : 'bg-white/10 text-white'
                }`}>
                  <span className="font-bold text-yellow-400">{msg.sender}: </span>
                  {msg.text}
                  <div className="text-white/40 text-[10px] mt-1">{msg.time}</div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-1 mb-2 flex-wrap">
              {['🔥', '👏', '😂', '👋', '🎯', '💪', '😎'].map(e => (
                <button key={e} onClick={() => sendChat(e)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded text-lg">{e}</button>
              ))}
            </div>
            
            <div className="flex gap-1">
              <input
                type="text"
                value={currentMsg}
                onChange={(e) => setCurrentMsg(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChat(currentMsg)}
                className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                placeholder="پەیام..."
              />
              <button onClick={() => sendChat(currentMsg)} className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-white font-bold">
                ➤
              </button>
            </div>
          </div>
        )}
        
        {/* Game Menu Overlay */}
        {showGameMenu && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40">
            <div className="bg-white/95 rounded-2xl p-6 max-w-sm w-full">
              <h2 className="text-2xl font-bold mb-6 text-center">⚙️ مینیو</h2>
              <div className="space-y-3">
                <button onClick={() => { setView('menu'); setShowGameMenu(false); }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl">
                  🚪 چوونە دەرەوە
                </button>
                <button onClick={() => { startGame(gameMode); setShowGameMenu(false); }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl">
                  🔄 یاری نوێ
                </button>
                <button onClick={() => setShowGameMenu(false)}
                  className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-xl">
                  ↩️ بەردەوام بە
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}