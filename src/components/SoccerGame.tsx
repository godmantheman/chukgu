import React, { useRef, useEffect, useState } from 'react';
import { useSoccerGame } from '../hooks/useSoccerGame';
import { GameMode, Difficulty, PlayerRole, RoomState } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Star, Settings } from 'lucide-react';

interface Props {
  mode: GameMode;
  playerCount: number;
  difficulty: Difficulty;
  role: PlayerRole;
  roomId?: string;
  socket?: any;
  onExit: () => void;
}

export default function SoccerGame({ mode, playerCount, difficulty, role, roomId, socket, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [isGameOver, setIsGameOver] = useState(false);

  const { startGame, resetGame, score, setScore, playersRef, ballRef, sceneRef, Player } = useSoccerGame(containerRef, mode, {
    playerCount,
    difficulty,
    role,
    isOnline: mode === 'ONLINE',
    socket,
    roomId,
    onGoal: (team) => {
      setMessage(`GOAL! ${team.toUpperCase()} SCORRED`);
      setTimeout(() => setMessage(''), 2000);
    },
    onScoreUpdate: (newScore) => {
      if (newScore.blue >= 5 || newScore.red >= 5) {
        setIsGameOver(true);
        setMessage(`${newScore.blue >= 5 ? 'BLUE' : 'RED'} WINS!`);
      }
    }
  });

  useEffect(() => {
    if (mode === 'OFFLINE') {
      startGame();
    } else {
      // In online mode, the server state might dictate the player list
      // For simplicity, we create our local player and then sync others
      startGame();
    }
  }, [mode, startGame]);

  // Online Listeners
  useEffect(() => {
    if (mode === 'ONLINE' && socket) {
      socket.on('player_updated', (data: any) => {
        const p = playersRef.current.find(player => player.remoteId === data.id);
        if (p) {
          p.mesh.position.copy(data.position);
          p.velocity.copy(data.velocity);
        } else {
          // If we see a new player not in our local list, maybe add them?
          // In a better system, room_state would handle this.
        }
      });

      socket.on('ball_kicked', (data: any) => {
        if (ballRef.current) {
          ballRef.current.velocity.copy(data.velocity);
        }
      });

      socket.on('room_state', (state: RoomState) => {
        setScore(state.score);
        // Sync players from state if they don't exist locally
        Object.values(state.players).forEach(pData => {
          if (pData.id !== socket.id) {
            let existing = playersRef.current.find(p => p.remoteId === pData.id);
            if (!existing) {
              const newP = new Player(pData.team, false, pData.roleType, pData.id);
              newP.mesh.position.copy(pData.position);
              playersRef.current.push(newP);
            }
          }
        });
      });

      socket.on('score_updated', (newScore: any) => {
        setScore(newScore);
        if (newScore.blue >= 5 || newScore.red >= 5) {
          setIsGameOver(true);
          setMessage(`${newScore.blue >= 5 ? 'BLUE' : 'RED'} WINS!`);
        }
      });

      return () => {
        socket.off('player_updated');
        socket.off('ball_kicked');
        socket.off('room_state');
        socket.off('score_updated');
      };
    }
  }, [mode, socket, setScore, playersRef, ballRef, Player]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* HUD */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-black/60 backdrop-blur-md px-8 py-3 rounded-2xl border border-white/10 shadow-2xl z-20">
        <div className="flex flex-col items-center">
          <span className="text-blue-400 text-xs font-bold tracking-widest uppercase">BLUE</span>
          <span className="text-white text-3xl font-black">{score.blue}</span>
        </div>
        <div className="w-px h-10 bg-white/20" />
        <div className="flex flex-col items-center">
          <span className="text-red-400 text-xs font-bold tracking-widest uppercase">RED</span>
          <span className="text-white text-3xl font-black">{score.red}</span>
        </div>
      </div>

      {/* Message Board */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
          >
            <h2 className="text-6xl md:text-8xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)] italic uppercase">
              {message}
            </h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Overlay */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm px-6 py-2 rounded-full border border-white/5 text-white/60 text-sm font-medium z-20">
        W,A,S,D: Move • SPACE: Power Kick • {mode === 'ONLINE' ? `Room: ${roomId}` : 'Offline Mode'}
      </div>

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-center z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-white/10 p-12 rounded-3xl text-center max-w-md w-full mx-4 shadow-2xl"
          >
            <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-6" />
            <h3 className="text-4xl font-bold text-white mb-8">{message}</h3>
            <button
              onClick={onExit}
              className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-zinc-200 transition-all cursor-pointer"
            >
              Back to Menu
            </button>
          </motion.div>
        </div>
      )}

      {/* Exit Button */}
      {!isGameOver && (
        <button 
          onClick={onExit}
          className="absolute top-8 right-8 bg-white/10 hover:bg-white/20 text-white/80 p-3 rounded-xl backdrop-blur-md border border-white/10 transition-all z-20 cursor-pointer"
        >
          Exit
        </button>
      )}
    </div>
  );
}
