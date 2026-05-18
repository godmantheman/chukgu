export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerData {
  id: string;
  name: string;
  team: 'blue' | 'red';
  roleType: 'STRIKER' | 'GK' | 'SUPPORT';
  position: Vector3;
  velocity: Vector3;
  isAI?: boolean;
}

export interface RoomState {
  id: string;
  players: Record<string, PlayerData>;
  ball: {
    position: Vector3;
    velocity: Vector3;
  };
  score: { blue: number; red: number };
  gameStarted: boolean;
  difficulty: 'EASY' | 'NORMAL' | 'HARD';
  ownerId: string;
}

export type GameMode = 'OFFLINE' | 'ONLINE';
export type PlayerRole = 'STRIKER' | 'GK';
export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';
