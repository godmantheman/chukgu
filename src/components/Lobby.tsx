import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Users, Globe, Play, Plus, Server, Settings2, Star, LogOut } from 'lucide-react';
import { GameMode, Difficulty, PlayerRole } from '../types';
import { User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';

interface Props {
  user: User;
  onStart: (mode: GameMode, config: { 
    playerCount: number; 
    difficulty: Difficulty; 
    role: PlayerRole;
    roomId?: string;
  }) => void;
}

export default function Lobby({ user, onStart }: Props) {
  const [mode, setMode] = useState<GameMode>('OFFLINE');
  const [playerCount, setPlayerCount] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [role, setRole] = useState<PlayerRole>('STRIKER');
  const [roomId, setRoomId] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'rooms'));
    return onSnapshot(q, (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const handleCreateRoom = async () => {
    if (!roomId.trim()) return alert('Please enter a room name');
    try {
      const roomData = {
        name: roomId,
        ownerId: user.uid,
        playerCount,
        difficulty,
        status: 'WAITING',
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'rooms', roomId), roomData);
      onStart('ONLINE', { playerCount, difficulty, role, roomId });
    } catch (e) {
      console.error(e);
    }
  };

  const handleJoinRoom = (r: any) => {
    onStart('ONLINE', { 
      playerCount: r.playerCount, 
      difficulty: r.difficulty as Difficulty, 
      role, 
      roomId: r.id 
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      {/* User Info */}
      <div className="absolute top-8 left-8 flex items-center gap-4 bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-3 rounded-2xl z-20">
        <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border border-white/10" />
        <div>
          <p className="text-sm font-bold">{user.displayName}</p>
          <button onClick={() => auth.signOut()} className="text-[10px] text-neutral-500 hover:text-rose-400 flex items-center gap-1">
            <LogOut size={10} /> SIGN OUT
          </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4 border border-emerald-500/20">
            <Trophy size={14} /> Ultimate Soccer
          </div>
          <h1 className="text-5xl font-black italic tracking-tighter mb-2 uppercase">SOCCER <span className="text-emerald-500">PRO</span></h1>
          <p className="text-neutral-400 font-medium text-sm tracking-wide">Next Generation 3D Multiplayer Game</p>
        </div>

        <div className="bg-neutral-900/50 backdrop-blur-2xl border border-neutral-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          {/* Mode Selection */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setMode('OFFLINE')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all border ${
                mode === 'OFFLINE' 
                  ? 'bg-white text-black border-white' 
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'
              }`}
            >
              <Server size={18} /> LOCAL
            </button>
            <button
              onClick={() => setMode('ONLINE')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all border ${
                mode === 'ONLINE' 
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'
              }`}
            >
              <Globe size={18} /> ONLINE
            </button>
          </div>

          <div className="space-y-5">
            {mode === 'ONLINE' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                    <Plus size={14} /> Create Room
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Room Name"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-all font-mono text-sm"
                    />
                    <button onClick={handleCreateRoom} className="bg-white text-black px-4 rounded-xl font-bold text-sm">CREATE</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                    <Globe size={14} /> Active Rooms
                  </label>
                  <div className="max-h-[160px] overflow-y-auto space-y-2 pr-2">
                    {rooms.length === 0 ? (
                      <p className="text-neutral-600 text-xs italic py-4 text-center">No active rooms found...</p>
                    ) : (
                      rooms.map(r => (
                        <button
                          key={r.id}
                          onClick={() => handleJoinRoom(r)}
                          className="w-full flex items-center justify-between bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700 p-3 rounded-xl transition-all"
                        >
                          <div className="text-left">
                            <p className="font-bold text-sm">{r.name}</p>
                            <p className="text-[10px] text-neutral-500 uppercase">{r.playerCount}vs{r.playerCount} • {r.difficulty}</p>
                          </div>
                          <Play size={16} className="text-emerald-500" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Common Settings */}
            {mode === 'OFFLINE' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                    <Users size={14} /> Team Size
                  </label>
                  <div className="flex items-center gap-4 bg-neutral-800 rounded-xl p-1 border border-neutral-700">
                    <button 
                      onClick={() => setPlayerCount(Math.max(1, playerCount - 1))}
                      className="w-10 h-10 flex items-center justify-center hover:bg-neutral-700 rounded-lg transition-all"
                    >-</button>
                    <span className="flex-1 text-center font-bold">{playerCount} vs {playerCount}</span>
                    <button 
                      onClick={() => setPlayerCount(Math.min(5, playerCount + 1))}
                      className="w-10 h-10 flex items-center justify-center hover:bg-neutral-700 rounded-lg transition-all"
                    >+</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                    <Settings2 size={14} /> AI Difficulty
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['EASY', 'NORMAL', 'HARD'] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                          difficulty === d 
                            ? 'bg-neutral-100 text-black border-white' 
                            : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Role */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2 text-center w-full justify-center">
                Select Your Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setRole('STRIKER')}
                  className={`py-4 rounded-2xl font-bold transition-all border flex flex-col items-center gap-2 ${
                    role === 'STRIKER' 
                      ? 'bg-emerald-500 text-black border-emerald-400' 
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  <Star size={20} /> STRIKER
                </button>
                <button
                  onClick={() => setRole('GK')}
                  className={`py-4 rounded-2xl font-bold transition-all border flex flex-col items-center gap-2 ${
                    role === 'GK' 
                      ? 'bg-rose-500 text-black border-rose-400' 
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  <Server size={20} /> KEEPER
                </button>
              </div>
            </div>

            {mode === 'OFFLINE' && (
              <button
                onClick={() => onStart(mode, { playerCount, difficulty, role })}
                className="w-full bg-white text-black hover:bg-neutral-200 py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all mt-4 group cursor-pointer"
              >
                <Play size={24} className="group-hover:translate-x-1 transition-transform" fill="black" />
                START GAME
              </button>
            )}
          </div>
        </div>
        
        <p className="text-center text-neutral-600 text-[10px] mt-10 uppercase tracking-widest font-bold">
          WASD MOVE • SPACE KICK • MULTIPLAYER POWERED BY FIREBASE
        </p>
      </motion.div>
    </div>
  );
}
