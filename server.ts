import express from "express";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface PlayerData {
  id: string;
  name: string;
  team: 'blue' | 'red';
  roleType: string;
  position: Vector3;
  velocity: Vector3;
}

interface RoomState {
  id: string;
  players: Record<string, PlayerData>;
  ball: {
    position: Vector3;
    velocity: Vector3;
  };
  score: { blue: number; red: number };
  gameStarted: boolean;
  difficulty: string;
  ownerId: string;
}

const rooms = new Map<string, RoomState>();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Socket.io Logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join_room", ({ roomId, name, team, roleType }) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          id: roomId,
          players: {},
          ball: { position: { x: 0, y: 1.2, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
          score: { blue: 0, red: 0 },
          gameStarted: false,
          difficulty: 'NORMAL',
          ownerId: socket.id
        });
      }

      const room = rooms.get(roomId)!;
      const blueCount = Object.values(room.players).filter(p => p.team === 'blue').length;
      const redCount = Object.values(room.players).filter(p => p.team === 'red').length;
      const assignedTeam = blueCount <= redCount ? 'blue' : 'red';

      room.players[socket.id] = {
        id: socket.id,
        name,
        team: assignedTeam,
        roleType,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 }
      };

      io.to(roomId).emit("room_state", room);
      console.log(`User ${name} joined room ${roomId}`);
    });

    socket.on("update_player", ({ roomId, position, velocity }) => {
      const room = rooms.get(roomId);
      if (room && room.players[socket.id]) {
        room.players[socket.id].position = position;
        room.players[socket.id].velocity = velocity;
        socket.to(roomId).emit("player_updated", room.players[socket.id]);
      }
    });

    socket.on("kick_ball", ({ roomId, velocity }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.ball.velocity = velocity;
        io.to(roomId).emit("ball_kicked", { velocity, kickerId: socket.id });
      }
    });

    socket.on("sync_ball", ({ roomId, position, velocity }) => {
      const room = rooms.get(roomId);
      // Only the room owner (host) or a designated "authority" should sync ball state if no one is touching it
      if (room && room.ownerId === socket.id) {
        room.ball.position = position;
        room.ball.velocity = velocity;
        socket.to(roomId).emit("ball_synced", { position, velocity });
      }
    });

    socket.on("score_update", ({ roomId, score }) => {
      const room = rooms.get(roomId);
      if (room && room.ownerId === socket.id) {
        room.score = score;
        io.to(roomId).emit("score_updated", score);
      }
    });

    socket.on("start_game", (roomId) => {
      const room = rooms.get(roomId);
      if (room && room.ownerId === socket.id) {
        room.gameStarted = true;
        io.to(roomId).emit("game_started");
      }
    });

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          const room = rooms.get(roomId);
          if (room) {
            delete room.players[socket.id];
            if (Object.keys(room.players).length === 0) {
              rooms.delete(roomId);
            } else {
              if (room.ownerId === socket.id) {
                room.ownerId = Object.keys(room.players)[0];
              }
              io.to(roomId).emit("room_state", room);
            }
          }
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite Middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
