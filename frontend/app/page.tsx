"use client";
import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = "https://dominos-app.onrender.com";

type Tile = [number, number];
type Message = { sender: string; text: string; time: string };
type UserData = {
  id: string;
  username: string;
  avatar: string;
  diamonds: number;
  selectedRackSkin: string;
  ownedSkins: string[];
  stats: { wins: number; losses: number; games: number; streak: number };
};

type RackSkin = {
  id: string;
  name: string;
  price: number;
  bg: string;
  border: string;
  owned: boolean;
};

export default function Home() {
  const [view, setView] = useState<'loading' | 'login' | 'menu' | 'game' | 'store' | 'champions' | 'tournament'>('loading');
  const [menuTab, setMenuTab] = useState<'PLAY' | 'CHAMPIONS' | 'STORE'>('PLAY');
  const [storeTab, setStoreTab] = useState<'SKINS' | 'GEMS'>('SKINS');
  
  // Auth
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('😎');
  
  // Game
  const [board, setBoard] = useState<Tile[]>([]);
  const [playerHand, setPlayerHand] = useState<Tile[]>([]);
  const [opponentHand, setOpponentHand] = useState<Tile[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>('player');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(15);
  const [gameMode, setGameMode] = useState<string>('quick');
  const [showChat, setShowChat] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [drawPileCount, setDrawPileCount] = useState(14);
  
  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMsg, setCurrentMsg] = useState('');
  
  // Tournament
  const [tournamentTime, setTournamentTime] = useState('23:59:59');
  
  // All users
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  
  // Rack skins
  const rackSkins: RackSkin[] = [
    { id: 'classic', name: 'کلاسیک', price: 0, bg: 'bg-gradient-to-b from-amber-700 to-amber-900', border: 'border-amber-600', owned: true },
    { id: 'neon', name: 'نیۆن پات', price: 100, bg: 'bg-gradient-to-b from-purple-900 to-black', border: 'border-purple-500', owned: false },
    { id: 'ancient', name: 'Ancient Stone', price: 0, bg: 'bg-gradient-to-b from-stone-600 to-stone-800', border: 'border-stone-500', owned: true },
    { id: 'golden', name: 'Golden Lux', price: 20, bg: 'bg-gradient-to-b from-yellow-600 to-yellow-900', border: 'border-yellow-400', owned: false },
    { id: 'kurdistan', name: 'کوردستان', price: 150, bg: 'bg-gradient-to-b from-green-700 via-white to-red-700', border: 'border-yellow-500', owned: false },
    { id: 'diamond', name: 'Diamond', price: 300, bg: 'bg-gradient-to-b from-cyan-400 to-blue-900', border: 'border-cyan-300', owned: false },
  ];
  
  const [selectedSkin, setSelectedSkin] = useState('classic');
  
  const avatars = ['😎', '🎮', '🏆', '🔥', '💫', '👾', '🤖', '👊', '💪', '🎯', '🎲', '👑', '💎', '⚡', '🃏', '🌟'];

  // Load user
  useEffect(() => {
    setTimeout(() => {
      const saved = localStorage.getItem('domino_user');
      if (saved) {
        const user = JSON.parse(saved);
        setCurrentUser(user);
        setSelectedSkin(user.selectedRackSkin || 'classic');
      }
      setView('login');
    }, 1500);
  }, []);

  // Load all users
  useEffect(() => {
    const users = JSON.parse(localStorage.getItem('domino_users') || '[]');
    setAllUsers(users.map((u: any) => ({
      id: u.id,
      username: u.username,
      avatar: u.avatar || '😎',
      diamonds: u.diamonds || 0,
      selectedRackSkin: u.selectedRackSkin || 'classic',
      ownedSkins: u.ownedSkins || ['classic'],
      stats: u.stats || { wins: 0, losses: 0, games: 0, streak: 0 }
    })));
  }, []);

  // Tournament timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const diff = end.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTournamentTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auth functions
  const handleLogin = () => {
    if (!loginUser.trim() || !loginPass.trim()) {
      setAuthError('فیڵدەکان پێویستن');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('domino_users') || '[]');
      const user = users.find((u: any) => u.username === loginUser && u.password === loginPass);
      if (user) {
        const safeUser: UserData = {
          id: user.id, username: user.username, avatar: user.avatar || '😎',
          diamonds: user.diamonds ?? 500, selectedRackSkin: user.selectedRackSkin || 'classic',
          ownedSkins: user.ownedSkins || ['classic'],
          stats: user.stats || { wins: 0, losses: 0, games: 0, streak: 0 }
        };
        setCurrentUser(safeUser);
        localStorage.setItem('domino_user', JSON.stringify(safeUser));
        setView('menu');
      } else {
        setAuthError('ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە');
      }
      setLoading(false);
    }, 800);
  };

  const handleRegister = () => {
    if (!regUser.trim() || !regPass.trim()) {
      setAuthError('فیڵدەکان پێویستن');
      return;
    }
    if (regPass !== regConfirm) {
      setAuthError('وشەی نهێنی یەک نینن');
      return;
    }
    if (regUser.length < 3) {
      setAuthError('ناو دەبێت ٣ پیت بێت');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('domino_users') || '[]');
      if (users.find((u: any) => u.username === regUser)) {
        setAuthError('ئەم ناوە پێشتر هەیە');
        setLoading(false);
        return;
      }
      const newUser = {
        id: Date.now().toString(), username: regUser, password: regPass,
        avatar: selectedAvatar, diamonds: 500, selectedRackSkin: 'classic',
        ownedSkins: ['classic'], stats: { wins: 0, losses: 0, games: 0, streak: 0 },
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      localStorage.setItem('domino_users', JSON.stringify(users));
      const safeUser: UserData = { ...newUser };
      delete (safeUser as any).password;
      setCurrentUser(safeUser);
      localStorage.setItem('domino_user', JSON.stringify(safeUser));
      setView('menu');
      setLoading(false);
    }, 800);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('domino_user');
    setView('login');
    setLoginUser('');
    setLoginPass('');
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

  const startGame = (mode: string) => {
    const deck = createDeck();
    setGameMode(mode);
    setPlayerHand(deck.slice(0, 7));
    setOpponentHand(deck.slice(7, 14));
    setDrawPileCount(14);
    setBoard([]);
    setCurrentTurn('player');
    setGameOver(false);
    setWinner(null);
    setMessages([]);
    setScore(0);
    setTimer(15);
    setView('game');
    addSystemMessage('🎮 یاریەکە دەستی پێکرد! نۆبتی تۆیە!');
  };

  const canPlayTile = (tile: Tile): { left: boolean; right: boolean } => {
    if (board.length === 0) return { left: true, right: true };
    const first = board[0];
    const last = board[board.length - 1];
    return {
      left: tile[0] === first[0] || tile[1] === first[0],
      right: tile[0] === last[1] || tile[1] === last[1]
    };
  };

  const playTile = (tile: Tile, index: number, side: 'left' | 'right') => {
    if (currentTurn !== 'player' || gameOver) return;
    const canPlay = canPlayTile(tile);
    if (side === 'left' && !canPlay.left) return;
    if (side === 'right' && !canPlay.right) return;
    
    setBoard(prev => {
      if (prev.length === 0) return [tile];
      if (side === 'left') return [tile, ...prev];
      return [...prev, tile];
    });
    
    setPlayerHand(prev => prev.filter((_, i) => i !== index));
    
    if (playerHand.length === 1) {
      handleWin();
      return;
    }
    
    setCurrentTurn('opponent');
    setTimeout(() => botPlay(), 1200);
  };

  const handleWin = () => {
    setGameOver(true);
    setWinner('player');
    
    const reward = 100;
    const streakBonus = Math.min((currentUser?.stats.streak || 0) * 10, 100);
    const totalReward = reward + streakBonus;
    
    if (currentUser) {
      const updated: UserData = {
        ...currentUser,
        diamonds: currentUser.diamonds + totalReward,
        stats: {
          wins: currentUser.stats.wins + 1,
          losses: currentUser.stats.losses,
          games: currentUser.stats.games + 1,
          streak: currentUser.stats.streak + 1
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
      
      addSystemMessage(`🏆 بریار! +${totalReward} 💎 (Streak: ${currentUser.stats.streak + 1}x)`);
    }
  };

  const handleLose = () => {
    setGameOver(true);
    setWinner('opponent');
    
    if (currentUser) {
      const updated: UserData = {
        ...currentUser,
        stats: {
          wins: currentUser.stats.wins,
          losses: currentUser.stats.losses + 1,
          games: currentUser.stats.games + 1,
          streak: 0
        }
      };
      setCurrentUser(updated);
      localStorage.setItem('domino_user', JSON.stringify(updated));
    }
    
    triggerLoseAnimation();
  };

  const botPlay = () => {
    if (gameOver || currentTurn !== 'opponent') return;
    
    let moves: Array<{tile: Tile, index: number, side: 'left' | 'right'}> = [];
    
    opponentHand.forEach((tile, index) => {
      const canPlay = canPlayTile(tile);
      if (canPlay.left) moves.push({ tile, index, side: 'left' });
      if (canPlay.right) moves.push({ tile, index, side: 'right' });
    });
    
    if (moves.length === 0) {
      handleWin();
      return;
    }
    
    // Prefer doubles, then high numbers
    const doubles = moves.filter(m => m.tile[0] === m.tile[1]);
    const move = doubles.length > 0 ? doubles[0] : moves[0];
    
    setBoard(prev => {
      if (prev.length === 0) return [move.tile];
      if (move.side === 'left') return [move.tile, ...prev];
      return [...prev, move.tile];
    });
    
    const newBotHand = opponentHand.filter((_, i) => i !== move.index);
    setOpponentHand(newBotHand);
    setDrawPileCount(prev => Math.max(0, prev - 1));
    
    if (newBotHand.length === 0) {
      handleLose();
      return;
    }
    
    setCurrentTurn('player');
    setTimer(15);
  };

  const triggerLoseAnimation = () => {
    // Will trigger laugh animation
  };

  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, {
      sender: 'سیستەم',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const sendChat = (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, {
      sender: currentUser?.username || 'میوان',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setCurrentMsg('');
  };

  const buySkin = (skin: RackSkin) => {
    if (!currentUser) return;
    if (skin.owned || currentUser.ownedSkins.includes(skin.id)) {
      setSelectedSkin(skin.id);
      const updated = { ...currentUser, selectedRackSkin: skin.id };
      setCurrentUser(updated);
      localStorage.setItem('domino_user', JSON.stringify(updated));
    } else if (currentUser.diamonds >= skin.price) {
      const updated = {
        ...currentUser,
        diamonds: currentUser.diamonds - skin.price,
        ownedSkins: [...currentUser.ownedSkins, skin.id],
        selectedRackSkin: skin.id
      };
      setCurrentUser(updated);
      setSelectedSkin(skin.id);
      localStorage.setItem('domino_user', JSON.stringify(updated));
      
      const users = JSON.parse(localStorage.getItem('domino_users') || '[]');
      const idx = users.findIndex((u: any) => u.id === currentUser.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updated };
        localStorage.setItem('domino_users', JSON.stringify(users));
      }
    }
  };

  const getWinRate = (user: UserData) => {
    if (!user.stats.games) return 0;
    return Math.round((user.stats.wins / user.stats.games) * 100);
  };

  const getRank = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  // ==================== TILE WITH NUMBERS (like photo 1) ====================
  const DominoTile = ({ 
    tile, onClick, size = 'normal', disabled = false 
  }: { 
    tile: Tile; onClick?: () => void; size?: 'small' | 'normal' | 'large'; disabled?: boolean;
  }) => {
    const getTileColor = (n: number): string => {
      const colors = ['text-black', 'text-orange-500', 'text-blue-600', 'text-black', 'text-orange-500', 'text-blue-600', 'text-black'];
      return colors[n] || 'text-black';
    };
    
    const sizes = {
      small: { w: 'w-8', h: 'h-14', num: 'text-sm' },
      normal: { w: 'w-12', h: 'h-20', num: 'text-xl' },
      large: { w: 'w-16', h: 'h-28', num: 'text-2xl' }
    };
    
    const s = sizes[size];
    
    return (
      <div
        onClick={disabled ? undefined : onClick}
        className={`${s.w} ${s.h} bg-white rounded-lg border-2 border-gray-300 shadow-lg flex flex-col ${
          onClick && !disabled ? 'cursor-pointer hover:scale-105 active:scale-95 hover:shadow-xl' : ''
        } ${disabled ? 'opacity-40' : ''} transition-all`}
      >
        <div className={`flex-1 flex items-center justify-center border-b border-gray-300 ${s.num} font-black ${getTileColor(tile[0])}`}>
          {tile[0]}
        </div>
        <div className={`flex-1 flex items-center justify-center ${s.num} font-black ${getTileColor(tile[1])}`}>
          {tile[1]}
        </div>
      </div>
    );
  };

  // ==================== LOADING ====================
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 to-amber-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-4 animate-bounce">🎲</div>
          <h1 className="text-4xl font-black text-amber-500">DOMINO</h1>
          <p className="text-amber-300 mt-2">Kurdistan Edition</p>
        </div>
      </div>
    );
  }

  // ==================== LOGIN ====================
  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
      }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">🎲</div>
            <h1 className="text-5xl font-black text-amber-500 italic">DOMINO</h1>
            <p className="text-white/60 mt-2">Kurdistan Edition 🇨🇺</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <div className="flex mb-6 bg-black/30 rounded-xl p-1">
              <button onClick={() => { setIsRegister(false); setAuthError(''); }}
                className={`flex-1 py-2 rounded-lg font-bold text-sm ${!isRegister ? 'bg-amber-500 text-black' : 'text-white'}`}>
                Login
              </button>
              <button onClick={() => { setIsRegister(true); setAuthError(''); }}
                className={`flex-1 py-2 rounded-lg font-bold text-sm ${isRegister ? 'bg-amber-500 text-black' : 'text-white'}`}>
                Register
              </button>
            </div>
            
            {authError && (
              <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-xl mb-4 text-sm">
                ⚠️ {authError}
              </div>
            )}
            
            {isRegister ? (
              <div className="space-y-4">
                <div>
                  <label className="text-white/70 text-sm mb-1 block">Avatar</label>
                  <div className="grid grid-cols-8 gap-1">
                    {avatars.slice(0, 8).map(a => (
                      <button key={a} onClick={() => setSelectedAvatar(a)}
                        className={`text-2xl p-1 rounded ${selectedAvatar === a ? 'bg-amber-500' : 'hover:bg-white/10'}`}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="text" value={regUser} onChange={e => setRegUser(e.target.value)}
                  className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40"
                  placeholder="ناوی بەکارهێنەر" />
                <input type="password" value={regPass} onChange={e => setRegPass(e.target.value)}
                  className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40"
                  placeholder="وشەی نهێنی" />
                <input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                  className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40"
                  placeholder="دووبارە وشەی نهێنی"
                  onKeyPress={e => e.key === 'Enter' && handleRegister()} />
                <button onClick={handleRegister} disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 rounded-xl disabled:opacity-50">
                  {loading ? '⏳ ...' : '📝 Register'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)}
                  className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40"
                  placeholder="ناوی بەکارهێنەر" />
                <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                  className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40"
                  placeholder="وشەی نهێنی"
                  onKeyPress={e => e.key === 'Enter' && handleLogin()} />
                <button onClick={handleLogin} disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 rounded-xl disabled:opacity-50">
                  {loading ? '⏳ ...' : '🎮 Login'}
                </button>
              </div>
            )}
            
            <p className="text-white/40 text-xs text-center mt-4">Test: test / test</p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN MENU (PHOTO 2) ====================
  if (view === 'menu') {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Background - scattered dominoes like photo 2 */}
        <div className="absolute inset-0" style={{
          background: `linear-gradient(135deg, #2d1810 0%, #3d2415 30%, #4a2a18 60%, #2d1810 100%)`
        }} />
        
        {/* Domino pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute text-4xl text-white/20" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              transform: `rotate(${Math.random() * 360}deg)`
            }}>🎲</div>
          ))}
        </div>
        
        <div className="relative z-10 min-h-screen p-6">
          {/* Top Bar */}
          <div className="flex justify-between items-center mb-8">
            {/* Profile */}
            {currentUser && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/30 flex items-center justify-center text-3xl border-2 border-amber-500">
                  {currentUser.avatar}
                </div>
                <div>
                  <div className="text-white font-bold">{currentUser.username}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-purple-500/30 px-2 py-0.5 rounded-full">
                      <span>💎</span>
                      <span className="text-purple-300 font-bold text-sm">{currentUser.diamonds}</span>
                    </div>
                    {currentUser.stats.streak > 0 && (
                      <div className="bg-orange-500/30 px-2 py-0.5 rounded-full text-orange-300 text-sm">
                        🔥{currentUser.stats.streak}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Diamonds */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-purple-600/50 backdrop-blur-sm px-4 py-2 rounded-2xl border border-purple-400/30">
                <span className="text-2xl">💎</span>
                <span className="text-white font-bold text-xl">{currentUser?.diamonds || 0}</span>
                <button className="w-6 h-6 bg-purple-400 rounded-full text-white font-bold text-sm">+</button>
              </div>
            </div>
          </div>
          
          {/* Logo */}
          <div className="text-center mb-6">
            <h1 className="text-5xl font-black text-white italic" style={{
              textShadow: '3px 3px 0 #c2410c, -1px -1px 0 #fbbf24'
            }}>DOMINO</h1>
          </div>
          
          {/* Tabs */}
          <div className="flex justify-center mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-1 flex gap-1">
              {['PLAY', 'CHAMPIONS', 'STORE'].map(tab => (
                <button key={tab} onClick={() => {
                  setMenuTab(tab as any);
                  if (tab === 'CHAMPIONS') setView('champions');
                  if (tab === 'STORE') setView('store');
                }}
                  className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${
                    menuTab === tab ? 'bg-amber-500 text-black' : 'text-white hover:bg-white/10'
                  }`}>
                  {tab === 'PLAY' && '🎮 PLAY'}
                  {tab === 'CHAMPIONS' && '👑 CHAMPIONS'}
                  {tab === 'STORE' && '🏪 STORE'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Game Modes - 4 cards like photo 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto mb-8">
            {/* Quick Play - Red */}
            <div onClick={() => startGame('quick')}
              className="bg-gradient-to-b from-red-600/80 to-red-900/90 rounded-3xl p-6 border border-red-400/20 cursor-pointer hover:scale-105 transition-all group">
              <div className="w-20 h-20 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center group-hover:bg-red-500/40 transition-all">
                <div className="text-5xl text-red-400">▶</div>
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-1">QUICK PLAY</h3>
              <p className="text-white/50 text-xs text-center mb-4">کلاسیک یاری، دەستبەجێ</p>
              <button className="w-full bg-red-800 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-sm">
                PLAY
              </button>
            </div>
            
            {/* Ranked - Gold */}
            <div onClick={() => startGame('ranked')}
              className="bg-gradient-to-b from-amber-600/80 to-amber-900/90 rounded-3xl p-6 border border-amber-400/20 cursor-pointer hover:scale-105 transition-all group">
              <div className="w-20 h-20 mx-auto mb-4 bg-amber-500/20 rounded-full flex items-center justify-center group-hover:bg-amber-500/40 transition-all">
                <div className="text-5xl">👑</div>
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-1">RANKED</h3>
              <p className="text-white/50 text-xs text-center mb-4">پێشبڕکێ بۆ ئاستی جهانی</p>
              <button className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-sm">
                PLAY
              </button>
            </div>
            
            {/* Turbo - Orange */}
            <div onClick={() => startGame('turbo')}
              className="bg-gradient-to-b from-orange-600/80 to-orange-900/90 rounded-3xl p-6 border border-orange-400/20 cursor-pointer hover:scale-105 transition-all group">
              <div className="w-20 h-20 mx-auto mb-4 bg-orange-500/20 rounded-full flex items-center justify-center group-hover:bg-orange-500/40 transition-all">
                <div className="text-5xl">⚡</div>
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-1">TURBO</h3>
              <p className="text-white/50 text-xs text-center mb-4">یاری خێرا کۆنترۆل</p>
              <button className="w-full bg-orange-700 hover:bg-orange-600 text-white font-bold py-2 rounded-xl text-sm">
                PLAY
              </button>
            </div>
            
            {/* Tournament - Purple */}
            <div onClick={() => setView('tournament')}
              className="bg-gradient-to-b from-purple-600/80 to-purple-900/90 rounded-3xl p-6 border border-purple-400/20 cursor-pointer hover:scale-105 transition-all group">
              <div className="w-20 h-20 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center group-hover:bg-purple-500/40 transition-all">
                <div className="text-5xl">🏆</div>
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-1">TOURNAMENT</h3>
              <p className="text-white/50 text-xs text-center mb-4">بە قەزا بۆ جایزە</p>
              <button className="w-full bg-purple-700 hover:bg-purple-600 text-white font-bold py-2 rounded-xl text-sm">
                PLAY
              </button>
            </div>
          </div>
          
          {/* Bottom Bar - INVITE button like photo 2 */}
          <div className="fixed bottom-6 left-6 right-6 flex justify-between items-center">
            <button onClick={() => setView('champions')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-bold text-sm">
              📊 ئاست
            </button>
            
            <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
              <span className="text-xl">👤+</span>
              INVITE
            </button>
            
            <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white w-10 h-10 rounded-xl flex items-center justify-center">
              ⚙️
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== TOURNAMENT (PHOTO 3) ====================
  if (view === 'tournament') {
    const sortedUsers = [...allUsers].sort((a, b) => b.stats.wins - a.stats.wins).slice(0, 10);
    
    return (
      <div className="min-h-screen relative" style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)'
      }}>
        <div className="relative z-10 min-h-screen p-4 md:p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setView('menu')}
                className="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-xl flex items-center justify-center">
                ←
              </button>
              <h1 className="text-2xl font-black text-amber-500 flex items-center gap-2">
                🏆 TOURNAMENT
              </h1>
              <div className="flex items-center gap-2">
                <div className="bg-amber-500/20 text-amber-400 px-4 py-2 rounded-xl font-mono text-lg font-bold">
                  ⏰ {tournamentTime}
                </div>
                <button className="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-xl flex items-center justify-center">
                  🔄
                </button>
              </div>
            </div>
            
            {/* Tournament Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10">
              {/* Tournament Header */}
              <div className="bg-gradient-to-r from-amber-600/30 to-amber-800/30 p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-amber-500 text-black px-3 py-1 rounded-lg text-xs font-bold">SOON</span>
                      <span className="text-white text-3xl font-black">KURDISH CUP</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg">
                        <span className="text-white/60 text-sm">👥</span>
                        <span className="text-white font-bold">{allUsers.length}/1000</span>
                      </div>
                      <div className="flex items-center gap-1 bg-green-500/20 px-3 py-1 rounded-lg">
                        <span className="text-green-400 font-bold">FREE</span>
                      </div>
                      <div className="text-green-500 text-2xl">✓</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6 p-6">
                {/* Prizes */}
                <div>
                  <h3 className="text-amber-400 font-bold mb-4 flex items-center gap-2 text-lg">
                    🏆 PRIZES
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-gradient-to-r from-yellow-500/20 to-transparent p-4 rounded-xl border border-yellow-500/30">
                      <span className="text-yellow-400 font-bold text-lg">🥇 1ST</span>
                      <span className="text-white font-bold text-xl">100k 💎</span>
                    </div>
                    <div className="flex justify-between items-center bg-gradient-to-r from-gray-400/20 to-transparent p-4 rounded-xl border border-gray-400/30">
                      <span className="text-gray-300 font-bold text-lg">🥈 2ND</span>
                      <span className="text-white font-bold text-xl">50k 💎</span>
                    </div>
                    <div className="flex justify-between items-center bg-gradient-to-r from-orange-500/20 to-transparent p-4 rounded-xl border border-orange-500/30">
                      <span className="text-orange-400 font-bold text-lg">🥉 3RD</span>
                      <span className="text-white font-bold text-xl">10k 💎</span>
                    </div>
                  </div>
                </div>
                
                {/* Rules */}
                <div>
                  <h3 className="text-blue-400 font-bold mb-4 flex items-center gap-2 text-lg">
                    📋 RULES
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                      <span className="text-white/60">MODE</span>
                      <span className="text-white font-bold">Ranked</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                      <span className="text-white/60">TEAM</span>
                      <span className="text-white font-bold">1v1</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                      <span className="text-white/60">ENTRY</span>
                      <span className="text-green-400 font-bold">Free</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                      <span className="text-white/60">TIMER</span>
                      <span className="text-white font-bold">15s</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Players List */}
              <div className="px-6 pb-6">
                <h3 className="text-purple-400 font-bold mb-4 flex items-center gap-2 text-lg">
                  👥 PLAYERS ({allUsers.length})
                </h3>
                <div className="bg-white/5 rounded-xl p-4 max-h-48 overflow-y-auto">
                  {sortedUsers.length === 0 ? (
                    <p className="text-white/40 text-center">هیچ یاریزانێک نەدۆزرایەوە</p>
                  ) : (
                    <div className="space-y-2">
                      {sortedUsers.map((user, idx) => (
                        <div key={user.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-2">
                          <span className="text-white/60 w-6 font-bold">{getRank(idx)}</span>
                          <span className="text-2xl">{user.avatar}</span>
                          <span className="text-white flex-1 font-medium">{user.username}</span>
                          <span className="text-amber-400 text-sm font-bold">🏆 {user.stats.wins}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Join Button */}
              <div className="p-6 pt-0">
                <button 
                  onClick={() => startGame('tournament')}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 rounded-xl text-xl transition-all shadow-lg">
                  🎮 JOIN TOURNAMENT
                </button>
              </div>
            </div>
            
            {/* Leave Button */}
            <button
              onClick={() => setView('menu')}
              className="w-full mt-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-3 rounded-xl border border-red-500/30"
            >
              ↩ LEAVE TOURNAMENT
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== STORE (PHOTO 4) ====================
  if (view === 'store') {
    return (
      <div className="min-h-screen relative" style={{
        background: 'linear-gradient(135deg, #2d1810 0%, #3d2415 50%, #2d1810 100%)'
      }}>
        {/* Background dominoes */}
        <div className="absolute inset-0 opacity-5">
          {[...Array(30)].map((_, i) => (
            <div key={i} className="absolute text-6xl text-white/10" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              transform: `rotate(${Math.random() * 360}deg)`
            }}>🎲</div>
          ))}
        </div>
        
        <div className="relative z-10 min-h-screen p-4 md:p-6">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setView('menu')}
                className="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-xl flex items-center justify-center">
                ←
              </button>
              <h1 className="text-2xl font-black text-white">STORE</h1>
              <div className="flex items-center gap-2 bg-purple-600/50 backdrop-blur-sm px-4 py-2 rounded-2xl border border-purple-400/30">
                <span className="text-2xl">💎</span>
                <span className="text-white font-bold text-xl">{currentUser?.diamonds || 0}</span>
                <button className="w-6 h-6 bg-purple-400 rounded-full text-white font-bold text-sm">+</button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex justify-center mb-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-1 flex gap-1">
                <button onClick={() => setStoreTab('SKINS')}
                  className={`px-12 py-3 rounded-xl font-bold transition-all ${
                    storeTab === 'SKINS' ? 'bg-amber-500 text-black' : 'text-white hover:bg-white/10'
                  }`}>
                  SKINS
                </button>
                <button onClick={() => setStoreTab('GEMS')}
                  className={`px-12 py-3 rounded-xl font-bold transition-all ${
                    storeTab === 'GEMS' ? 'bg-amber-500 text-black' : 'text-white hover:bg-white/10'
                  }`}>
                  GEMS
                </button>
              </div>
            </div>
            
            {storeTab === 'SKINS' && (
              <>
                {/* Daily Items */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-white font-bold text-lg">DAILY ITEMS</span>
                  <span className="bg-amber-500/30 text-amber-300 px-3 py-1 rounded-lg text-sm font-bold">
                    REFRESHES IN 12H
                  </span>
                </div>
                
                {/* Skins Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {rackSkins.map((skin) => {
                    const owned = currentUser?.ownedSkins.includes(skin.id) || skin.owned;
                    const equipped = selectedSkin === skin.id;
                    const canBuy = currentUser && currentUser.diamonds >= skin.price;
                    
                    return (
                      <div key={skin.id} 
                        className={`bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 ${
                          equipped ? 'border-green-500' : 'border-white/20'
                        }`}>
                        {/* Skin Preview - Like photo 4 */}
                        <div className={`h-40 flex items-center justify-center relative overflow-hidden ${skin.bg}`}>
                          {/* Rack preview */}
                          <div className={`w-48 h-16 ${skin.bg} ${skin.border} border-4 rounded-lg flex items-center justify-center`}>
                            <div className="flex gap-1">
                              {[1, 2, 3].map(n => (
                                <div key={n} className="w-8 h-14 bg-white rounded border border-gray-400 flex flex-col">
                                  <div className="flex-1 flex items-center justify-center border-b border-gray-300 text-xs font-bold">
                                    {n}
                                  </div>
                                  <div className="flex-1 flex items-center justify-center text-xs font-bold">
                                    {n}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {equipped && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                              EQUIPPED
                            </div>
                          )}
                          {!owned && (
                            <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                              💎 {skin.price}
                            </div>
                          )}
                        </div>
                        
                        {/* Info */}
                        <div className="p-4">
                          <h3 className="text-xl font-bold text-white mb-1">{skin.name}</h3>
                          <p className="text-white/50 text-sm mb-4">Rack Skin</p>
                          
                          {owned ? (
                            <button
                              onClick={() => buySkin(skin)}
                              className={`w-full font-bold py-3 rounded-xl transition-all ${
                                equipped 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}>
                              {equipped ? '✅ EQUIPPED' : '🎯 Equip'}
                            </button>
                          ) : (
                            <button
                              onClick={() => buySkin(skin)}
                              disabled={!canBuy}
                              className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                                canBuy 
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              }`}>
                              <span>💎</span>
                              <span>{skin.price}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            
            {storeTab === 'GEMS' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-b from-blue-600/20 to-blue-900/30 backdrop-blur-sm rounded-2xl p-6 border border-blue-400/20">
                  <div className="text-6xl text-center mb-4">💎</div>
                  <h3 className="text-xl font-bold text-white text-center mb-2">کۆمپلیمینت</h3>
                  <p className="text-white/50 text-sm text-center mb-2">100 Diamond</p>
                  <div className="text-3xl font-bold text-blue-400 text-center mb-4">$3.99</div>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">
                    Buy
                  </button>
                </div>
                
                <div className="bg-gradient-to-b from-purple-600/20 to-purple-900/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-400/20 relative">
                  <div className="absolute -top-2 -right-2 bg-amber-500 text-black text-xs px-2 py-1 rounded-full font-bold">
                    مەعروف!
                  </div>
                  <div className="text-6xl text-center mb-4">💎💎💎</div>
                  <h3 className="text-xl font-bold text-white text-center mb-2">پاشەکەوت</h3>
                  <p className="text-white/50 text-sm text-center mb-2">500 Diamond</p>
                  <div className="text-3xl font-bold text-purple-400 text-center mb-4">$9.99</div>
                  <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl">
                    Buy
                  </button>
                </div>
                
                <div className="bg-gradient-to-b from-amber-600/20 to-amber-900/30 backdrop-blur-sm rounded-2xl p-6 border border-amber-400/20">
                  <div className="text-6xl text-center mb-4">💎👑💎</div>
                  <h3 className="text-xl font-bold text-white text-center mb-2">خۆشاوێک</h3>
                  <p className="text-white/50 text-sm text-center mb-2">1500 Diamond</p>
                  <div className="text-3xl font-bold text-amber-400 text-center mb-4">$24.99</div>
                  <button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl">
                    Buy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== CHAMPIONS ====================
  if (view === 'champions') {
    const sorted = [...allUsers].sort((a, b) => b.stats.wins - a.stats.wins);
    
    return (
      <div className="min-h-screen relative" style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
      }}>
        <div className="relative z-10 min-h-screen p-4 md:p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setView('menu')}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold">
                ← Back
              </button>
              <h1 className="text-2xl font-black text-white">👑 CHAMPIONS</h1>
              <div className="bg-purple-600/50 px-3 py-2 rounded-xl">
                <span className="text-white font-bold">💎 {currentUser?.diamonds || 0}</span>
              </div>
            </div>
            
            {/* Top 3 Podium */}
            {sorted.length >= 3 && (
              <div className="flex justify-center items-end gap-4 mb-8">
                <div className="text-center">
                  <div className="text-4xl mb-2">{sorted[1].avatar}</div>
                  <div className="bg-gray-200 rounded-lg p-3 w-32">
                    <div className="font-bold text-sm truncate">{sorted[1].username}</div>
                    <div className="text-xs text-gray-600">🥈 {sorted[1].stats.wins}W</div>
                  </div>
                  <div className="h-16 bg-gray-400 rounded-t-lg mt-1"></div>
                </div>
                
                <div className="text-center">
                  <div className="text-5xl mb-2">{sorted[0].avatar}</div>
                  <div className="bg-yellow-100 rounded-lg p-4 w-36 border-2 border-yellow-400">
                    <div className="font-bold">{sorted[0].username}</div>
                    <div className="text-sm text-yellow-700">🥇 {sorted[0].stats.wins}W</div>
                  </div>
                  <div className="h-24 bg-yellow-500 rounded-t-lg mt-1"></div>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl mb-2">{sorted[2].avatar}</div>
                  <div className="bg-orange-100 rounded-lg p-3 w-32">
                    <div className="font-bold text-sm truncate">{sorted[2].username}</div>
                    <div className="text-xs text-gray-600">🥉 {sorted[2].stats.wins}W</div>
                  </div>
                  <div className="h-12 bg-orange-400 rounded-t-lg mt-1"></div>
                </div>
              </div>
            )}
            
            {/* Leaderboard */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
              {sorted.map((user, idx) => (
                <div key={user.id} className={`flex items-center gap-4 p-4 border-b border-white/10 ${
                  currentUser?.id === user.id ? 'bg-amber-500/20' : 'hover:bg-white/5'
                }`}>
                  <div className="w-8 text-center font-bold text-white text-lg">{getRank(idx)}</div>
                  <div className="text-3xl">{user.avatar}</div>
                  <div className="flex-1">
                    <div className="font-bold text-white">{user.username}</div>
                    <div className="text-white/60 text-sm">
                      🏆 {user.stats.wins} • 💔 {user.stats.losses} • 💎 {user.diamonds}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-400 font-bold">{getWinRate(user)}%</div>
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

  // ==================== GAME (PHOTO 1) ====================
  const currentSkin = rackSkins.find(s => s.id === selectedSkin) || rackSkins[0];
  
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Laugh overlay */}
      {gameOver && winner === 'opponent' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-center animate-bounce">
            <div className="text-[150px]">😂</div>
            <div className="text-4xl font-black text-white animate-pulse">ژاڕی بوویییی!</div>
            <div className="text-2xl text-yellow-400 mt-2">تۆ شکست خۆڕیییی! 🤣</div>
            <button onClick={() => startGame(gameMode)}
              className="mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl text-xl">
              🔄 یاری نوێ
            </button>
          </div>
        </div>
      )}
      
      {/* Win overlay */}
      {gameOver && winner === 'player' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-center animate-bounce">
            <div className="text-[150px]">🏆</div>
            <div className="text-4xl font-black text-green-400 animate-pulse">بریار!</div>
            <div className="text-2xl text-yellow-400 mt-2">💎 +100</div>
            <button onClick={() => startGame(gameMode)}
              className="mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl text-xl">
              🔄 یاری نوێ
            </button>
          </div>
        </div>
      )}
      
      {/* Green felt table */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse at 30% 30%, #3d6b45 0%, transparent 50%),
          radial-gradient(ellipse at 70% 70%, #2d5a27 0%, transparent 50%),
          linear-gradient(180deg, #1a4d1f 0%, #0f3d14 100%)
        `
      }}>
        {/* Felt texture */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px),
            repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)
          `
        }} />
      </div>
      
      {/* Table frame */}
      <div className="absolute inset-2 md:inset-4 border-8 md:border-12 border-amber-900 rounded-2xl md:rounded-3xl shadow-2xl" />
      <div className="absolute inset-4 md:inset-6 border-4 border-amber-800 rounded-xl md:rounded-2xl" />
      
      {/* Kurdistan stripe */}
      <div className="absolute bottom-4 md:bottom-6 left-8 md:left-12 right-8 md:right-12 h-2 md:h-3 flex rounded overflow-hidden z-20">
        <div className="flex-1" style={{ background: '#ED1C24' }} />
        <div className="flex-1 bg-white" />
        <div className="flex-1" style={{ background: '#278E43' }} />
      </div>
      
      <div className="relative z-10 min-h-screen flex flex-col p-2 md:p-4">
        {/* Top Left - Round Counter (photo 1) */}
        <div className="absolute top-4 md:top-8 left-4 md:left-8 flex items-center gap-2 z-20">
          <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-2 flex items-center gap-2 border border-white/10">
            <button className="text-white/70 hover:text-white text-lg">🔄</button>
            <span className="text-white font-bold text-lg">{round}/3</span>
            <span className="text-white/50">=</span>
            <span className="text-amber-400 font-bold text-lg">{score}</span>
          </div>
        </div>
        
        {/* Top Right - Menu & Chat (photo 1) */}
        <div className="absolute top-4 md:top-8 right-4 md:right-8 flex items-center gap-2 z-20">
          <button onClick={() => setShowChat(!showChat)}
            className="bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center border border-white/10">
            💬
          </button>
          <button onClick={() => setShowMenu(!showMenu)}
            className="bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center border border-white/10">
            ☰
          </button>
        </div>
        
        {/* Opponent avatar (center top) */}
        <div className="flex justify-center mt-4 md:mt-8 z-20">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border-3 border-red-500 shadow-lg">
            <span className="text-2xl md:text-3xl">🤖</span>
          </div>
        </div>
        
        {/* Opponent rack (wooden) */}
        <div className={`flex justify-center mt-2 z-10`}>
          <div className={`${currentSkin.bg} ${currentSkin.border} border-4 rounded-xl p-2 shadow-2xl`}>
            <div className="flex gap-1">
              {opponentHand.map((_, i) => (
                <div key={i} className="w-8 h-14 md:w-10 md:h-16 bg-gradient-to-b from-white to-gray-200 rounded border border-gray-400 shadow-md" />
              ))}
            </div>
          </div>
        </div>
        
        {/* Draw pile (stapel) */}
        <div className="absolute right-16 md:right-24 top-1/2 -translate-y-1/2 z-20">
          <div className="relative">
            {[...Array(Math.min(drawPileCount, 5))].map((_, i) => (
              <div key={i} className="absolute w-12 h-20 md:w-14 md:h-24 bg-gradient-to-b from-white to-gray-200 rounded-lg border-2 border-gray-400 shadow-lg"
                style={{ top: -i * 2, left: -i * 2 }} />
            ))}
            <div className="w-12 h-20 md:w-14 md:h-24 flex items-center justify-center text-gray-500 font-bold text-sm relative z-10">
              {drawPileCount}
            </div>
          </div>
        </div>
        
        {/* Board (center) */}
        <div className="flex-1 flex items-center justify-center my-4">
          <div className="bg-black/10 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-8 min-h-[120px] md:min-h-[180px] flex items-center justify-center max-w-3xl w-full border border-white/5">
            {board.length === 0 ? (
              <div className="text-white/80 text-center">
                <div className="text-4xl md:text-6xl mb-2">🎯</div>
                <p className="font-bold text-lg md:text-xl">خشتەیەک هەڵببە</p>
                <p className="text-sm text-white/50 mt-1">کلیک لە خشتەیەک بکە بۆ دەستپێکردن</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 md:gap-3 overflow-x-auto">
                {board.map((tile, i) => (
                  <div key={i} className={`${
                    i === 0 ? 'border-l-4 border-l-green-500' : ''
                  } ${i === board.length - 1 ? 'border-r-4 border-r-green-500' : ''}`}>
                    <DominoTile tile={tile} size="normal" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Player rack (wooden) */}
        <div className={`${currentSkin.bg} rounded-t-2xl md:rounded-t-3xl p-3 md:p-4 border-t-4 ${currentSkin.border} shadow-2xl relative z-20`}>
          {/* Metallic edge */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-b from-gray-300 to-gray-500 rounded-t-2xl md:rounded-t-3xl" />
          
          <div className="flex justify-between items-center mb-3 mt-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-yellow-500 flex items-center justify-center text-lg md:text-xl border-2 border-yellow-600">
                {currentUser?.avatar || '😎'}
              </div>
              <div className="text-white">
                <div className="font-bold text-sm md:text-base">{currentUser?.username || 'میوان'}</div>
                <div className="text-white/60 text-xs">{playerHand.length} خشتە</div>
              </div>
            </div>
            
            {/* Turn indicator */}
            <div className={`px-3 py-1.5 rounded-xl font-bold text-sm ${
              currentTurn === 'player' ? 'bg-green-500 text-white animate-pulse' : 'bg-red-500/50 text-white/70'
            }`}>
              {currentTurn === 'player' ? '✅ نۆبتی تۆ' : '⏳ چاوەڕوانی...'}
            </div>
          </div>
          
          {/* Player tiles in rack */}
          <div className="flex justify-center gap-1 md:gap-2 flex-wrap">
            {playerHand.map((tile, i) => {
              const canPlay = canPlayTile(tile);
              const canPlayLeft = currentTurn === 'player' && !gameOver && canPlay.left;
              const canPlayRight = currentTurn === 'player' && !gameOver && canPlay.right;
              
              return (
                <div key={i} className="relative">
                  <DominoTile
                    tile={tile}
                    size={isMobile ? 'normal' : 'large'}
                    onClick={() => {
                      if (canPlayRight) playTile(tile, i, 'right');
                      else if (canPlayLeft) playTile(tile, i, 'left');
                    }}
                    disabled={!(canPlayLeft || canPlayRight)}
                  />
                  {/* Play buttons */}
                  {(canPlayLeft || canPlayRight) && (
                    <div className="flex justify-center gap-1 mt-1">
                      {canPlayLeft && (
                        <button onClick={(e) => { e.stopPropagation(); playTile(tile, i, 'left'); }}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-1.5 py-0.5 rounded font-bold animate-pulse">
                          ⬅️
                        </button>
                      )}
                      {canPlayRight && (
                        <button onClick={(e) => { e.stopPropagation(); playTile(tile, i, 'right'); }}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-1.5 py-0.5 rounded font-bold animate-pulse">
                          ➡️
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Bottom buttons */}
          <div className="flex justify-between items-center mt-3">
            <button onClick={() => setView('menu')}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-bold">
              ↩ گەڕانەوە
            </button>
            <button onClick={() => startGame(gameMode)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold">
              🔄 نوێ
            </button>
          </div>
        </div>
        
        {/* Chat panel */}
        {showChat && (
          <div className="fixed right-4 top-20 bottom-28 w-72 bg-black/80 backdrop-blur-sm rounded-2xl p-4 flex flex-col z-30 border border-white/10">
            <div className="flex justify-between items-center mb-3">
              <span className="text-white font-bold">💬 چات</span>
              <button onClick={() => setShowChat(false)} className="text-white/60 hover:text-white">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {messages.map((msg, i) => (
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
              {['🔥', '👏', '😂', '👋', '🎯', '💪', '😎', '🏆'].map(e => (
                <button key={e} onClick={() => sendChat(e)} 
                  className="bg-white/10 hover:bg-white/20 p-1 rounded text-base">{e}</button>
              ))}
            </div>
            
            <div className="flex gap-1">
              <input
                value={currentMsg}
                onChange={e => setCurrentMsg(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendChat(currentMsg)}
                className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="پەیام..."
              />
              <button onClick={() => sendChat(currentMsg)}
                className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-white font-bold">
                ➤
              </button>
            </div>
          </div>
        )}
        
        {/* Game Menu */}
        {showMenu && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40">
            <div className="bg-white/95 rounded-2xl p-6 max-w-sm w-full mx-4">
              <h2 className="text-2xl font-bold mb-6 text-center">⚙️ مینیو</h2>
              <div className="space-y-3">
                <button onClick={() => { setView('menu'); setShowMenu(false); }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl">
                  🚪 چوونە دەرەوە
                </button>
                <button onClick={() => { startGame(gameMode); setShowMenu(false); }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl">
                  🔄 یاری نوێ
                </button>
                <button onClick={() => setShowMenu(false)}
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