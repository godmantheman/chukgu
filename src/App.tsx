import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle } from './lib/firebase';
import { GameMode, Difficulty, PlayerRole } from './types';
import Lobby from './components/Lobby';
import SoccerGame from './components/SoccerGame';
import { LogIn } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING'>('MENU');
  const [gameConfig, setGameConfig] = useState<{
    mode: GameMode;
    playerCount: number;
    difficulty: Difficulty;
    role: PlayerRole;
    roomId?: string;
  } | null>(null);
  
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    // Only connect if playing online
    if (gameState === 'PLAYING' && gameConfig?.mode === 'ONLINE' && user) {
      const newSocket = io();
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Connected to server');
        newSocket.emit('join_room', {
          roomId: gameConfig.roomId || 'lobby',
          name: user.displayName || `Player_${newSocket.id.substring(0, 4)}`,
          team: 'blue',
          roleType: gameConfig.role
        });
      });

      return () => {
        newSocket.disconnect();
        setSocket(null);
      };
    }
  }, [gameState, gameConfig, user]);

  const handleStart = (mode: GameMode, config: any) => {
    setGameConfig({ mode, ...config });
    setGameState('PLAYING');
  };

  const handleExit = () => {
    setGameState('MENU');
    setGameConfig(null);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-white/10 p-12 rounded-3xl text-center shadow-2xl">
          <h1 className="text-4xl font-black italic tracking-tighter mb-8 text-white">SOCCER <span className="text-emerald-500">PRO</span></h1>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all cursor-pointer"
          >
            <LogIn size={20} /> Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black">
      {gameState === 'MENU' ? (
        <Lobby onStart={handleStart} user={user} />
      ) : (
        gameConfig && (
          <SoccerGame
            mode={gameConfig.mode}
            playerCount={gameConfig.playerCount}
            difficulty={gameConfig.difficulty}
            role={gameConfig.role}
            roomId={gameConfig.roomId}
            socket={socket}
            onExit={handleExit}
          />
        )
      )}
    </div>
  );
}

