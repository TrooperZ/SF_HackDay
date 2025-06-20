import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, useTexture } from '@react-three/drei';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import { Html } from '@react-three/drei';
import { useTextChat } from './useVoiceChat';

// 1. Wall data for rendering and collision
const ROOM_OFFSET = 12; // Distance between room centers (was ~6, now doubled)
const ROOM_SIZE = 5; // Room width/height (for reference)
const WALL_HEIGHT = 2;
const WALL_THICKNESS = 0.25;
const OFFICE_HALF = ROOM_OFFSET + ROOM_SIZE + 2; // For perimeter
const AUDITORIUM_OFFSET_X = -ROOM_OFFSET - 14; // further left
const AUDITORIUM_OFFSET_Z = -ROOM_OFFSET + 2; // further north
const AUDITORIUM_SIZE_X = 14;
const AUDITORIUM_SIZE_Z = 18;
const AUDITORIUM_WALLS = [
  // North wall
  { pos: [AUDITORIUM_OFFSET_X, 1, AUDITORIUM_OFFSET_Z - AUDITORIUM_SIZE_Z / 2] as [number, number, number], size: [AUDITORIUM_SIZE_X, WALL_HEIGHT, WALL_THICKNESS] as [number, number, number] },
  // South wall
  { pos: [AUDITORIUM_OFFSET_X, 1, AUDITORIUM_OFFSET_Z + AUDITORIUM_SIZE_Z / 2] as [number, number, number], size: [AUDITORIUM_SIZE_X, WALL_HEIGHT, WALL_THICKNESS] as [number, number, number] },
  // West wall
  { pos: [AUDITORIUM_OFFSET_X - AUDITORIUM_SIZE_X / 2, 1, AUDITORIUM_OFFSET_Z] as [number, number, number], size: [WALL_THICKNESS, WALL_HEIGHT, AUDITORIUM_SIZE_Z] as [number, number, number] },
  // East wall
  { pos: [AUDITORIUM_OFFSET_X + AUDITORIUM_SIZE_X / 2, 1, AUDITORIUM_OFFSET_Z + 2] as [number, number, number], size: [WALL_THICKNESS, WALL_HEIGHT, AUDITORIUM_SIZE_Z] as [number, number, number] },
  // Door gap (south wall, center)
  // We'll leave a gap in the south wall for the entrance
  // Remove a segment from the south wall for the door
];
const WALL_DATA: { pos: [number, number, number]; size: [number, number, number] }[] = [
  // Perimeter walls (rectangle)
  { pos: [0, 1, -OFFICE_HALF], size: [OFFICE_HALF * 2, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [OFFICE_HALF/2 + 0.75, 1, OFFICE_HALF], size: [OFFICE_HALF - 1.5, WALL_HEIGHT, WALL_THICKNESS] }, // South Segment 1
  { pos: [-OFFICE_HALF/2 - 0.75, 1, OFFICE_HALF], size: [OFFICE_HALF - 1.5, WALL_HEIGHT, WALL_THICKNESS] }, // South Segment 2
  { pos: [-OFFICE_HALF, 1, 1], size: [WALL_THICKNESS, WALL_HEIGHT, OFFICE_HALF * 2 - 2] }, // West Segment 1
  { pos: [OFFICE_HALF, 1, 0], size: [WALL_THICKNESS, WALL_HEIGHT, OFFICE_HALF * 2] }, // East

  // Top left: Break room
  { pos: [-ROOM_OFFSET - 2, 1, -ROOM_OFFSET - 4], size: [5.25, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [-ROOM_OFFSET - 4.5, 1, -ROOM_OFFSET + 0.63], size: [WALL_THICKNESS, WALL_HEIGHT, 9] }, // West
  { pos: [-ROOM_OFFSET - 2, 1, -ROOM_OFFSET + 5], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [-ROOM_OFFSET + 0.5, 1, -ROOM_OFFSET + 4], size: [WALL_THICKNESS, WALL_HEIGHT, 2.2] }, // Lower segment
  { pos: [-ROOM_OFFSET + 0.5, 1, -ROOM_OFFSET - 2.5], size: [WALL_THICKNESS, WALL_HEIGHT, 3] }, // Upper segment

  // Top center: Meeting room (Room 101)
  { pos: [0, 1, -ROOM_OFFSET - 5], size: [10, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [-4.88, 1, -ROOM_OFFSET], size: [WALL_THICKNESS, WALL_HEIGHT, 10] }, // West
  { pos: [4.88, 1, -ROOM_OFFSET], size: [WALL_THICKNESS, WALL_HEIGHT, 10] }, // East
  { pos: [-4, 1, -ROOM_OFFSET + 5], size: [2, WALL_HEIGHT, WALL_THICKNESS] }, // South Segment 1
  { pos: [2, 1, -ROOM_OFFSET + 5], size: [6, WALL_HEIGHT, WALL_THICKNESS] }, // South Segment 2

  // Top right: Two small meeting rooms
  // Small Meeting Room A (left)
  { pos: [ROOM_OFFSET - 1.5, 1, -ROOM_OFFSET - 2.5], size: [3, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [ROOM_OFFSET - 3, 1, -ROOM_OFFSET], size: [WALL_THICKNESS, WALL_HEIGHT, 5] }, // West
  { pos: [ROOM_OFFSET, 1, -ROOM_OFFSET], size: [WALL_THICKNESS, WALL_HEIGHT, 5] }, // East (shared wall)
  { pos: [ROOM_OFFSET - 2.5, 1, -ROOM_OFFSET + 2.5], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap south
  { pos: [ROOM_OFFSET -0.5, 1, -ROOM_OFFSET + 2.5], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap south

  // Small Meeting Room B (right)
   { pos: [ROOM_OFFSET + 1.5, 1, -ROOM_OFFSET - 2.5], size: [3, WALL_HEIGHT, WALL_THICKNESS] }, // North
   { pos: [ROOM_OFFSET, 1, -ROOM_OFFSET], size: [WALL_THICKNESS, WALL_HEIGHT, 5] }, // West (shared wall)
  { pos: [ROOM_OFFSET + 3, 1, -ROOM_OFFSET], size: [WALL_THICKNESS, WALL_HEIGHT, 5] }, // East
  { pos: [ROOM_OFFSET + 0.5, 1, -ROOM_OFFSET + 2.5], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap south
  { pos: [ROOM_OFFSET + 2.5, 1, -ROOM_OFFSET + 2.5], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap south

  // Middle left: Medium meeting room (longer)

  { pos: [-ROOM_OFFSET - 2.5, 1, 0], size: [WALL_THICKNESS, WALL_HEIGHT, 7] }, // West
  { pos: [-ROOM_OFFSET, 1, 3.5], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [-ROOM_OFFSET + 2.5, 1, 0], size: [WALL_THICKNESS, WALL_HEIGHT, 7] }, // East
  { pos: [-ROOM_OFFSET - 2, 1, -3.5], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap north
  { pos: [-ROOM_OFFSET + 2, 1, -3.5], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap north

  // Center: No walls (open lounge area)

  // Middle right: Medium meeting room (longer)
  { pos: [ROOM_OFFSET - 2.5, 1, 0], size: [WALL_THICKNESS, WALL_HEIGHT, 7] }, // West
  { pos: [ROOM_OFFSET, 1, 3.5], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // South
  { pos: [ROOM_OFFSET + 2.5, 1, 0], size: [WALL_THICKNESS, WALL_HEIGHT, 7] }, // East
  { pos: [ROOM_OFFSET - 2, 1, -3.5], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap north
  { pos: [ROOM_OFFSET + 2, 1, -3.5], size: [1, WALL_HEIGHT, WALL_THICKNESS] }, // Door gap north

  // Bottom left: Cubicles
  { pos: [-ROOM_OFFSET, 1, ROOM_OFFSET], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [-ROOM_OFFSET, 1, ROOM_OFFSET], size: [WALL_THICKNESS, WALL_HEIGHT, 5] }, // East

  // Bottom right: Cubicles
  { pos: [ROOM_OFFSET, 1, ROOM_OFFSET ], size: [5, WALL_HEIGHT, WALL_THICKNESS] }, // North
  { pos: [ROOM_OFFSET , 1, ROOM_OFFSET], size: [WALL_THICKNESS, WALL_HEIGHT, 5] }, // West
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

// Security station and revolving door
function SecurityStation({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Booth */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.2, 1, 1.2]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
      {/* Desk */}
      <mesh position={[0, 0.8, -0.3]}>
        <boxGeometry args={[1.2, 0.2, 0.5]} />
        <meshStandardMaterial color="#b88c5a" />
      </mesh>
      {/* Monitor */}
      <mesh position={[0, 1, -0.45]}>
        <boxGeometry args={[0.4, 0.25, 0.05]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    </group>
  );
}

function RevolvingDoor({ position, playerPosition }: { position: [number, number, number], playerPosition: [number, number, number] }) {
  const [rotating, setRotating] = useState(false);
  const [angle, setAngle] = useState(0);
  // Animate rotation when player is near
  useEffect(() => {
    const dx = playerPosition[0] - position[0];
    const dz = playerPosition[2] - position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 2) {
      setRotating(true);
    } else {
      setRotating(false);
    }
  }, [playerPosition, position]);
  useEffect(() => {
    if (!rotating) return;
    let raf: number;
    function animate() {
      setAngle(a => (a + 0.08) % (Math.PI * 2));
      raf = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(raf);
  }, [rotating]);
  // Four panels
  return (
    <group position={position}>
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
        <mesh key={i} position={[Math.sin(a + angle) * 0.5, 1, Math.cos(a + angle) * 0.5]} rotation={[0, a + angle, 0]}>
          <boxGeometry args={[0.1, 2, 1]} />
          <meshStandardMaterial color="#e31837" opacity={0.85} transparent />
        </mesh>
      ))}
    </group>
  );
}

// In App, add revolving door collision logic
function usePlayerMovement(disabled = false, revolvingDoorOpen = false, wallData: { pos: [number, number, number]; size: [number, number, number] }[]) {
  const [position, setPosition] = useState<[number, number, number]>([0, 0.5, OFFICE_HALF + 4]);
  const velocity = useRef<[number, number]>([0, 0]); // [vx, vz]
  const keys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (disabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      // Prevent movement if typing in an input, textarea, or contenteditable
      const active = document.activeElement;
      if (
        active && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as HTMLElement).isContentEditable
        )
      ) {
        return;
      }
      keys.current[e.key.toLowerCase()] = true;
    }
    function handleKeyUp(e: KeyboardEvent) {
      const active = document.activeElement;
      if (
        active && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as HTMLElement).isContentEditable
        )
      ) {
        return;
      }
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
        for (const wall of wallData) {
          // Skip collision for revolving door area if open
          if (revolvingDoorOpen &&
            Math.abs(wall.pos[0]) < 0.2 &&
            Math.abs(wall.pos[2] - OFFICE_HALF) < 1.2) {
            continue;
          }
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
  }, [disabled, revolvingDoorOpen, wallData]);

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
function Chair({ position, color = "#e31837" }: { position: [number, number, number], color?: string }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshStandardMaterial color={color} />
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
function Couch({ position, color = "#e31837" }: { position: [number, number, number], color?: string }) {
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.6, 0.4, 0.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.5, -0.25]} castShadow>
        <boxGeometry args={[1.6, 0.5, 0.2]} />
        <meshStandardMaterial color="#2a3a4c" />
      </mesh>
      {/* Armrests */}
      <mesh position={[-0.7, 0.35, 0]} castShadow>
        <boxGeometry args={[0.2, 0.5, 0.6]} />
        <meshStandardMaterial color="#2a3a4c" />
      </mesh>
      <mesh position={[0.7, 0.35, 0]} castShadow>
        <boxGeometry args={[0.2, 0.5, 0.6]} />
        <meshStandardMaterial color="#2a3a4c" />
      </mesh>
    </group>
  );
}

// State Farm Logo component
function StateFarmLogo({ position }: { position: [number, number, number] }) {
  const texture = useTexture('/SFLOGO.png');
  
  return (
    <group position={position}>
      {/* Flat logo using image texture */}
      <mesh position={[0, 0.5, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 4  ]} />
        <meshStandardMaterial 
          map={texture} 
          transparent 
          opacity={0.9}
          alphaTest={0.1}
          depthWrite={false}
        />
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

  // Auditorium (top left extension)
  const audX = AUDITORIUM_OFFSET_X;
  const audZ = AUDITORIUM_OFFSET_Z;
  // Stage
  const stagePos: [number, number, number] = [audX, 0.15, audZ - AUDITORIUM_SIZE_Z / 2 + 1];
  // Auditorium seating (5 rows, 8 seats per row, curved)
  const rows = 5;
  const seatsPerRow = 8;
  const seatRadius = 3.5;
  const seatAngleStart = -Math.PI / 3;
  const seatAngleEnd = Math.PI / 3;
  const seatRows: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) {
    const radius = seatRadius + r * 0.7;
    for (let s = 0; s < seatsPerRow; s++) {
      const angle = seatAngleStart + (seatAngleEnd - seatAngleStart) * (s / (seatsPerRow - 1));
      const x = audX + Math.sin(angle) * radius;
      const z = audZ + 2 + Math.cos(angle) * radius;
      seatRows.push([x, 0.2, z]);
    }
  }

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

      {/* Small Meeting Room A (top right, left side) */}
      <Table position={[ROOM_OFFSET - 1.5, 0.2, -ROOM_OFFSET]} size={[1.2, 0.2, 1.2]} />
      <Chair position={[ROOM_OFFSET - 1.5, 0.2, -ROOM_OFFSET - 1.2]} />
      <Chair position={[ROOM_OFFSET - 0.8, 0.2, -ROOM_OFFSET]} />
      <Chair position={[ROOM_OFFSET - 1.5, 0.2, -ROOM_OFFSET + 1.2]} />
      <Chair position={[ROOM_OFFSET - 2.2, 0.2, -ROOM_OFFSET]} />

      {/* Small Meeting Room B (top right, right side) */}
      <Table position={[ROOM_OFFSET + 1.5, 0.2, -ROOM_OFFSET]} size={[1.2, 0.2, 1.2]} />
      <Chair position={[ROOM_OFFSET + 1.5, 0.2, -ROOM_OFFSET - 1.2]} />
      <Chair position={[ROOM_OFFSET + 2.2, 0.2, -ROOM_OFFSET]} />
      <Chair position={[ROOM_OFFSET + 1.5, 0.2, -ROOM_OFFSET + 1.2]} />
      <Chair position={[ROOM_OFFSET + 0.8, 0.2, -ROOM_OFFSET]} />

      {/* Medium Meeting Room Left */}
      <Table position={[-ROOM_OFFSET, 0.2, 0]} size={[1.2, 0.2, 4]} />
      {/* 1-4-4-1 chair arrangement (longer) */}
      <Chair position={[-ROOM_OFFSET, 0.2, -2]} />
      <Chair position={[-ROOM_OFFSET - 1.2, 0.2, -1]} />
      <Chair position={[-ROOM_OFFSET - 1.2, 0.2, -0.5]} />
      <Chair position={[-ROOM_OFFSET - 1.2, 0.2, 0]} />
      <Chair position={[-ROOM_OFFSET - 1.2, 0.2, 0.5]} />
      <Chair position={[-ROOM_OFFSET + 1.2, 0.2, -1]} />
      <Chair position={[-ROOM_OFFSET + 1.2, 0.2, -0.5]} />
      <Chair position={[-ROOM_OFFSET + 1.2, 0.2, 0]} />
      <Chair position={[-ROOM_OFFSET + 1.2, 0.2, 0.5]} />
      <Chair position={[-ROOM_OFFSET, 0.2, 2]} />

      {/* Center Lounge - 4 couches and a table */}
      <Table position={[0, 0.2, 0]} size={[1.2, 0.2, 1.2]} />
      <Couch position={[-2, 0.2, 0]} />
      <Couch position={[2, 0.2, 0]} />
      <Couch position={[0, 0.2, -2]} />
      <Couch position={[0, 0.2, 2]} />

      {/* Medium Meeting Room Right */}
      <Table position={[ROOM_OFFSET, 0.2, 0]} size={[1.2, 0.2, 4]} />
      {/* 1-4-4-1 chair arrangement (longer) */}
      <Chair position={[ROOM_OFFSET, 0.2, -2]} />
      <Chair position={[ROOM_OFFSET - 1.2, 0.2, -1]} />
      <Chair position={[ROOM_OFFSET - 1.2, 0.2, -0.5]} />
      <Chair position={[ROOM_OFFSET - 1.2, 0.2, 0]} />
      <Chair position={[ROOM_OFFSET - 1.2, 0.2, 0.5]} />
      <Chair position={[ROOM_OFFSET + 1.2, 0.2, -1]} />
      <Chair position={[ROOM_OFFSET + 1.2, 0.2, -0.5]} />
      <Chair position={[ROOM_OFFSET + 1.2, 0.2, 0]} />
      <Chair position={[ROOM_OFFSET + 1.2, 0.2, 0.5]} />
      <Chair position={[ROOM_OFFSET, 0.2, 2]} />

      {/* Cubicles Left - 4 cubicles */}
      <Desk position={[-ROOM_OFFSET - 1.5, 0.2, ROOM_OFFSET - 1.5]} />
      <Computer position={[-ROOM_OFFSET - 1.5, 0.45, ROOM_OFFSET - 1.3]} />
      <Chair position={[-ROOM_OFFSET - 1.5, 0.2, ROOM_OFFSET - 0.8]} />
      
      <Desk position={[-ROOM_OFFSET + 1.5, 0.2, ROOM_OFFSET - 1.5]} />
      <Computer position={[-ROOM_OFFSET + 1.5, 0.45, ROOM_OFFSET - 1.3]} />
      <Chair position={[-ROOM_OFFSET + 1.5, 0.2, ROOM_OFFSET - 0.8]} />
      
      <Desk position={[-ROOM_OFFSET - 1.5, 0.2, ROOM_OFFSET + 1.5]} />
      <Computer position={[-ROOM_OFFSET - 1.5, 0.45, ROOM_OFFSET + 1.7]} />
      <Chair position={[-ROOM_OFFSET - 1.5, 0.2, ROOM_OFFSET + 0.5]} />
      
      <Desk position={[-ROOM_OFFSET + 1.5, 0.2, ROOM_OFFSET + 1.5]} />
      <Computer position={[-ROOM_OFFSET + 1.5, 0.45, ROOM_OFFSET + 1.7]} />
      <Chair position={[-ROOM_OFFSET + 1.5, 0.2, ROOM_OFFSET + 0.5]} />

      {/* Cubicles Right - 4 cubicles */}
      <Desk position={[ROOM_OFFSET - 1.5, 0.2, ROOM_OFFSET - 1.5]} />
      <Computer position={[ROOM_OFFSET - 1.5, 0.45, ROOM_OFFSET - 1.3]} />
      <Chair position={[ROOM_OFFSET - 1.5, 0.2, ROOM_OFFSET - 0.8]} />
      
      <Desk position={[ROOM_OFFSET + 1.5, 0.2, ROOM_OFFSET - 1.5]} />
      <Computer position={[ROOM_OFFSET + 1.5, 0.45, ROOM_OFFSET - 1.3]} />
      <Chair position={[ROOM_OFFSET + 1.5, 0.2, ROOM_OFFSET - 0.8]} />
      
      <Desk position={[ROOM_OFFSET - 1.5, 0.2, ROOM_OFFSET + 1.5]} />
      <Computer position={[ROOM_OFFSET - 1.5, 0.45, ROOM_OFFSET + 1.7]} />
      <Chair position={[ROOM_OFFSET - 1.5, 0.2, ROOM_OFFSET + 0.5]} />
      
      <Desk position={[ROOM_OFFSET + 1.5, 0.2, ROOM_OFFSET + 1.5]} />
      <Computer position={[ROOM_OFFSET + 1.5, 0.45, ROOM_OFFSET + 1.7]} />
      <Chair position={[ROOM_OFFSET + 1.5, 0.2, ROOM_OFFSET + 0.5]} />

      {/* Auditorium stage */}
      <mesh position={stagePos}>
        <boxGeometry args={[6, 0.3, 1.5]} />
        <meshStandardMaterial color="#b85a5a" />
      </mesh>
      {/* Auditorium seats */}
      {seatRows.map((pos, i) => (
        <Chair key={`auditorium-seat-${i}`} position={pos as [number, number, number]} />
      ))}
    </>
  );
}

// In App, compute dynamic wall data for Room 101 based on meeting privacy and participant status
function getDynamicWallData(roomsState: Record<string, any>, myId: string): { pos: [number, number, number]; size: [number, number, number] }[] {
  let wallData = [...WALL_DATA];
  // Add auditorium walls
  wallData = wallData.concat(AUDITORIUM_WALLS);
  
  // Add left and right segments for the south wall, leaving a gap in the middle
  wallData.push({ pos: [AUDITORIUM_OFFSET_X - 2, 1, AUDITORIUM_OFFSET_Z + AUDITORIUM_SIZE_Z / 2] as [number, number, number], size: [6, WALL_HEIGHT, WALL_THICKNESS] as [number, number, number] }); // left segment
  wallData.push({ pos: [AUDITORIUM_OFFSET_X + 2, 1, AUDITORIUM_OFFSET_Z + AUDITORIUM_SIZE_Z / 2] as [number, number, number], size: [6, WALL_HEIGHT, WALL_THICKNESS] as [number, number, number] }); // right segment
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
    wallData.push({ pos: doorGapPos as [number, number, number], size: doorGapSize as [number, number, number] });
  } else {
    // Door should be open: add the gap segment (no wall)
    // (In Three.js, a gap means no wall, so we do NOT add a wall segment here)
    // If you want a visual door frame, you can add a thin frame here
    // But for now, do nothing (leave the gap open)
  }
  return wallData;
}

function Office({ wallData }: { wallData: { pos: [number, number, number]; size: [number, number, number] }[] }) {
  const wallColor = '#e31837'; // State Farm red
  // Calculate bounds to cover both office and auditorium
  const minX = Math.min(-OFFICE_HALF, AUDITORIUM_OFFSET_X - AUDITORIUM_SIZE_X / 2) - 1;
  const maxX = Math.max(OFFICE_HALF, AUDITORIUM_OFFSET_X + AUDITORIUM_SIZE_X / 2) + 1;
  const minZ = Math.min(-OFFICE_HALF, AUDITORIUM_OFFSET_Z - AUDITORIUM_SIZE_Z / 2) - 1;
  const maxZ = Math.max(OFFICE_HALF, AUDITORIUM_OFFSET_Z + AUDITORIUM_SIZE_Z / 2) + 1;
  const floorWidth = maxX - minX;
  const floorDepth = maxZ - minZ;
  const floorCenterX = (minX + maxX) / 2;
  const floorCenterZ = (minZ + maxZ) / 2;
  return (
    <>
      {/* Floor - extended to cover auditorium and office */}
      <mesh receiveShadow position={[floorCenterX, 0, floorCenterZ]}>
        <boxGeometry args={[floorWidth, 0.1, floorDepth]} />
        <meshStandardMaterial color="#ffffff" /> {/* State Farm white */}
      </mesh>
      {wallData.map((wall, i) => (
        <mesh position={wall.pos} key={i}>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      ))}
      
      {/* State Farm Logo in front of entrance */}
      <StateFarmLogo position={[0, 0, OFFICE_HALF - 4]} />
      
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
      <form onSubmit={e => { e.preventDefault(); if (input.trim()) onSubmit(input.trim()); }} style={{ background: '#fff', padding: 32, borderRadius: 12, color: '#000' }}>
        <h2 style={{ color: '#000' }}>Enter your name</h2>
        <input autoFocus value={input} onChange={e => setInput(e.target.value)} style={{ fontSize: 20, padding: 8, borderRadius: 6, border: '1px solid #ccc', color: '#fff', background: '#333' }} />
        <button type="submit" style={{ marginLeft: 16, fontSize: 20, padding: '8px 16px', borderRadius: 6, color: '#fff', background: '#007bff', border: 'none' }}>Join</button>
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
    const socket = io('sfhackday-production.up.railway.app');
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
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.7, 1, 0.7]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Name label */}
      <Html position={[0, 0, -0.75]} center style={{ pointerEvents: 'none', fontWeight: 'bold', color: '#222', background: 'rgba(255,255,255,0.8)', padding: '1px 6px', borderRadius: 5, fontSize: 13 }}>{name}</Html>
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
    name: 'Small Meeting Room A',
    center: [ROOM_OFFSET - 1.5, 0, -ROOM_OFFSET],
    entrance: [ROOM_OFFSET - 1.5, 0, -ROOM_OFFSET + 5],
    type: 'meeting',
  },
  {
    name: 'Small Meeting Room B',
    center: [ROOM_OFFSET + 1.5, 0, -ROOM_OFFSET],
    entrance: [ROOM_OFFSET + 1.5, 0, -ROOM_OFFSET + 5],
    type: 'meeting',
  },
  {
    name: 'Medium Meeting Room Left',
    center: [-ROOM_OFFSET, 0, 0],
    entrance: [-ROOM_OFFSET, 0, -3.5],
    type: 'meeting',
  },
  {
    name: 'Center Lounge',
    center: [0, 0, 0],
    entrance: [0, 0, 8],
    type: 'lounge',
  },
  {
    name: 'Medium Meeting Room Right',
    center: [ROOM_OFFSET, 0, 0],
    entrance: [ROOM_OFFSET, 0, -3.5],
    type: 'meeting',
  },
  {
    name: 'Cubicles Left',
    center: [-ROOM_OFFSET, 0, ROOM_OFFSET],
    entrance: [-ROOM_OFFSET, 0, ROOM_OFFSET + 5],
    type: 'cubicles',
  },
  {
    name: 'Cubicles Right',
    center: [ROOM_OFFSET, 0, ROOM_OFFSET],
    entrance: [ROOM_OFFSET, 0, ROOM_OFFSET + 5],
    type: 'cubicles',
  },
  {
    name: 'Auditorium',
    center: [AUDITORIUM_OFFSET_X, 0, AUDITORIUM_OFFSET_Z],
    entrance: [AUDITORIUM_OFFSET_X, 0, AUDITORIUM_OFFSET_Z + AUDITORIUM_SIZE_Z / 2],
    type: 'auditorium',
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

function RoomDialog({ room, onClose, players, myId, socketRef, name, onTeleport }: { room: any, onClose: () => void, players: any[], myId: string, socketRef: any, name: string, onTeleport?: (pos: [number, number, number]) => void }) {
  const [meetingName, setMeetingName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinRequest, setJoinRequest] = useState<{ userId: string, user: any } | null>(null);
  const meeting = room.meeting;
  const isOwner = meeting && meeting.ownerId === myId;
  const isParticipant = meeting && meeting.participants && meeting.participants.includes(myId);
  const hasRequested = meeting && meeting.joinRequests && meeting.joinRequests.includes(myId);
  // Knock sound
  const knockAudioRef = useRef<HTMLAudioElement>(null);

  // Listen for join request (if owner)
  useEffect(() => {
    if (!socketRef.current) return;
    function onJoinRequest({ roomName, userId, user }: { roomName: string, userId: string, user: any }) {
      if (roomName === room.name) {
        setJoinRequest({ userId, user });
        if (knockAudioRef.current) {
          knockAudioRef.current.currentTime = 0;
          knockAudioRef.current.play();
        }
      }
    }
    socketRef.current.on('join-request', onJoinRequest);
    return () => socketRef.current.off('join-request', onJoinRequest);
  }, [room.name, socketRef]);

  // Listen for join-approved (if participant)
  useEffect(() => {
    if (!socketRef.current) return;
    function onJoinApproved({ roomName }: { roomName: string }) {
      if (roomName === room.name && onTeleport) {
        // Teleport inside: set position to room center
        const center = room.center || [0, 0, 0];
        onTeleport([center[0], 0.5, center[2]]);
      }
    }
    socketRef.current.on('join-approved', onJoinApproved);
    return () => socketRef.current.off('join-approved', onJoinApproved);
  }, [room.name, socketRef, onTeleport, room.center]);

  // Listen for kicked event (if participant)
  useEffect(() => {
    if (!socketRef.current) return;
    function onKicked({ roomName }: { roomName: string }) {
      if (roomName === room.name && onTeleport) {
        // Teleport outside: set position to just outside entrance
        const entrance = room.entrance || [0, 0, 0];
        const out = [entrance[0], 0.5, entrance[2] + 2];
        onTeleport(out as [number, number, number]);
      }
    }
    socketRef.current.on('kicked', onKicked);
    return () => socketRef.current.off('kicked', onKicked);
  }, [room.name, socketRef, onTeleport, room.entrance]);

  // Listen for end-meeting (if participant)
  useEffect(() => {
    if (!socketRef.current) return;
    function onEndMeeting({ roomName }: { roomName: string }) {
      if (roomName === room.name && onTeleport) {
        // Teleport outside: set position to just outside entrance
        const entrance = room.entrance || [0, 0, 0];
        const out = [entrance[0], 0.5, entrance[2] + 2];
        onTeleport(out as [number, number, number]);
      }
    }
    socketRef.current.on('end-meeting', onEndMeeting);
    return () => socketRef.current.off('end-meeting', onEndMeeting);
  }, [room.name, socketRef, onTeleport, room.entrance]);

  // Listen for leave-meeting (self)
  useEffect(() => {
    if (!socketRef.current) return;
    function onLeaveMeeting({ roomName, userId }: { roomName: string, userId: string }) {
      if (roomName === room.name && userId === myId && onTeleport) {
        const entrance = room.entrance || [0, 0, 0];
        const out = [entrance[0], 0.5, entrance[2] + 2];
        onTeleport(out as [number, number, number]);
      }
    }
    socketRef.current.on('leave-meeting', onLeaveMeeting);
    return () => socketRef.current.off('leave-meeting', onLeaveMeeting);
  }, [room.name, socketRef, onTeleport, room.entrance, myId]);

  // Meeting creation form
  if (!meeting && room.type === 'meeting') {
    return (
      <div style={{ position: 'fixed', left: '50%', top: 80, transform: 'translateX(-50%)', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002', padding: 32, minWidth: 340, zIndex: 2000, color: '#000' }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#000' }}> {room.name} </h2>
        <form onSubmit={e => { e.preventDefault(); socketRef.current.emit('start-meeting', { roomName: room.name, meetingName, isPrivate }); }}>
          <div style={{ margin: '18px 0 8px 0', fontWeight: 600, color: '#000' }}>Start a Meeting</div>
          <input value={meetingName} onChange={e => setMeetingName(e.target.value)} placeholder="Meeting name" style={{ fontSize: 20, padding: 8, borderRadius: 6, border: '1px solid #ccc', width: '100%', color: '#fff', background: '#333' }} />
          {room.name !== 'Auditorium' && (
            <label style={{ display: 'block', margin: '12px 0', color: '#000' }}>
              <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} /> Private meeting (door closes)
            </label>
          )}
          <button type="submit" style={{ fontSize: 20, padding: '8px 16px', borderRadius: 6, marginTop: 8, color: '#fff', background: '#007bff', border: 'none' }}>Start Meeting</button>
        </form>
        <button style={{ position: 'absolute', top: 8, right: 12, fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#000' }} onClick={onClose}>×</button>
        {/* Knock sound audio element */}
        <audio ref={knockAudioRef} src="https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae3c7.mp3" preload="auto" />
      </div>
    );
  }

  // Break room dialog customization
  if (room.type === 'break') {
    // Find players in the break room (within 4 units of break room center)
    const center = room.center || [0, 0, 0];
    const inBreakRoom = players.filter(p => {
      const dx = p.position[0] - center[0];
      const dz = p.position[2] - center[2];
      return Math.sqrt(dx * dx + dz * dz) < 4;
    });
    return (
      <div style={{ position: 'fixed', left: '50%', top: 80, transform: 'translateX(-50%)', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002', padding: 32, minWidth: 340, zIndex: 2000, color: '#000' }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#000' }}>{room.name}</h2>
        <div style={{ margin: '12px 0 8px 0', fontWeight: 500, color: '#000' }}>Who's in the break room?</div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 16, overflowX: 'auto', marginBottom: 12 }}>
          {inBreakRoom.length === 0 ? (
            <div style={{ color: '#888', fontStyle: 'italic' }}>No one is here right now.</div>
          ) : (
            inBreakRoom.map((p) => (
              <div key={p.id} style={{ background: '#f0f0f0', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 18, color: '#000' }}>{p.name}</div>
            ))
          )}
        </div>
        <button style={{ position: 'absolute', top: 8, right: 12, fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#000' }} onClick={onClose}>×</button>
      </div>
    );
  }

  // Lounge dialog customization
  if (room.type === 'lounge') {
    // Find players in the lounge (within 4 units of lounge center)
    const center = room.center || [0, 0, 0];
    const inLounge = players.filter(p => {
      const dx = p.position[0] - center[0];
      const dz = p.position[2] - center[2];
      return Math.sqrt(dx * dx + dz * dz) < 4;
    });
    return (
      <div style={{ position: 'fixed', left: '50%', top: 80, transform: 'translateX(-50%)', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002', padding: 32, minWidth: 340, zIndex: 2000, color: '#000' }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#000' }}>{room.name}</h2>
        <div style={{ margin: '12px 0 8px 0', fontWeight: 500, color: '#000' }}>Who's in the lounge?</div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 16, overflowX: 'auto', marginBottom: 12 }}>
          {inLounge.length === 0 ? (
            <div style={{ color: '#888', fontStyle: 'italic' }}>No one is here right now.</div>
          ) : (
            inLounge.map((p) => (
              <div key={p.id} style={{ background: '#f0f0f0', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 18, color: '#000' }}>{p.name}</div>
            ))
          )}
        </div>
        <button style={{ position: 'absolute', top: 8, right: 12, fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#000' }} onClick={onClose}>×</button>
      </div>
    );
  }

  // Cubicles dialog customization
  if (room.type === 'cubicles') {
    return (
      <div style={{ position: 'fixed', left: '50%', top: 80, transform: 'translateX(-50%)', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002', padding: 32, minWidth: 340, zIndex: 2000, color: '#000' }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#000' }}>{room.name}</h2>
        <div style={{ margin: '12px 0 8px 0', fontWeight: 500, color: '#000' }}>Individual cubicle workspaces</div>
        <div style={{ marginBottom: 12, color: '#000' }}>Each cubicle has its own chat channel. Move to a cubicle to join its private chat.</div>
        <button style={{ position: 'absolute', top: 8, right: 12, fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#000' }} onClick={onClose}>×</button>
      </div>
    );
  }

  // Auditorium dialog customization
  if (room.type === 'auditorium') {
    return (
      <div style={{ position: 'fixed', left: '50%', top: 80, transform: 'translateX(-50%)', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002', padding: 32, minWidth: 340, zIndex: 2000, color: '#000' }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#000' }}>{room.name}</h2>
        <div style={{ margin: '12px 0 8px 0', fontWeight: 500, color: '#000' }}>Large presentation space</div>
        <div style={{ marginBottom: 12, color: '#000' }}>Perfect for presentations and large meetings. No private meetings available.</div>
        {!meeting && (
          <form onSubmit={e => { e.preventDefault(); socketRef.current.emit('start-meeting', { roomName: room.name, meetingName, isPrivate: false }); }}>
            <div style={{ margin: '18px 0 8px 0', fontWeight: 600, color: '#000' }}>Start a Meeting</div>
            <input value={meetingName} onChange={e => setMeetingName(e.target.value)} placeholder="Meeting name" style={{ fontSize: 20, padding: 8, borderRadius: 6, border: '1px solid #ccc', width: '100%', color: '#fff', background: '#333' }} />
            <button type="submit" style={{ fontSize: 20, padding: '8px 16px', borderRadius: 6, marginTop: 8, color: '#fff', background: '#007bff', border: 'none' }}>Start Meeting</button>
          </form>
        )}
        <button style={{ position: 'absolute', top: 8, right: 12, fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#000' }} onClick={onClose}>×</button>
        {/* Knock sound audio element */}
        <audio ref={knockAudioRef} src="https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae3c7.mp3" preload="auto" />
      </div>
    );
  }

  // Meeting info dialog
  if (meeting) {
    return (
      <div style={{ position: 'fixed', left: '50%', top: 80, transform: 'translateX(-50%)', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002', padding: 32, minWidth: 340, zIndex: 2000, color: '#000' }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#000' }}>{room.name}</h2>
        <div style={{ margin: '12px 0 4px 0', fontWeight: 500, color: '#000' }}>Meeting: {meeting.name}</div>
        <div style={{ marginBottom: 4, color: '#000' }}>Participants: {(meeting.participants as string[]).map((id: string) => {
          const p = players.find((p: any) => p.id === id);
          return (
            <span key={id} style={{ marginRight: 8, color: '#000' }}>
              {p ? p.name : id}
              {isOwner && id !== myId && (
                <button
                  style={{ marginLeft: 8, fontSize: 14, padding: '2px 8px', borderRadius: 6, background: '#e31837', color: '#fff', border: 'none', cursor: 'pointer' }}
                  onClick={() => socketRef.current.emit('kick-user', { roomName: room.name, userId: id })}
                >
                  Kick
                </button>
              )}
            </span>
          );
        })}
        </div>
        <div style={{ marginBottom: 12, color: '#000' }}>Private: {meeting.isPrivate ? 'Yes' : 'No'}</div>
        {isOwner && (
          <>
            <button onClick={() => socketRef.current.emit('end-meeting', { roomName: room.name })} style={{ fontSize: 18, padding: '6px 18px', borderRadius: 6, marginRight: 8, color: '#fff', background: '#dc3545', border: 'none' }}>End Meeting</button>
            <button onClick={() => socketRef.current.emit('update-meeting', { roomName: room.name, meetingName: meeting.name, isPrivate: !meeting.isPrivate })} style={{ fontSize: 18, padding: '6px 18px', borderRadius: 6, color: '#fff', background: '#007bff', border: 'none' }}>{meeting.isPrivate ? 'Make Public' : 'Make Private'}</button>
            {meeting.joinRequests && (meeting.joinRequests as string[]).map((id: string) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                <span style={{ color: '#000' }}>{players.find((p: any) => p.id === id)?.name || id}</span>
                <button onClick={() => socketRef.current.emit('approve-join', { roomName: room.name, userId: id })} style={{ marginLeft: 12, fontSize: 16, padding: '4px 12px', borderRadius: 6, color: '#fff', background: '#28a745', border: 'none' }}>Approve</button>
              </div>
            ))}
          </>
        )}
        {!isOwner && !isParticipant && meeting.isPrivate && !hasRequested && (
          <button onClick={() => socketRef.current.emit('ask-to-join', { roomName: room.name })} style={{ fontSize: 18, padding: '6px 18px', borderRadius: 6, color: '#fff', background: '#007bff', border: 'none' }}>Ask to Join</button>
        )}
        {isParticipant && (
          <button onClick={() => socketRef.current.emit('leave-meeting', { roomName: room.name })} style={{ fontSize: 18, padding: '6px 18px', borderRadius: 6, marginTop: 12, color: '#fff', background: '#6c757d', border: 'none' }}>Leave Meeting</button>
        )}
        <button style={{ position: 'absolute', top: 8, right: 12, fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#000' }} onClick={onClose}>×</button>
        {/* Knock sound audio element */}
        <audio ref={knockAudioRef} src="https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae3c7.mp3" preload="auto" />
      </div>
    );
  }

  // Default: no meeting
  return null;
}

function getCurrentChannel(playerPos: [number, number, number]) {
  // If in break room, use 'Break Room' channel
  const breakRoom = ROOM_DEFS.find(r => r.name === 'Break Room');
  if (breakRoom) {
    const dx = playerPos[0] - breakRoom.center[0];
    const dz = playerPos[2] - breakRoom.center[2];
    if (Math.sqrt(dx * dx + dz * dz) < 4) return 'Break Room';
  }
  
  // If in Room 101, use 'Room 101' channel
  const room101 = ROOM_DEFS.find(r => r.name === 'Room 101');
  if (room101) {
    const dx = playerPos[0] - room101.center[0];
    const dz = playerPos[2] - room101.center[2];
    if (Math.sqrt(dx * dx + dz * dz) < 4) return 'Room 101';
  }
  
  // If in Small Meeting Room A, use 'Small Meeting Room A' channel
  const smallMeetingA = ROOM_DEFS.find(r => r.name === 'Small Meeting Room A');
  if (smallMeetingA) {
    const dx = playerPos[0] - smallMeetingA.center[0];
    const dz = playerPos[2] - smallMeetingA.center[2];
    if (Math.sqrt(dx * dx + dz * dz) < 2) return 'Small Meeting Room A';
  }
  
  // If in Small Meeting Room B, use 'Small Meeting Room B' channel
  const smallMeetingB = ROOM_DEFS.find(r => r.name === 'Small Meeting Room B');
  if (smallMeetingB) {
    const dx = playerPos[0] - smallMeetingB.center[0];
    const dz = playerPos[2] - smallMeetingB.center[2];
    if (Math.sqrt(dx * dx + dz * dz) < 2) return 'Small Meeting Room B';
  }
  
  // If in Medium Meeting Room Left, use 'Medium Meeting Room Left' channel
  const mediumMeetingLeft = ROOM_DEFS.find(r => r.name === 'Medium Meeting Room Left');
  if (mediumMeetingLeft) {
    const dx = playerPos[0] - mediumMeetingLeft.center[0];
    const dz = playerPos[2] - mediumMeetingLeft.center[2];
    if (Math.sqrt(dx * dx + dz * dz) < 4) return 'Medium Meeting Room Left';
  }
  
  // If in Medium Meeting Room Right, use 'Medium Meeting Room Right' channel
  const mediumMeetingRight = ROOM_DEFS.find(r => r.name === 'Medium Meeting Room Right');
  if (mediumMeetingRight) {
    const dx = playerPos[0] - mediumMeetingRight.center[0];
    const dz = playerPos[2] - mediumMeetingRight.center[2];
    if (Math.sqrt(dx * dx + dz * dz) < 4) return 'Medium Meeting Room Right';
  }
  
  // If in Center Lounge, use 'Center Lounge' channel
  const centerLounge = ROOM_DEFS.find(r => r.name === 'Center Lounge');
  if (centerLounge) {
    const dx = playerPos[0] - centerLounge.center[0];
    const dz = playerPos[2] - centerLounge.center[2];
    if (Math.sqrt(dx * dx + dz * dz) < 4) return 'Center Lounge';
  }
  
  // If in Cubicles Left, use 'Cubicles Left' channel
  const cubiclesLeft = ROOM_DEFS.find(r => r.name === 'Cubicles Left');
  if (cubiclesLeft) {
    const dx = playerPos[0] - cubiclesLeft.center[0];
    const dz = playerPos[2] - cubiclesLeft.center[2];
    if (Math.sqrt(dx * dx + dz * dz) < 3) return 'Cubicles Left';
  }
  
  // If in Cubicles Right, use 'Cubicles Right' channel
  const cubiclesRight = ROOM_DEFS.find(r => r.name === 'Cubicles Right');
  if (cubiclesRight) {
    const dx = playerPos[0] - cubiclesRight.center[0];
    const dz = playerPos[2] - cubiclesRight.center[2];
    if (Math.sqrt(dx * dx + dz * dz) < 3) return 'Cubicles Right';
  }
  
  // If in Auditorium, use 'Auditorium' channel
  const auditorium = ROOM_DEFS.find(r => r.name === 'Auditorium');
  if (auditorium) {
    const dx = playerPos[0] - auditorium.center[0];
    const dz = playerPos[2] - auditorium.center[2];
    if (Math.sqrt(dx * dx + dz * dz) < 8) return 'Auditorium';
  }
  
  // Otherwise, use proximity channel
  return 'proximity';
}

// Door component
function Door({ position, isOpen = false }: { position: [number, number, number], isOpen?: boolean }) {
  return (
    <group position={position}>
      {/* Door frame */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.1, 2, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Door panels (only show if closed) */}
      {!isOpen && (
        <>
          <mesh position={[-0.4, 1, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.8, 2, 0.05]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          <mesh position={[0.4, 1, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.8, 2, 0.05]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        </>
      )}
    </group>
  );
}

function WelcomeDialog() {
  return (
    <div style={{ position: 'fixed', left: '50%', top: 80, transform: 'translateX(-50%)', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002', padding: 32, minWidth: 340, zIndex: 2000, color: '#000', textAlign: 'center' }}>
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#000' }}>Welcome to the Virtual Office!</h2>
      <div style={{ marginTop: 16, fontSize: 22, color: '#e31837', fontWeight: 600 }}>Created by Amin Karic</div>
    </div>
  );
}

function App() {
  const [name, setName] = useState<string | null>(null);
  const [color] = useState<string>(() => getRandomColor());
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 0.5, OFFICE_HALF + 4]);
  const [revolvingDoorOpen, setRevolvingDoorOpen] = useState(false);
  const movementPositionRef = useRef<[number, number, number]>(playerPosition);
  const { players, roomsState, socketRef } = useMultiplayer(playerPosition, name, color);
  const [dialogRoom, setDialogRoom] = useState<any>(null);
  const [snappedChairId, setSnappedChairId] = useState<string | null>(null);
  const room101x = 0;
  const room101z = -ROOM_OFFSET;
  const [joinRequest, setJoinRequest] = useState<{ userId: string, user: any } | null>(null);

  // Find my player id
  const myPlayer = players.find(p => p.name === name && p.color === color);
  const myId = myPlayer?.id || '';

  // Calculate wall data dynamically for both rendering and collision
  const wallData = useMemo(() => getDynamicWallData(roomsState, myId), [roomsState, myId]);
  const movementPosition = usePlayerMovement(!name, revolvingDoorOpen, wallData);
  useEffect(() => { if (!name) setPlayerPosition([0, 0.5, OFFICE_HALF + 4]); }, [name]);
  // If not teleported, follow movement
  useEffect(() => { setPlayerPosition(movementPosition); }, [movementPosition]);
  // Track if player is near the revolving door
  useEffect(() => {
    const dx = playerPosition[0] - movementPositionRef.current[0];
    const dz = playerPosition[2] - movementPositionRef.current[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    setRevolvingDoorOpen(dist < 2);
  }, [playerPosition]);

  const currentChannel = getCurrentChannel(playerPosition);

  // Find closest room and merge meeting info from roomsState
  const closestRoomDef = getClosestRoom(playerPosition);
  let closestRoom = closestRoomDef;
  if (closestRoomDef && roomsState[closestRoomDef.name] && roomsState[closestRoomDef.name].meeting) {
    closestRoom = { ...closestRoomDef, meeting: roomsState[closestRoomDef.name].meeting } as typeof closestRoomDef & { meeting: any };
  }

  // Text chat hook
  const { messages, sendMessage, currentChannel: chatChannel } = useTextChat({
    myId,
    myName: name || '',
    myPosition: playerPosition,
    currentChannel,
    players,
    socketRef,
  });

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  // Show dialog for closest room if in proximity
  useEffect(() => {
    if (!name) return;
    if (closestRoom && dialogRoom !== closestRoom) setDialogRoom(closestRoom);
    if (!closestRoom && dialogRoom) setDialogRoom(null);
  }, [playerPosition, name, roomsState]);

  // --- Chair/couch sitting logic ---
  // Collect all seat positions (chairs and couches)
  const allSeatPositions = useMemo(() => {
    const seats: [number, number, number][] = [];
    // Room 101 chairs (match Furniture positions)
    const room101x = 0;
    const room101z = -ROOM_OFFSET;
    const room101Chairs = [
      [room101x - 3, 0.4, room101z - 1.25] as [number, number, number],
      [room101x - 3, 0.4, room101z - 0.425] as [number, number, number],
      [room101x - 3, 0.4, room101z + 0.425] as [number, number, number],
      [room101x - 3, 0.4, room101z + 1.25] as [number, number, number],
      [room101x - 1, 0.4, room101z - 1.25] as [number, number, number],
      [room101x - 1, 0.4, room101z - 0.425] as [number, number, number],
      [room101x - 1, 0.4, room101z + 0.425] as [number, number, number],
      [room101x - 1, 0.4, room101z + 1.25] as [number, number, number],
      [room101x + 3, 0.4, room101z - 1.25] as [number, number, number],
      [room101x + 3, 0.4, room101z - 0.425] as [number, number, number],
      [room101x + 3, 0.4, room101z + 0.425] as [number, number, number],
      [room101x + 3, 0.4, room101z + 1.25] as [number, number, number],
      [room101x + 1, 0.4, room101z - 1.25] as [number, number, number],
      [room101x + 1, 0.4, room101z - 0.425] as [number, number, number],
      [room101x + 1, 0.4, room101z + 0.425] as [number, number, number],
      [room101x + 1, 0.4, room101z + 1.25] as [number, number, number],
    ];
    seats.push(...room101Chairs);
    
    // Small Meeting Room A chairs
    seats.push(
      [ROOM_OFFSET - 1.5, 0.4, -ROOM_OFFSET - 1.2] as [number, number, number],
      [ROOM_OFFSET - 0.8, 0.4, -ROOM_OFFSET] as [number, number, number],
      [ROOM_OFFSET - 1.5, 0.4, -ROOM_OFFSET + 1.2] as [number, number, number],
      [ROOM_OFFSET - 2.2, 0.4, -ROOM_OFFSET] as [number, number, number]
    );
    
    // Small Meeting Room B chairs
    seats.push(
      [ROOM_OFFSET + 1.5, 0.4, -ROOM_OFFSET - 1.2] as [number, number, number],
      [ROOM_OFFSET + 2.2, 0.4, -ROOM_OFFSET] as [number, number, number],
      [ROOM_OFFSET + 1.5, 0.4, -ROOM_OFFSET + 1.2] as [number, number, number],
      [ROOM_OFFSET + 0.8, 0.4, -ROOM_OFFSET] as [number, number, number]
    );
    
    // Medium Meeting Room Left chairs
    seats.push(
      [-ROOM_OFFSET, 0.4, -2] as [number, number, number],
      [-ROOM_OFFSET - 1.2, 0.4, -1] as [number, number, number],
      [-ROOM_OFFSET - 1.2, 0.4, -0.5] as [number, number, number],
      [-ROOM_OFFSET - 1.2, 0.4, 0] as [number, number, number],
      [-ROOM_OFFSET - 1.2, 0.4, 0.5] as [number, number, number],
      [-ROOM_OFFSET + 1.2, 0.4, -1] as [number, number, number],
      [-ROOM_OFFSET + 1.2, 0.4, -0.5] as [number, number, number],
      [-ROOM_OFFSET + 1.2, 0.4, 0] as [number, number, number],
      [-ROOM_OFFSET + 1.2, 0.4, 0.5] as [number, number, number],
      [-ROOM_OFFSET, 0.4, 2] as [number, number, number]
    );
    
    // Medium Meeting Room Right chairs
    seats.push(
      [ROOM_OFFSET, 0.4, -2] as [number, number, number],
      [ROOM_OFFSET - 1.2, 0.4, -1] as [number, number, number],
      [ROOM_OFFSET - 1.2, 0.4, -0.5] as [number, number, number],
      [ROOM_OFFSET - 1.2, 0.4, 0] as [number, number, number],
      [ROOM_OFFSET - 1.2, 0.4, 0.5] as [number, number, number],
      [ROOM_OFFSET + 1.2, 0.4, -1] as [number, number, number],
      [ROOM_OFFSET + 1.2, 0.4, -0.5] as [number, number, number],
      [ROOM_OFFSET + 1.2, 0.4, 0] as [number, number, number],
      [ROOM_OFFSET + 1.2, 0.4, 0.5] as [number, number, number],
      [ROOM_OFFSET, 0.4, 2] as [number, number, number]
    );
    
    // Cubicles Left chairs
    seats.push(
      [-ROOM_OFFSET - 1.5, 0.4, ROOM_OFFSET - 0.8] as [number, number, number],
      [-ROOM_OFFSET + 1.5, 0.4, ROOM_OFFSET - 0.8] as [number, number, number],
      [-ROOM_OFFSET - 1.5, 0.4, ROOM_OFFSET + 0.5] as [number, number, number],
      [-ROOM_OFFSET + 1.5, 0.4, ROOM_OFFSET + 0.5] as [number, number, number]
    );
    
    // Cubicles Right chairs
    seats.push(
      [ROOM_OFFSET - 1.5, 0.4, ROOM_OFFSET - 0.8] as [number, number, number],
      [ROOM_OFFSET + 1.5, 0.4, ROOM_OFFSET - 0.8] as [number, number, number],
      [ROOM_OFFSET - 1.5, 0.4, ROOM_OFFSET + 0.5] as [number, number, number],
      [ROOM_OFFSET + 1.5, 0.4, ROOM_OFFSET + 0.5] as [number, number, number]
    );
    
    // Break room couch (two seats, left/right)
    const couchX = -ROOM_OFFSET - 2;
    const couchZ = -ROOM_OFFSET + 2.5;
    seats.push([couchX - 0.4, 0.4, couchZ] as [number, number, number]);
    seats.push([couchX + 0.4, 0.4, couchZ] as [number, number, number]);
    
    // Auditorium seats
    const audX = AUDITORIUM_OFFSET_X;
    const audZ = AUDITORIUM_OFFSET_Z;
    const rows = 5;
    const seatsPerRow = 8;
    const seatRadius = 3.5;
    const seatAngleStart = -Math.PI / 3;
    const seatAngleEnd = Math.PI / 3;
    for (let r = 0; r < rows; r++) {
      const radius = seatRadius + r * 0.7;
      for (let s = 0; s < seatsPerRow; s++) {
        const angle = seatAngleStart + (seatAngleEnd - seatAngleStart) * (s / (seatsPerRow - 1));
        const x = audX + Math.sin(angle) * radius;
        const z = audZ + 2 + Math.cos(angle) * radius;
        seats.push([x, 0.4, z] as [number, number, number]);
      }
    }
    return seats;
  }, []);

  // Sitting state
  const [snappedSeat, setSnappedSeat] = useState<[number, number, number] | null>(null);
  // Find closest seat (exclude occupied)
  const closestSeat = useMemo(() => {
    let minDist = Infinity;
    let closest: [number, number, number] | null = null;
    // Find all occupied seats (by other players)
    const occupiedSeats = new Set<string>();
    for (const p of players) {
      if (p.id === myId) continue;
      for (const seat of allSeatPositions) {
        const dx = p.position[0] - seat[0];
        const dy = (p.position[1] || 0) - seat[1];
        const dz = p.position[2] - seat[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.2) {
          occupiedSeats.add(seat.join(','));
        }
      }
    }
    for (const seat of allSeatPositions) {
      if (occupiedSeats.has(seat.join(','))) continue;
      const dx = playerPosition[0] - seat[0];
      const dz = playerPosition[2] - seat[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.7 && dist < minDist) {
        minDist = dist;
        closest = seat;
      }
    }
    return closest;
  }, [playerPosition, allSeatPositions, players, myId]);

  // Prevent server-side movement updates while sitting
  useEffect(() => {
    if (socketRef.current && name && color && !snappedSeat) {
      socketRef.current.emit('move', playerPosition);
    }
  }, [playerPosition, name, color, snappedSeat]);

  // When sitting, immediately emit snapped seat position to server
  useEffect(() => {
    if (socketRef.current && name && color && snappedSeat) {
      socketRef.current.emit('move', snappedSeat);
    }
  }, [snappedSeat, name, color]);

  // Handle spacebar for sitting/standing
  useEffect(() => {
    function handleSpace(e: KeyboardEvent) {
      if (e.code === 'Space') {
        if (snappedSeat) {
          setSnappedSeat(null); // Stand up
        } else if (closestSeat) {
          setSnappedSeat(closestSeat); // Sit down
        }
      }
    }
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  }, [snappedSeat, closestSeat]);

  // If snapped, override player position and disable movement
  let effectivePlayerPosition = playerPosition;
  let movementDisabled = !name || !!snappedSeat;
  if (snappedSeat) {
    effectivePlayerPosition = snappedSeat;
  }

  // Show welcome dialog if player is near the revolving door (within 3 units)
  const showWelcomeDialog = useMemo(() => {
    const dx = playerPosition[0] - 0;
    const dz = playerPosition[2] - (OFFICE_HALF);
    return Math.sqrt(dx * dx + dz * dz) < 3;
  }, [playerPosition]);

  return (
    <div style={{ width: '100vw', height: '100vh', color: '#000' }}>
      {!name && <NameModal onSubmit={setName} />}
      {dialogRoom && <RoomDialog room={dialogRoom} onClose={() => setDialogRoom(null)} players={players} myId={myId} socketRef={socketRef} name={name || ''} onTeleport={setPlayerPosition} />}
      {/* Chat button */}
      {name && (
        <button
          onClick={() => setShowChat(!showChat)}
          style={{ position: 'fixed', top: 24, right: 24, zIndex: 3000, fontSize: 22, padding: '10px 22px', borderRadius: 8, background: showChat ? '#cceedd' : '#eee', border: '1px solid #aaa', fontWeight: 600, color: '#000' }}
        >
          {showChat ? 'Close Chat 💬' : 'Open Chat 💬'}
        </button>
      )}
      {/* Chat interface */}
      {showChat && name && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, width: 350, height: 400, background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002', zIndex: 3000, display: 'flex', flexDirection: 'column', color: '#000' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #eee', fontWeight: 600, color: '#000' }}>
            Chat - {currentChannel}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ 
                background: msg.senderId === myId ? '#e3f2fd' : '#f5f5f5', 
                padding: 8, 
                borderRadius: 8, 
                alignSelf: msg.senderId === myId ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                color: '#000'
              }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>{msg.senderName}</div>
                <div style={{ color: '#000' }}>{msg.message}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && chatInput.trim()) {
                  sendMessage(chatInput);
                  setChatInput('');
                }
              }}
              placeholder="Type a message..."
              style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc', color: '#fff', background: '#333' }}
            />
            <button
              onClick={() => {
                if (chatInput.trim()) {
                  sendMessage(chatInput);
                  setChatInput('');
                }
              }}
              style={{ padding: '8px 16px', borderRadius: 6, background: '#007bff', color: '#fff', border: 'none' }}
            >
              Send
            </button>
          </div>
        </div>
      )}
      <Canvas shadows>
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1} 
          castShadow 
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <FollowCamera target={effectivePlayerPosition} />
        <Office wallData={wallData} />
        <Furniture onChairSnap={setSnappedChairId} snappedChairId={snappedChairId} playerId={myId} />
        {/* Render all players */}
        {players.map((p) => (
          <PlayerBox key={p.id} position={p.id === myId ? effectivePlayerPosition : p.position} color={p.color} name={p.name} />
        ))}
        {/* Security station and revolving door at south wall */}
        <SecurityStation position={[0, 0, OFFICE_HALF + 1.2]} />
        <RevolvingDoor position={[0, 0, OFFICE_HALF]} playerPosition={playerPosition} />
      </Canvas>
      {/* Visual indicator for sit/stand */}
      {closestSeat && !snappedSeat && (
        <div style={{ position: 'fixed', left: '50%', bottom: 80, transform: 'translateX(-50%)', background: '#fff', color: '#e31837', fontWeight: 700, fontSize: 22, padding: '10px 28px', borderRadius: 10, boxShadow: '0 2px 12px #0002', zIndex: 3000 }}>
          Press Space to Sit
        </div>
      )}
      {snappedSeat && (
        <div style={{ position: 'fixed', left: '50%', bottom: 80, transform: 'translateX(-50%)', background: '#fff', color: '#e31837', fontWeight: 700, fontSize: 22, padding: '10px 28px', borderRadius: 10, boxShadow: '0 2px 12px #0002', zIndex: 3000 }}>
          Press Space to Stand
        </div>
      )}
      {showWelcomeDialog && <WelcomeDialog />}
    </div>
  );
}

export default App;
