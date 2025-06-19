import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { useRef, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { Html } from '@react-three/drei';
import { useVoiceChat } from './useVoiceChat';

// 1. Wall data for rendering and collision
const ROOM_OFFSET = 12; // Distance between room centers (was ~6, now doubled)
const ROOM_SIZE = 5; // Room width/height (for reference)
const WALL_HEIGHT = 2;
const WALL_THICKNESS = 0.25;
const OFFICE_HALF = ROOM_OFFSET + ROOM_SIZE + 2; // For perimeter
const WALL_DATA: { pos: [number, number, number]; size: [number, number, number] }[] = [
  // Perimeter walls (rectangle)
  { pos: [0, 1, -OFFICE_HALF], size: [OFFICE_HALF * 2, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [0, 1, OFFICE_HALF], size: [OFFICE_HALF * 2, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [-OFFICE_HALF, 1, 0], size: [WALL_THICKNESS, WALL_HEIGHT, OFFICE_HALF * 2] }, // West
  { pos: [OFFICE_HALF, 1, 0], size: [WALL_THICKNESS, WALL_HEIGHT, OFFICE_HALF * 2] }, // East

  // Top left: Break room
  { pos: [-ROOM_OFFSET - 2, 1, -ROOM_OFFSET - 4], size: [5.25, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [-ROOM_OFFSET - 4.5, 1, -ROOM_OFFSET + 0.63], size: [WALL_THICKNESS, WALL_HEIGHT, 9] }, // West
  { pos: [-ROOM_OFFSET - 2, 1, -ROOM_OFFSET + 5], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [-ROOM_OFFSET + 0.5, 1, -ROOM_OFFSET + 4], size: [WALL_THICKNESS, WALL_HEIGHT, 2.2] }, // Lower segment
  { pos: [-ROOM_OFFSET + 0.5, 1, -ROOM_OFFSET - 2.5], size: [WALL_THICKNESS, WALL_HEIGHT, 3] }, // Upper segment

  // Top center: Meeting room
  { pos: [0, 1, -ROOM_OFFSET - 5], size: [10, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [-4.88, 1, -ROOM_OFFSET], size: [WALL_THICKNESS, WALL_HEIGHT, 10] }, // West
  { pos: [4.88, 1, -ROOM_OFFSET], size: [WALL_THICKNESS, WALL_HEIGHT, 10] }, // East
  { pos: [-4, 1, -ROOM_OFFSET + 5], size: [2, WALL_HEIGHT, WALL_THICKNESS] }, // South Segment 1
  { pos: [2, 1, -ROOM_OFFSET + 5], size: [6, WALL_HEIGHT, WALL_THICKNESS] }, // South Segment 2

  // Top right: Meeting room
  { pos: [ROOM_OFFSET, 1, -ROOM_OFFSET], size: [5.25, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [ROOM_OFFSET + 2.5, 1, -ROOM_OFFSET + 2.375], size: [WALL_THICKNESS, WALL_HEIGHT, 5.5] }, // West
  { pos: [ROOM_OFFSET, 1, -ROOM_OFFSET + 5], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [ROOM_OFFSET - 2.5, 1, -ROOM_OFFSET + 2.375], size: [WALL_THICKNESS, WALL_HEIGHT, 5.5] }, // East
  { pos: [ROOM_OFFSET - 2, 1, -ROOM_OFFSET + 5], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap south
  { pos: [ROOM_OFFSET + 2, 1, -ROOM_OFFSET + 5], size: [1, WALL_HEIGHT, WALL_THICKNESS] },

  // Middle left: Meeting room
  { pos: [-ROOM_OFFSET, 1, 0], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [-ROOM_OFFSET - 2.5, 1, 2.88], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // West
  { pos: [-ROOM_OFFSET, 1, 5.755], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [-ROOM_OFFSET + 2.5, 1, 2.88], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // East
  { pos: [-ROOM_OFFSET - 2, 1, 0], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap north
  { pos: [-ROOM_OFFSET + 2, 1, 0], size: [1, WALL_HEIGHT, WALL_THICKNESS] },

  // Center: Large office/cubicle
  { pos: [0, 1, 0], size: [6, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [-3, 1, 3], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // West
  { pos: [3, 1, 3], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // East
  { pos: [0, 1, 8], size: [6, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [-1.5, 1, 0], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap north
  { pos: [1.5, 1, 0], size: [1, WALL_HEIGHT, WALL_THICKNESS] },

  // Middle right: Meeting room
  { pos: [ROOM_OFFSET, 1, 0], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [ROOM_OFFSET + 2.5, 1, 2.88], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // West
  { pos: [ROOM_OFFSET, 1, 5.755], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [ROOM_OFFSET - 2.5, 1, 2.88], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // East
  { pos: [ROOM_OFFSET - 2, 1, 0], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap north
  { pos: [ROOM_OFFSET + 2, 1, 0], size: [1, WALL_HEIGHT, WALL_THICKNESS] },

  // Bottom left: Meeting room
  { pos: [-ROOM_OFFSET, 1, ROOM_OFFSET], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [-ROOM_OFFSET - 2.5, 1, ROOM_OFFSET + 2.88], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // West
  { pos: [-ROOM_OFFSET, 1, ROOM_OFFSET + 5.755], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [-ROOM_OFFSET + 2.5, 1, ROOM_OFFSET + 2.88], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // East
  { pos: [-ROOM_OFFSET - 2, 1, ROOM_OFFSET], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap north
  { pos: [-ROOM_OFFSET + 2, 1, ROOM_OFFSET], size: [1, WALL_HEIGHT, WALL_THICKNESS] },

  // Bottom center: Table area
  { pos: [0, 1, ROOM_OFFSET], size: [6, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [-3, 1, ROOM_OFFSET - 3], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // West
  { pos: [3, 1, ROOM_OFFSET - 3], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // East
  { pos: [0, 1, ROOM_OFFSET - 5], size: [6, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [-1.5, 1, ROOM_OFFSET - 5], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap north
  { pos: [1.5, 1, ROOM_OFFSET - 5], size: [1, WALL_HEIGHT, WALL_THICKNESS] },

  // Bottom right: Cubicles
  { pos: [ROOM_OFFSET, 1, ROOM_OFFSET], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [ROOM_OFFSET + 2.5, 1, ROOM_OFFSET + 2.88], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // West
  { pos: [ROOM_OFFSET, 1, ROOM_OFFSET + 5.755], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [ROOM_OFFSET - 2.5, 1, ROOM_OFFSET + 2.88], size: [WALL_THICKNESS, WALL_HEIGHT, 6] }, // East
  { pos: [ROOM_OFFSET - 2, 1, ROOM_OFFSET], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap north
  { pos: [ROOM_OFFSET + 2, 1, ROOM_OFFSET], size: [1, WALL_HEIGHT, WALL_THICKNESS] },
];

// Helper for AABB collision
function aabbCollidesBox(pos: [number, number, number], boxPos: [number, number, number], boxSize: [number, number, number], size = 0.35) {
  // Player is a box centered at pos, size is half-extent
  const min = [boxPos[0] - boxSize[0] / 2, boxPos[1] - boxSize[1] / 2, boxPos[2] - boxSize[2] / 2];
  const max = [boxPos[0] + boxSize[0] / 2, boxPos[1] + boxSize[1] / 2, boxPos[2] + boxSize[2] / 2];
  return (
    pos[0] + size > min[0] && pos[0] - size < max[0] &&
    pos[1] + size > min[1] && pos[1] - size < max[1] &&
    pos[2] + size > min[2] && pos[2] - size < max[2]
  );
}

function usePlayerMovement(disabled = false) {
  const [position, setPosition] = useState<[number, number, number]>([0, 0.5, -2]);
  const velocity = useRef<[number, number]>([0, 0]); // [vx, vz]
  const keys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (disabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      keys.current[e.key.toLowerCase()] = true;
    }
    function handleKeyUp(e: KeyboardEvent) {
      keys.current[e.key.toLowerCase()] = false;
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;
    let animationFrame: number;
    const speed = 0.12;
    function animate() {
      let vx = 0, vz = 0;
      if (keys.current['arrowup'] || keys.current['w']) vz -= speed;
      if (keys.current['arrowdown'] || keys.current['s']) vz += speed;
      if (keys.current['arrowleft'] || keys.current['a']) vx -= speed;
      if (keys.current['arrowright'] || keys.current['d']) vx += speed;
      velocity.current = [vx, vz];
      setPosition((pos) => {
        const next: [number, number, number] = [pos[0] + vx, pos[1], pos[2] + vz];
        // Check collision with all wall boxes
        for (const wall of WALL_DATA) {
          if (aabbCollidesBox(next, wall.pos, wall.size)) {
            return pos; // Block movement
          }
        }
        return next;
      });
      animationFrame = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, [disabled]);

  return position;
}

// Furniture primitives
function Table({ position, size = [1.5, 0.2, 1] }: { position: [number, number, number], size?: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#a97c50" />
    </mesh>
  );
}
function Chair({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshStandardMaterial color="#5a4633" />
    </mesh>
  );
}
function Desk({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[1, 0.2, 0.6]} />
      <meshStandardMaterial color="#b88c5a" />
    </mesh>
  );
}
function Computer({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.4, 0.25, 0.1]} />
      <meshStandardMaterial color="#444" />
    </mesh>
  );
}
function Plant({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.15, 0.15, 0.3, 12]} />
      <meshStandardMaterial color="#7c5a3a" />
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color="#3a7c4a" />
      </mesh>
    </mesh>
  );
}

// Add new low-poly furniture primitives
function Couch({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.6, 0.4, 0.6]} />
        <meshStandardMaterial color="#3a5a7c" />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.5, -0.25]}>
        <boxGeometry args={[1.6, 0.5, 0.2]} />
        <meshStandardMaterial color="#2a3a4c" />
      </mesh>
      {/* Armrests */}
      <mesh position={[-0.7, 0.35, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.6]} />
        <meshStandardMaterial color="#2a3a4c" />
      </mesh>
      <mesh position={[0.7, 0.35, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.6]} />
        <meshStandardMaterial color="#2a3a4c" />
      </mesh>
    </group>
  );
}

function Fridge({ position }: { position: [number, number, number] }) {
  return (
    <mesh>
      <mesh position={position}>
        <boxGeometry args={[0.75, 2.25, 0.75]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
      <mesh position={[position[0] - 0.275, position[1], position[2] + 0.375]}>
        <boxGeometry args={[0.05, 0.5, 0.05]} />
        <meshStandardMaterial color="#0f0f0f" />
      </mesh>
    </mesh>
  );
}

function Lamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.8, 8]} />
        <meshStandardMaterial color="#b8b8b8" />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#fff7b2" emissive="#fff7b2" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function Counter({ position, length = 1.2 }: { position: [number, number, number], length?: number }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[length, 0.35, 0.5]} />
      <meshStandardMaterial color="#b88c5a" />
    </mesh>
  );
}

function Microwave({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.35, 0.2, 0.3]} />
      <meshStandardMaterial color="#d8d8d8" />
    </mesh>
  );
}

function Cabinets({ position, length = 1.2 }: { position: [number, number, number], length?: number }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[length, 0.3, 0.4]} />
      <meshStandardMaterial color="#e6d2b5" />
    </mesh>
  );
}

function CoffeeMachine({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.18, 0.25, 0.18]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[0, 0.28, 0.07]}>
        <cylinderGeometry args={[0.06, 0.06, 0.1, 8]} />
        <meshStandardMaterial color="#b8b8b8" />
      </mesh>
    </group>
  );
}

function Whiteboard({ position, rotation = [0, 0, 0] }: { position: [number, number, number], rotation?: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={[2.5, 1.2, 0.08]} />
      <meshStandardMaterial color="#f8f8f8" />
    </mesh>
  );
}

function Projector({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.5, 0.15, 0.3]} />
      <meshStandardMaterial color="#888" />
    </mesh>
  );
}

function ProjectorLight({ position, targetZ }: { position: [number, number, number], targetZ: number }) {
  // Simple cone for light
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[1, Math.abs(position[2] - targetZ), 16, 1, true]} />
      <meshStandardMaterial color="#ffffcc" transparent opacity={0.4} />
    </mesh>
  );
}

function Watercooler({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 1, 16]} />
        <meshStandardMaterial color="#b0e0ff" />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#e0f7ff" />
      </mesh>
    </group>
  );
}

function Bookshelf({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.3, 1.5, 1.8]} />
      <meshStandardMaterial color="#a97c50" />
    </mesh>
  );
}

function Furniture({ onChairSnap, snappedChairId, playerId }: { onChairSnap?: (chairId: string | null) => void, snappedChairId?: string | null, playerId?: string }) {
  // Break room (top left, centered at [-ROOM_OFFSET, -ROOM_OFFSET])
  const x = -ROOM_OFFSET - 2;
  const z = -ROOM_OFFSET;
  // Room 101 (centered at [0, 0, -ROOM_OFFSET])
  const room101x = 0;
  const room101z = -ROOM_OFFSET;
  // Table positions
  const table1 = [room101x - 2, 0.2, room101z];
  const table2 = [room101x + 2, 0.2, room101z];
  // Chair positions (2x4)
  const chairPositions = [
    [room101x - 3, 0.2, room101z - 1.25],
    [room101x - 3, 0.2, room101z - 0.425],
    [room101x - 3, 0.2, room101z + 0.425],
    [room101x - 3, 0.2, room101z + 1.25],
    [room101x - 1, 0.2, room101z - 1.25],
    [room101x - 1, 0.2, room101z - 0.425],
    [room101x - 1, 0.2, room101z + 0.425],
    [room101x - 1, 0.2, room101z + 1.25],

    [room101x + 3, 0.2, room101z - 1.25],
    [room101x + 3, 0.2, room101z - 0.425],
    [room101x + 3, 0.2, room101z + 0.425],
    [room101x + 3, 0.2, room101z + 1.25],
    [room101x + 1, 0.2, room101z - 1.25],
    [room101x + 1, 0.2, room101z - 0.425],
    [room101x + 1, 0.2, room101z + 0.425],
    [room101x + 1, 0.2, room101z + 1.25],
  ];
  // Whiteboard (north wall)
  const whiteboardPos = [room101x + 2, 1, room101z - 4.8];
  // Projector (on table1, leftmost)
  const projectorPos = [room101x - 2, 0.75, room101z - 1.5];
  // Projector light (projects to north wall)
  const projectorLightPos = [room101x - 2, 0.75, room101z - 3.25];
  // Watercooler (near entrance, south wall)
  const watercoolerPos = [room101x, 0, room101z + 4.5];
  // Bookshelf (east wall)
  const bookshelfPos = [room101x + 4.65, 0.75, room101z];

  // Chair snap logic
  const [localSnappedChair, setLocalSnappedChair] = useState<string | null>(null);
  const handleChairSnap = useCallback((chairId: string) => {
    if (localSnappedChair === chairId) {
      setLocalSnappedChair(null);
      onChairSnap && onChairSnap(null);
    } else {
      setLocalSnappedChair(chairId);
      onChairSnap && onChairSnap(chairId);
    }
  }, [localSnappedChair, onChairSnap]);

  return (
    <>
      {/* Break room furniture */}
      {/* Table (south part) */}
      <Table position={[x, 0.2, z + 4]} size={[1.2, 0.2, 1.2]} />
      {/* Couch (south wall, facing north) */}
      <Couch position={[x, 0.2, z + 2.5]} />
      {/* Plants */}
      <Plant position={[x - 2, 0.15, z + 4.5]} />
      <Plant position={[x + 2, 0.15, z + 4.5]} />
      <Plant position={[x + 2, 0.2, z - 3.5]} />
      {/* Lamp in SE corner */}
      <Lamp position={[x - 2, 0, z + 2.2]} />
      {/* Fridge (north wall, left) */}
      <Fridge position={[x - 2, 0.5, z - 3.5]} />
      {/* Counter (north wall, center) */}
      <Counter position={[x, 0.5, z - 3.6]} length={3.2} />
      {/* Microwave on counter */}
      <Microwave position={[x - 1, 1, z - 3.5]} />
      {/* Cabinets above counter */}
      <Cabinets position={[x, 2, z - 3.6]} length={1.2} />
      {/* Coffee machine on counter (right) */}
      <CoffeeMachine position={[x + 1, 1, z - 3.5]} />

      {/* Room 101 furniture */}
      <Table position={table1 as [number, number, number]} size={[1.5, 0.5, 4]} />
      <Table position={table2 as [number, number, number]} size={[1.5, 0.5, 4]} />
      {chairPositions.map((pos, i) => (
        <group key={`room101-chair-${i}`}>
          <Chair position={pos as [number, number, number]} />
          {/* Snap indicator */}
          {onChairSnap && <mesh position={[pos[0], pos[1] + 0.5, pos[2]]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={localSnappedChair === `room101-chair-${i}` ? '#ff5050' : '#50ff50'} opacity={0} transparent />
          </mesh>}
        </group>
      ))}
      <Whiteboard position={whiteboardPos as [number, number, number]} />
      <Projector position={projectorPos as [number, number, number]} />
      <ProjectorLight position={projectorLightPos as [number, number, number]} targetZ={room101z - 6.5} />
      <Watercooler position={watercoolerPos as [number, number, number]} />
      <Bookshelf position={bookshelfPos as [number, number, number]} />

      {/* Meeting room (top right) */}
      <Table position={[8.5, 0.2, -ROOM_OFFSET]} size={[1.2, 0.2, 1.2]} />
      <Chair position={[8.5, 0.2, -ROOM_OFFSET - 1.2]} />
      <Chair position={[9.2, 0.2, -ROOM_OFFSET]} />
      <Chair position={[8.5, 0.2, -ROOM_OFFSET + 1.2]} />
      <Chair position={[7.8, 0.2, -ROOM_OFFSET]} />
      {/* Meeting room (middle left) */}
      <Table position={[-ROOM_OFFSET, 0.2, 0]} size={[1.2, 0.2, 1.2]} />
      <Chair position={[-ROOM_OFFSET - 1.2, 0.2, 0]} />
      <Chair position={[-ROOM_OFFSET - 1.2, 0.2, 1.2]} />
      <Chair position={[-ROOM_OFFSET, 0.2, 1.2]} />
      <Chair position={[-ROOM_OFFSET + 1.2, 0.2, 0]} />
      {/* Center office/cubicle */}
      <Desk position={[-1, 0.2, 4]} />
      <Computer position={[-1, 0.45, 4.2]} />
      <Chair position={[-1, 0.2, 4.7]} />
      <Desk position={[1, 0.2, 6]} />
      <Computer position={[1, 0.45, 6.2]} />
      <Chair position={[1, 0.2, 6.7]} />
      {/* Meeting room (middle right) */}
      <Table position={[ROOM_OFFSET, 0.2, 0]} size={[1.2, 0.2, 1.2]} />
      <Chair position={[ROOM_OFFSET + 1.2, 0.2, 0]} />
      <Chair position={[ROOM_OFFSET + 1.2, 0.2, 1.2]} />
      <Chair position={[ROOM_OFFSET, 0.2, 1.2]} />
      <Chair position={[ROOM_OFFSET - 1.2, 0.2, 0]} />
      {/* Meeting room (bottom left) */}
      <Table position={[-ROOM_OFFSET, 0.2, ROOM_OFFSET]} size={[1.2, 0.2, 1.2]} />
      <Chair position={[-ROOM_OFFSET - 1.2, 0.2, ROOM_OFFSET]} />
      <Chair position={[-ROOM_OFFSET - 1.2, 0.2, ROOM_OFFSET + 1.2]} />
      <Chair position={[-ROOM_OFFSET, 0.2, ROOM_OFFSET + 1.2]} />
      <Chair position={[-ROOM_OFFSET + 1.2, 0.2, ROOM_OFFSET]} />
      {/* Table area (bottom center) */}
      <Table position={[0, 0.2, ROOM_OFFSET]} size={[1.2, 0.2, 1.2]} />
      <Chair position={[0, 0.2, ROOM_OFFSET - 0.6]} />
      <Chair position={[-0.6, 0.2, ROOM_OFFSET]} />
      <Chair position={[0.6, 0.2, ROOM_OFFSET]} />
      <Chair position={[0, 0.2, ROOM_OFFSET + 0.6]} />
      {/* Cubicles (bottom right) */}
      <Table position={[ROOM_OFFSET, 0.2, ROOM_OFFSET]} size={[1.2, 0.2, 1.2]} />
      <Chair position={[ROOM_OFFSET + 1.2, 0.2, ROOM_OFFSET]} />
      <Chair position={[ROOM_OFFSET + 1.2, 0.2, ROOM_OFFSET + 1.2]} />
      <Chair position={[ROOM_OFFSET, 0.2, ROOM_OFFSET + 1.2]} />
      <Chair position={[ROOM_OFFSET - 1.2, 0.2, ROOM_OFFSET]} />
    </>
  );
}

// In App, compute dynamic wall data for Room 101 based on meeting privacy and participant status
function getDynamicWallData(roomsState: Record<string, any>, myId: string): { pos: [number, number, number]; size: [number, number, number] }[] {
  let wallData = [...WALL_DATA];
  const roomName = 'Room 101';
  const roomMeeting = roomsState[roomName]?.meeting;
  const isPrivate = roomMeeting?.isPrivate;
  const isParticipant = roomMeeting?.participants?.includes(myId);
  // Door gap segment for Room 101 south wall
  const doorGapPos: [number, number, number] = [-2, 1, -ROOM_OFFSET + 5.1];
  const doorGapSize: [number, number, number] = [2, WALL_HEIGHT, WALL_THICKNESS];
  // Remove all segments at the door gap position
  wallData = wallData.filter(w => !(w.pos[0] === doorGapPos[0] && w.pos[1] === doorGapPos[1] && w.pos[2] === doorGapPos[2]));
  if (roomMeeting && isPrivate && !isParticipant) {
    // Door should be closed: add a solid wall at the gap position
    wallData.push({ pos: doorGapPos, size: doorGapSize });
  } else {
    // Door should be open: add the gap segment (no wall)
    // (In Three.js, a gap means no wall, so we do NOT add a wall segment here)
    // If you want a visual door frame, you can add a thin frame here
    // But for now, do nothing (leave the gap open)
  }
  return wallData;
}

function Office({ wallData }: { wallData: { pos: [number, number, number]; size: [number, number, number] }[] }) {
  const wallColor = '#b89b6a';
  return (
    <>
      {/* Floor */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[OFFICE_HALF * 2 + 2, 0.1, OFFICE_HALF * 2 + 2]} />
        <meshStandardMaterial color="#e0d6b3" />
      </mesh>
      {wallData.map((wall, i) => (
        <mesh position={wall.pos} key={i}>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      ))}
      <Furniture />
    </>
  );
}

// Utility for random color
function getRandomColor() {
  const colors = ['#ff5050', '#50aaff', '#50ff50', '#ffd950', '#a950ff', '#ff50c8', '#50ffd9'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Player name prompt modal
function NameModal({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [input, setInput] = useState('');
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <form onSubmit={e => { e.preventDefault(); if (input.trim()) onSubmit(input.trim()); }} style={{ background: '#fff', padding: 32, borderRadius: 12 }}>
        <h2>Enter your name</h2>
        <input autoFocus value={input} onChange={e => setInput(e.target.value)} style={{ fontSize: 20, padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
        <button type="submit" style={{ marginLeft: 16, fontSize: 20, padding: '8px 16px', borderRadius: 6 }}>Join</button>
      </form>
    </div>
  );
}

// Multiplayer logic hook
function useMultiplayer(position: [number, number, number], name: string | null, color: string | null) {
  const [players, setPlayers] = useState<any[]>([]);
  const [roomsState, setRoomsState] = useState<any>({});
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!name || !color) return;
    const socket = io('https://1addfa25-c5ff-4e79-a846-003285aa3654-00-zflny0j2up6s.janeway.replit.dev/');
    socketRef.current = socket;
    socket.emit('join', { name, color, position });
    socket.on('players', (players) => setPlayers(players));
    socket.on('rooms-state', (rooms) => {
      console.log('rooms-state received:', rooms);
      setRoomsState(rooms);
    });
    return () => { socket.disconnect(); };
  }, [name, color]);

  useEffect(() => {
    if (socketRef.current && name && color) {
      socketRef.current.emit('move', position);
    }
  }, [position, name, color]);

  return { players, roomsState, socketRef };
}

// Player box with name
function PlayerBox({ position, color, name }: { position: [number, number, number], color: string, name: string }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 1, 0.7]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Name label */}
      <Html position={[0, 1.1, 0]} center style={{ pointerEvents: 'none', fontWeight: 'bold', color: '#222', background: 'rgba(255,255,255,0.8)', padding: '2px 8px', borderRadius: 6, fontSize: 18 }}>{name}</Html>
    </group>
  );
}

function FollowCamera({ target }: { target: [number, number, number] }) {
  const cameraRef = useRef<any>(null);
  useFrame(() => {
    if (cameraRef.current) {
      cameraRef.current.position.x = target[0];
      cameraRef.current.position.y = 45;
      cameraRef.current.position.z = target[2] + 4;
      cameraRef.current.lookAt(target[0], 0.5, target[2]);
    }
  });
  return <PerspectiveCamera ref={cameraRef} makeDefault fov={40} />;
}

// Helper to get room definitions (static info)
const ROOM_DEFS = [
  {
    name: 'Break Room',
    center: [-ROOM_OFFSET - 2, 0, -ROOM_OFFSET],
    entrance: [-ROOM_OFFSET + 0.5, 0, -ROOM_OFFSET + 1],
    type: 'break',
  },
  {
    name: 'Room 101',
    center: [0, 0, -ROOM_OFFSET],
    entrance: [0, 0, -ROOM_OFFSET + 5],
    type: 'meeting',
  },
  {
    name: 'Top Right Meeting Room',
    center: [ROOM_OFFSET, 0, -ROOM_OFFSET],
    entrance: [ROOM_OFFSET, 0, -ROOM_OFFSET + 5],
    type: 'meeting',
  },
  {
    name: 'Middle Left Meeting Room',
    center: [-ROOM_OFFSET, 0, 0],
    entrance: [-ROOM_OFFSET, 0, 5],
    type: 'meeting',
  },
  {
    name: 'Center Office',
    center: [0, 0, 0],
    entrance: [0, 0, 8],
    type: 'office',
  },
  {
    name: 'Middle Right Meeting Room',
    center: [ROOM_OFFSET, 0, 0],
    entrance: [ROOM_OFFSET, 0, 5],
    type: 'meeting',
  },
  {
    name: 'Bottom Left Meeting Room',
    center: [-ROOM_OFFSET, 0, ROOM_OFFSET],
    entrance: [-ROOM_OFFSET, 0, ROOM_OFFSET + 5],
    type: 'meeting',
  },
  {
    name: 'Bottom Center Table Area',
    center: [0, 0, ROOM_OFFSET],
    entrance: [0, 0, ROOM_OFFSET - 5],
    type: 'table',
  },
  {
    name: 'Bottom Right Cubicles',
    center: [ROOM_OFFSET, 0, ROOM_OFFSET],
    entrance: [ROOM_OFFSET, 0, ROOM_OFFSET + 5],
    type: 'cubicle',
  },
];

function getClosestRoom(playerPos: [number, number, number]) {
  let minDist = Infinity;
  let closest = null;
  for (const room of ROOM_DEFS) {
    const entrance = room.entrance || room.center;
    const dx = playerPos[0] - entrance[0];
    const dz = playerPos[2] - entrance[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3.5 && dist < minDist) {
      minDist = dist;
      closest = room;
    }
  }
  return closest;
}

function RoomDialog({ room, onClose, players, myId, socketRef, name }: { room: any, onClose: () => void, players: any[], myId: string, socketRef: any, name: string }) {
  const [meetingName, setMeetingName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showJoinRequest, setShowJoinRequest] = useState(false);
  const meeting = room.meeting;
  const isOwner = meeting && meeting.ownerId === myId;
  const isParticipant = meeting && meeting.participants && meeting.participants.includes(myId);
  const hasRequested = meeting && meeting.joinRequests && meeting.joinRequests.includes(myId);

  // Listen for join request (if owner)
  useEffect(() => {
    if (!socketRef.current) return;
    function onJoinRequest({ roomName, userId, user }: any) {
      if (roomName === room.name) {
        console.log('knock knock');
        setShowJoinRequest({ userId, user });
      }
    }
    socketRef.current.on('join-request', onJoinRequest);
    return () => socketRef.current.off('join-request', onJoinRequest);
  }, [room.name, socketRef]);

  // Listen for join-approved (if participant)
  useEffect(() => {
    if (!socketRef.current) return;
    function onJoinApproved({ roomName }) {
      if (roomName === room.name) {
        // Teleport inside: set position to room center
        // (You may want to update player position here)
      }
    }
    socketRef.current.on('join-approved', onJoinApproved);
    return () => socketRef.current.off('join-approved', onJoinApproved);
  }, [room.name, socketRef]);

  // Meeting creation form
  if (!meeting && room.type === 'meeting') {
    return (
      <div style={{ position: 'fixed', left: '50%', top: 80, transform: 'translateX(-50%)', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002', padding: 32, minWidth: 340, zIndex: 2000 }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>{room.name}</h2>
        <form onSubmit={e => { e.preventDefault(); socketRef.current.emit('start-meeting', { roomName: room.name, meetingName, isPrivate }); }}>
          <div style={{ margin: '18px 0 8px 0', fontWeight: 600 }}>Start a Meeting</div>
          <input value={meetingName} onChange={e => setMeetingName(e.target.value)} placeholder="Meeting name" style={{ fontSize: 20, padding: 8, borderRadius: 6, border: '1px solid #ccc', width: '100%' }} />
          <label style={{ display: 'block', margin: '12px 0' }}>
            <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} /> Private meeting (door closes)
          </label>
          <button type="submit" style={{ fontSize: 20, padding: '8px 16px', borderRadius: 6, marginTop: 8 }}>Start Meeting</button>
        </form>
        <button style={{ position: 'absolute', top: 8, right: 12, fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }} onClick={onClose}>×</button>
      </div>
    );
  }

  // Meeting info dialog
  if (meeting) {
    return (
      <div style={{ position: 'fixed', left: '50%', top: 80, transform: 'translateX(-50%)', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002', padding: 32, minWidth: 340, zIndex: 2000 }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>{room.name}</h2>
        <div style={{ margin: '12px 0 4px 0', fontWeight: 500 }}>Meeting: {meeting.name}</div>
        <div style={{ marginBottom: 4 }}>Participants: {meeting.participants?.map(id => players.find(p => p.id === id)?.name || id).join(', ')}</div>
        <div style={{ marginBottom: 12 }}>Private: {meeting.isPrivate ? 'Yes' : 'No'}</div>
        {isOwner && (
          <>
            <button onClick={() => socketRef.current.emit('end-meeting', { roomName: room.name })} style={{ fontSize: 18, padding: '6px 18px', borderRadius: 6, marginRight: 8 }}>End Meeting</button>
            <button onClick={() => socketRef.current.emit('update-meeting', { roomName: room.name, meetingName: meeting.name, isPrivate: !meeting.isPrivate })} style={{ fontSize: 18, padding: '6px 18px', borderRadius: 6 }}>{meeting.isPrivate ? 'Make Public' : 'Make Private'}</button>
            {meeting.joinRequests && meeting.joinRequests.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600 }}>Join Requests:</div>
                {meeting.joinRequests.map(id => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                    <span>{players.find(p => p.id === id)?.name || id}</span>
                    <button onClick={() => socketRef.current.emit('approve-join', { roomName: room.name, userId: id })} style={{ marginLeft: 12, fontSize: 16, padding: '4px 12px', borderRadius: 6 }}>Approve</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {!isOwner && !isParticipant && meeting.isPrivate && !hasRequested && (
          <button onClick={() => socketRef.current.emit('ask-to-join', { roomName: room.name })} style={{ fontSize: 18, padding: '6px 18px', borderRadius: 6 }}>Ask to Join</button>
        )}
        {isParticipant && (
          <button onClick={() => socketRef.current.emit('leave-meeting', { roomName: room.name })} style={{ fontSize: 18, padding: '6px 18px', borderRadius: 6, marginTop: 12 }}>Leave Meeting</button>
        )}
        <button style={{ position: 'absolute', top: 8, right: 12, fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }} onClick={onClose}>×</button>
      </div>
    );
  }

  // Default: no meeting
  return null;
}

function getCurrentChannel(playerPos: [number, number, number]) {
  // If in a room (within 4 units of a room center), use that room's name as channel; else 'office'
  const room = getClosestRoom(playerPos);
  if (room && Math.sqrt((playerPos[0] - room.center[0]) ** 2 + (playerPos[2] - room.center[2]) ** 2) < 4) {
    return room.name;
  }
  return 'office';
}

function App() {
  const [name, setName] = useState<string | null>(null);
  const [color] = useState<string>(() => getRandomColor());
  const playerPosition = usePlayerMovement(!name);
  const { players, roomsState, socketRef } = useMultiplayer(playerPosition, name, color);
  const [dialogRoom, setDialogRoom] = useState<any>(null);
  const [snappedChairId, setSnappedChairId] = useState<string | null>(null);

  // Find my player id
  const myPlayer = players.find(p => p.name === name && p.color === color);
  const myId = myPlayer?.id || '';
  const currentChannel = getCurrentChannel(playerPosition);

  // Find closest room and merge meeting info from roomsState
  const closestRoomDef = getClosestRoom(playerPosition);
  let closestRoom = closestRoomDef;
  if (closestRoomDef && roomsState[closestRoomDef.name] && roomsState[closestRoomDef.name].meeting) {
    closestRoom = { ...closestRoomDef, meeting: roomsState[closestRoomDef.name].meeting };
  }

  // Voice chat hook
  const { isMuted, toggleMute, muteMap } = useVoiceChat({
    myId,
    myName: name || '',
    myPosition: playerPosition,
    currentChannel,
    players,
  });

  // Show dialog for closest room if in proximity
  useEffect(() => {
    if (!name) return;
    if (closestRoom && dialogRoom !== closestRoom) setDialogRoom(closestRoom);
    if (!closestRoom && dialogRoom) setDialogRoom(null);
  }, [playerPosition, name, roomsState]);

  // Snap to chair if near and space pressed
  useEffect(() => {
    function handleSpace(e: KeyboardEvent) {
      if (e.code === 'Space' && myPlayer) {
        // Only in Room 101
        const inRoom101 = getCurrentChannel(playerPosition) === 'Room 101';
        if (!inRoom101) return;
        // Find closest chair
        const chairPositions = [
          [room101x - 1.1, 0.2, room101z - 0.7],
          [room101x - 1.1, 0.2, room101z - 0.2],
          [room101x - 1.1, 0.2, room101z + 0.2],
          [room101x - 1.1, 0.2, room101z + 0.7],
          [room101x + 1.1, 0.2, room101z - 0.7],
          [room101x + 1.1, 0.2, room101z - 0.2],
          [room101x + 1.1, 0.2, room101z + 0.2],
          [room101x + 1.1, 0.2, room101z + 0.7],
        ];
        let minDist = Infinity;
        let closestIdx = -1;
        for (let i = 0; i < chairPositions.length; i++) {
          const [cx, cy, cz] = chairPositions[i];
          const dx = playerPosition[0] - cx;
          const dz = playerPosition[2] - cz;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 0.7 && dist < minDist) {
            minDist = dist;
            closestIdx = i;
          }
        }
        if (closestIdx !== -1) {
          setSnappedChairId(snappedChairId === `room101-chair-${closestIdx}` ? null : `room101-chair-${closestIdx}`);
        }
      }
    }
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  }, [playerPosition, myPlayer, snappedChairId]);

  // If snapped, override player position
  let effectivePlayerPosition = playerPosition;
  if (snappedChairId && getCurrentChannel(playerPosition) === 'Room 101') {
    const idx = parseInt(snappedChairId.replace('room101-chair-', ''));
    const chairPositions = [
      [room101x - 1.1, 0.2, room101z - 0.7],
      [room101x - 1.1, 0.2, room101z - 0.2],
      [room101x - 1.1, 0.2, room101z + 0.2],
      [room101x - 1.1, 0.2, room101z + 0.7],
      [room101x + 1.1, 0.2, room101z - 0.7],
      [room101x + 1.1, 0.2, room101z - 0.2],
      [room101x + 1.1, 0.2, room101z + 0.2],
      [room101x + 1.1, 0.2, room101z + 0.7],
    ];
    effectivePlayerPosition = chairPositions[idx] as [number, number, number];
  }

  const wallData = getDynamicWallData(roomsState, myId);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {!name && <NameModal onSubmit={setName} />}
      {dialogRoom && <RoomDialog room={dialogRoom} onClose={() => setDialogRoom(null)} players={players} myId={myId} socketRef={socketRef} name={name} />}
      {/* Mute/unmute button */}
      {name && (
        <button
          onClick={toggleMute}
          style={{ position: 'fixed', top: 24, right: 24, zIndex: 3000, fontSize: 22, padding: '10px 22px', borderRadius: 8, background: isMuted ? '#eee' : '#cceedd', border: '1px solid #aaa', fontWeight: 600 }}
        >
          {isMuted ? 'Unmute 🔇' : 'Mute 🎤'}
        </button>
      )}
      <Canvas shadows>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <FollowCamera target={effectivePlayerPosition} />
        <Office wallData={wallData} />
        <Furniture onChairSnap={setSnappedChairId} snappedChairId={snappedChairId} playerId={myId} />
        {/* Render all players */}
        {players.map((p) => (
          <PlayerBox key={p.id} position={p.id === myId ? effectivePlayerPosition : p.position} color={p.color} name={p.name + (muteMap[p.id] ? ' 🔇' : '')} />
        ))}
      </Canvas>
    </div>
  );
}

export default App;
