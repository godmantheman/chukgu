import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PlayerData, RoomState, GameMode, Difficulty, PlayerRole } from '../types';

const BALL_RADIUS = 1.2;
const PITCH_WIDTH = 60;
const PITCH_LENGTH = 100;
const GOAL_WIDTH = 14;
const GOAL_HEIGHT = 4.5;
const KICK_RANGE = 5.8;

const DIFF_SETTINGS = {
  EASY: { aiSpeedMult: 0.65, gkReaction: 5.0, kickAccuracy: 0.4, defenseGap: 8 },
  NORMAL: { aiSpeedMult: 0.85, gkReaction: 8.5, kickAccuracy: 0.7, defenseGap: 3 },
  HARD: { aiSpeedMult: 1.05, gkReaction: 15.0, kickAccuracy: 0.95, defenseGap: 0 }
};

export function useSoccerGame(
  containerRef: React.RefObject<HTMLDivElement | null>,
  mode: GameMode,
  options: {
    playerCount: number;
    difficulty: Difficulty;
    role: PlayerRole;
    onGoal: (team: 'blue' | 'red') => void;
    onScoreUpdate: (score: { blue: number; red: number }) => void;
    isOnline: boolean;
    socket?: any;
    roomId?: string;
  }
) {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const ballRef = useRef<THREE.Mesh & { velocity: THREE.Vector3 } | null>(null);
  const playersRef = useRef<any[]>([]);
  const myPlayerRef = useRef<any>(null);
  const clockRef = useRef(new THREE.Clock());
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const isPlayingRef = useRef(false);
  const [score, setScore] = useState({ blue: 0, red: 0 });

  // Initialize Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 80, 50);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.7);
    sunLight.position.set(30, 60, 30);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Create Pitch
    const pitchGeo = new THREE.PlaneGeometry(PITCH_WIDTH, PITCH_LENGTH);
    const pitchMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
    const drawLine = (w: number, h: number, x: number, z: number) => {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
      l.rotation.x = -Math.PI / 2;
      l.position.set(x, 0.02, z);
      scene.add(l);
    };
    drawLine(PITCH_WIDTH, 0.4, 0, PITCH_LENGTH / 2);
    drawLine(PITCH_WIDTH, 0.4, 0, -PITCH_LENGTH / 2);
    drawLine(0.4, PITCH_LENGTH, PITCH_WIDTH / 2, 0);
    drawLine(0.4, PITCH_LENGTH, -PITCH_WIDTH / 2, 0);
    drawLine(PITCH_WIDTH, 0.3, 0, 0);

    // Create Goals
    const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const buildGoal = (z: number) => {
      const group = new THREE.Group();
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, GOAL_HEIGHT, 0.4), goalMat);
      p1.position.set(-GOAL_WIDTH / 2, GOAL_HEIGHT / 2, 0);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, GOAL_HEIGHT, 0.4), goalMat);
      p2.position.set(GOAL_WIDTH / 2, GOAL_HEIGHT / 2, 0);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(GOAL_WIDTH, 0.4, 0.4), goalMat);
      bar.position.set(0, GOAL_HEIGHT, 0);
      group.add(p1, p2, bar);
      group.position.set(0, 0, z);
      scene.add(group);
    };
    buildGoal(-PITCH_LENGTH / 2);
    buildGoal(PITCH_LENGTH / 2);

    // Create Ball
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    ) as any;
    ball.castShadow = true;
    ball.position.set(0, BALL_RADIUS, 0);
    ball.velocity = new THREE.Vector3();
    scene.add(ball);
    ballRef.current = ball;

    // Input listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.code === 'Space') keysRef.current['space'] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
      if (e.code === 'Space') keysRef.current['space'] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const onResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Player Class/Logic
  class Player {
    mesh: THREE.Group;
    team: 'blue' | 'red';
    isAI: boolean;
    roleType: string;
    velocity = new THREE.Vector3();
    shootCooldown = 0;
    facingDir = new THREE.Vector3(0, 0, 0);
    homePos = new THREE.Vector3();
    baseSpeed: number;
    remoteId?: string;

    constructor(team: 'blue' | 'red', isAI = true, roleType = 'SUPPORT', remoteId?: string) {
      this.team = team;
      this.isAI = isAI;
      this.roleType = roleType;
      this.remoteId = remoteId;
      this.mesh = new THREE.Group();
      this.facingDir.set(0, 0, team === 'blue' ? -1 : 1);

      const bodyColor = team === 'blue' ? 0x2266ff : 0xff4422;
      const mat = new THREE.MeshStandardMaterial({ color: roleType === 'GK' ? 0xffcc00 : bodyColor });

      const bodyHeight = 1.3;
      const bodyRadius = 0.7;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, 12), mat);
      body.position.y = bodyHeight / 2 + 0.5;
      body.castShadow = true;
      this.mesh.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
      head.position.y = 2.6;
      this.mesh.add(head);

      if (!isAI && !remoteId) {
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
        arrow.rotation.x = Math.PI / 2;
        arrow.position.z = 3.5;
        this.mesh.add(arrow);
      }

      sceneRef.current?.add(this.mesh);
      this.baseSpeed = this.isAI ? (24 * DIFF_SETTINGS[options.difficulty].aiSpeedMult) : 32;
      if (this.roleType === 'GK') this.baseSpeed *= 0.8;
    }

    update(dt: number) {
      if (!this.remoteId) {
        this.mesh.position.addScaledVector(this.velocity, dt);
        this.velocity.multiplyScalar(0.8);
      }
      this.mesh.position.y = 0;

      if (this.isAI && isPlayingRef.current) this.runAI(dt);
      
      this.checkCollisions(dt);
      if (this.shootCooldown > 0) this.shootCooldown -= dt;

      this.mesh.position.x = Math.max(-PITCH_WIDTH/2 + 1, Math.min(PITCH_WIDTH/2 - 1, this.mesh.position.x));
      this.mesh.position.z = Math.max(-PITCH_LENGTH/2 + 1, Math.min(PITCH_LENGTH/2 - 1, this.mesh.position.z));
    }

    checkCollisions(dt: number) {
      playersRef.current.forEach(other => {
        if (other === this) return;
        const d = this.mesh.position.distanceTo(other.mesh.position);
        if (d < 2.0) {
          const push = this.mesh.position.clone().sub(other.mesh.position).normalize().multiplyScalar(15 * dt);
          push.y = 0;
          this.velocity.add(push);
        }
      });
    }

    runAI(dt: number) {
      if (!ballRef.current) return;
      const settings = DIFF_SETTINGS[options.difficulty];
      const myGoalZ = this.team === 'blue' ? PITCH_LENGTH / 2 : -PITCH_LENGTH / 2;
      const enemyGoalZ = -myGoalZ;
      const distToBall = this.mesh.position.distanceTo(ballRef.current.position);

      if (this.roleType === 'GK') {
        const reactSpeed = settings.gkReaction;
        const targetX = Math.max(-GOAL_WIDTH / 2 - 1, Math.min(GOAL_WIDTH / 2 + 1, ballRef.current.position.x));
        const targetZ = myGoalZ - (Math.sign(myGoalZ) * 2);
        const moveVec = new THREE.Vector3(targetX, 0, targetZ).sub(this.mesh.position);
        this.velocity.addScaledVector(moveVec, reactSpeed * dt);

        if (distToBall < 7.0) {
          const clearDir = new THREE.Vector3(ballRef.current.position.x, 0, enemyGoalZ).sub(ballRef.current.position).normalize();
          clearDir.y = 0;
          this.kick(clearDir, 40);
        }
        return;
      }

      let targetPos = new THREE.Vector3().copy(this.homePos);
      const isEnemy = this.team === 'red';
      let canChase = true;
      if (isEnemy && options.difficulty === 'EASY' && ballRef.current.position.z * (this.team === 'blue' ? 1 : -1) < 0) {
        if (distToBall > 15) canChase = false;
      }

      if (canChase && distToBall < 45) {
        const gap = isEnemy ? settings.defenseGap : 0;
        targetPos.copy(ballRef.current.position);
        if (gap > 0) targetPos.z += (this.team === 'blue' ? gap : -gap);
      }

      const moveDir = targetPos.clone().sub(this.mesh.position).normalize();
      this.velocity.addScaledVector(moveDir, this.baseSpeed * 8 * dt);

      if (this.velocity.length() > 0.1) {
        this.mesh.rotation.y = Math.atan2(moveDir.x, moveDir.z);
        this.facingDir.copy(moveDir);
      }

      if (distToBall < KICK_RANGE) {
        let shootDir = new THREE.Vector3(0, 0, enemyGoalZ).sub(ballRef.current.position).normalize();
        shootDir.y = 0;
        if (isEnemy) {
          const offset = (1 - settings.kickAccuracy) * 10;
          shootDir.x += (Math.random() - 0.5) * offset;
        }
        this.kick(shootDir, 45);
      }
    }

    kick(dir: THREE.Vector3, power = 45) {
      if (!ballRef.current) return;
      if (this.shootCooldown <= 0 && this.mesh.position.distanceTo(ballRef.current.position) < KICK_RANGE) {
        const finalDir = dir.clone().normalize();
        if (!this.isAI && !this.remoteId) {
          const enemyGoalPos = new THREE.Vector3(0, 0, this.team === 'blue' ? -PITCH_LENGTH / 2 : PITCH_LENGTH / 2);
          const toGoal = enemyGoalPos.sub(ballRef.current.position).normalize();
          finalDir.lerp(toGoal, 0.4);
          power = 55;
        }
        finalDir.y = 0;
        ballRef.current.velocity.copy(finalDir.multiplyScalar(power));
        ballRef.current.velocity.y = 0;
        this.shootCooldown = 0.5;

        if (options.isOnline && !this.remoteId && options.socket) {
          options.socket.emit('kick_ball', { roomId: options.roomId, velocity: ballRef.current.velocity });
        }
      }
    }
  }

  const resetGame = useCallback(() => {
    if (!ballRef.current) return;
    ballRef.current.position.set(0, BALL_RADIUS, 0);
    ballRef.current.velocity.set(0, 0, 0);

    playersRef.current.forEach((p, idx) => {
      const side = p.team === 'blue' ? 1 : -1;
      let hx = 0, hz = 0;
      if (p.roleType === 'GK') {
        hx = 0; hz = side * (PITCH_LENGTH / 2 - 4);
      } else if (p.roleType === 'STRIKER') {
        hx = (idx % 2 === 0 ? 8 : -8); hz = side * 10;
      } else {
        hx = (Math.random() - 0.5) * 30; hz = side * 25;
      }
      p.homePos.set(hx, 0, hz);
      p.mesh.position.copy(p.homePos);
      p.velocity.set(0, 0, 0);
    });

    if (myPlayerRef.current && cameraRef.current) {
      cameraRef.current.position.z = myPlayerRef.current.mesh.position.z + 50;
    }
  }, [options.difficulty]);

  const startGame = useCallback(() => {
    if (!sceneRef.current) {
      console.warn('Scene not ready for startGame, retrying...');
      setTimeout(startGame, 100);
      return;
    }
    
    console.log('Starting game with role:', options.role);
    isPlayingRef.current = true;
    setScore({ blue: 0, red: 0 });

    // Clear old players
    playersRef.current.forEach(p => sceneRef.current?.remove(p.mesh));
    playersRef.current = [];

    const setupTeam = (team: 'blue' | 'red', isUserTeam: boolean) => {
      for (let i = 0; i < options.playerCount; i++) {
        let type = (i === 0) ? 'GK' : (i === 1 ? 'STRIKER' : 'SUPPORT');
        let isAI = true;
        
        if (isUserTeam && type === options.role && !myPlayerRef.current) {
          isAI = false;
          const p = new Player(team, false, type);
          myPlayerRef.current = p;
          playersRef.current.push(p);
        } else {
          playersRef.current.push(new Player(team, true, type));
        }
      }
    };
    setupTeam('blue', true);
    setupTeam('red', false);

    resetGame();
  }, [options.playerCount, options.role, options.difficulty, resetGame]);

  // Main Loop
  useEffect(() => {
    let frameId: number;
    const animate = () => {
[diff_chunk_start]
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clockRef.current.getDelta(), 0.1);

      if (isPlayingRef.current) {
        // Manual Control
        if (myPlayerRef.current) {
          let dx = 0, dz = 0;
          if (keysRef.current.w) dz -= 1; if (keysRef.current.s) dz += 1;
          if (keysRef.current.a) dx -= 1; if (keysRef.current.d) dx += 1;

          if (dx !== 0 || dz !== 0) {
            const move = new THREE.Vector3(dx, 0, dz).normalize();
            myPlayerRef.current.velocity.x += move.x * myPlayerRef.current.baseSpeed * dt * 15;
            myPlayerRef.current.velocity.z += move.z * myPlayerRef.current.baseSpeed * dt * 15;
            myPlayerRef.current.mesh.rotation.y = Math.atan2(dx, dz);
            myPlayerRef.current.facingDir.copy(move);

            if (options.isOnline && options.socket) {
              options.socket.emit('update_player', {
                roomId: options.roomId,
                position: { 
                  x: myPlayerRef.current.mesh.position.x, 
                  y: myPlayerRef.current.mesh.position.y, 
                  z: myPlayerRef.current.mesh.position.z 
                },
                velocity: { 
                  x: myPlayerRef.current.velocity.x, 
                  y: myPlayerRef.current.velocity.y, 
                  z: myPlayerRef.current.velocity.z 
                }
              });
            }
          }

          if (keysRef.current.space) {
            const kickDir = myPlayerRef.current.facingDir.clone();
            myPlayerRef.current.kick(kickDir, 60);
          }

          // Camera
          if (cameraRef.current) {
            const targetCamZ = myPlayerRef.current.mesh.position.z + 50;
            cameraRef.current.position.z += (targetCamZ - cameraRef.current.position.z) * 0.08;
            cameraRef.current.lookAt(0, 0, myPlayerRef.current.mesh.position.z - 20);
          }
        } else {
          // If no player, just hover camera
          if (cameraRef.current && ballRef.current) {
            cameraRef.current.lookAt(ballRef.current.position);
          }
        }

        playersRef.current.forEach(p => p.update(dt));

        // Physics
        if (ballRef.current) {
          ballRef.current.position.addScaledVector(ballRef.current.velocity, dt);
          ballRef.current.position.y = BALL_RADIUS;
          ballRef.current.velocity.y = 0;
          ballRef.current.velocity.multiplyScalar(0.985);

          if (Math.abs(ballRef.current.position.x) > PITCH_WIDTH / 2) {
            ballRef.current.position.x = Math.sign(ballRef.current.position.x) * PITCH_WIDTH / 2;
            ballRef.current.velocity.x *= -0.5;
          }

          if (Math.abs(ballRef.current.position.z) > PITCH_LENGTH / 2) {
            if (Math.abs(ballRef.current.position.x) < GOAL_WIDTH / 2) {
              const scoredTeam = ballRef.current.position.z < 0 ? 'blue' : 'red';
              options.onGoal(scoredTeam);
              // In offline mode, update score directly
              if (!options.isOnline) {
                setScore(prev => {
                  const next = { ...prev, [scoredTeam]: prev[scoredTeam] + 1 };
                  options.onScoreUpdate(next);
                  return next;
                });
                isPlayingRef.current = false;
                setTimeout(() => { resetGame(); isPlayingRef.current = true; }, 2000);
              }
            } else {
              ballRef.current.position.z = Math.sign(ballRef.current.position.z) * PITCH_LENGTH / 2;
              ballRef.current.velocity.z *= -0.5;
            }
          }

          // Player-ball collision
          playersRef.current.forEach(p => {
            const dist = p.mesh.position.distanceTo(ballRef.current!.position);
            if (dist < (1.5 + BALL_RADIUS)) {
              const push = ballRef.current!.position.clone().sub(p.mesh.position).normalize();
              push.y = 0;
              ballRef.current!.velocity.add(push.multiplyScalar(1.8));
              ballRef.current!.velocity.x += p.velocity.x * 0.25;
              ballRef.current!.velocity.z += p.velocity.z * 0.25;
              ballRef.current!.velocity.y = 0;
            }
          });
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    return () => cancelAnimationFrame(frameId);
  }, [options.isOnline, options.roomId, resetGame]);

  return {
    startGame,
    resetGame,
    score,
    setScore,
    ballRef,
    playersRef,
    myPlayerRef,
    sceneRef,
    Player // Exporting the class constructor if needed
  };
}
