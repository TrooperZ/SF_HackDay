import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

// Type for a player
interface Player {
  id: string;
  name: string;
  position: [number, number, number];
  color: string;
}

interface UseVoiceChatResult {
  isMuted: boolean;
  toggleMute: () => void;
  usersInChannel: { id: string; name: string; mute: boolean }[];
  muteMap: Record<string, boolean>;
}

// Helper: distance between two positions
function dist(a: [number, number, number], b: [number, number, number]) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

// Add this at the top if you get a type error for 'simple-peer':
// declare module 'simple-peer';

export function useVoiceChat({
  myId,
  myName,
  myPosition,
  currentChannel,
  players,
}: {
  myId: string;
  myName: string;
  myPosition: [number, number, number];
  currentChannel: string;
  players: Player[];
}): UseVoiceChatResult {
  const [isMuted, setIsMuted] = useState(false);
  const [usersInChannel, setUsersInChannel] = useState<{ id: string; name: string; mute: boolean }[]>([]);
  const [muteMap, setMuteMap] = useState<Record<string, boolean>>({});
  const peersRef = useRef<Record<string, any>>({});
  const socketRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElements = useRef<Record<string, HTMLAudioElement>>({});

  // Connect to signaling server and manage peers
  useEffect(() => {
    const socket = io('https://1addfa25-c5ff-4e79-a846-003285aa3654-00-zflny0j2up6s.janeway.replit.dev/');
    socketRef.current = socket;
    // Join the current channel
    socket.emit('join-channel', currentChannel);
    // Mute status
    socket.emit('mute', isMuted);

    // Listen for users in channel
    socket.on('user-joined-channel', ({ id, channel, mute }) => {
      setUsersInChannel((prev) => {
        if (prev.some((u) => u.id === id)) return prev;
        return [...prev, { id, name: players.find(p => p.id === id)?.name || 'Unknown', mute }];
      });
      setMuteMap((prev) => ({ ...prev, [id]: mute }));
    });
    socket.on('user-mute', ({ id, mute }) => {
      setMuteMap((prev) => ({ ...prev, [id]: mute }));
    });

    // WebRTC signaling
    socket.on('signal', async ({ from, data }) => {
      if (!peersRef.current[from]) {
        // Only connect if in proximity (for office) or in same room
        const peer = new Peer({ initiator: false, trickle: false, stream: streamRef.current! });
        peer.on('signal', (signal: any) => {
          socket.emit('signal', { to: from, data: signal });
        });
        peer.on('stream', (remoteStream: any) => {
          let audio = audioElements.current[from];
          if (!audio) {
            audio = new window.Audio();
            audio.autoplay = true;
            audioElements.current[from] = audio;
          }
          audio.srcObject = remoteStream;
        });
        peersRef.current[from] = peer;
        peer.signal(data);
      } else {
        peersRef.current[from].signal(data);
      }
    });

    // Clean up on unmount or channel switch
    return () => {
      Object.values(peersRef.current).forEach(peer => peer.destroy());
      peersRef.current = {};
      Object.values(audioElements.current).forEach(audio => audio.remove());
      audioElements.current = {};
      socket.disconnect();
    };
    // eslint-disable-next-line
  }, [currentChannel]);

  // Get mic stream
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream;
    });
  }, []);

  // Manage peer connections based on proximity/channel
  useEffect(() => {
    if (!socketRef.current) return;
    // Find users to connect to
    let targets: Player[] = [];
    if (currentChannel === 'office') {
      targets = players.filter(p => p.id !== myId && dist(p.position, myPosition) < 8);
    } else {
      targets = players.filter(p => p.id !== myId);
    }
    // Connect to new peers
    targets.forEach((p) => {
      if (!peersRef.current[p.id]) {
        const peer = new Peer({ initiator: true, trickle: false, stream: streamRef.current! });
        peer.on('signal', (signal: any) => {
          socketRef.current.emit('signal', { to: p.id, data: signal });
        });
        peer.on('stream', (remoteStream: any) => {
          let audio = audioElements.current[p.id];
          if (!audio) {
            audio = new window.Audio();
            audio.autoplay = true;
            audioElements.current[p.id] = audio;
          }
          audio.srcObject = remoteStream;
        });
        peersRef.current[p.id] = peer;
      }
    });
    // Disconnect from peers not in targets
    Object.keys(peersRef.current).forEach((id) => {
      if (!targets.some((p) => p.id === id)) {
        peersRef.current[id].destroy();
        delete peersRef.current[id];
        if (audioElements.current[id]) {
          audioElements.current[id].remove();
          delete audioElements.current[id];
        }
      }
    });
  }, [players, myPosition, currentChannel, myId]);

  // Mute/unmute logic
  const toggleMute = () => {
    setIsMuted((prev) => {
      const newMute = !prev;
      if (socketRef.current) {
        socketRef.current.emit('mute', newMute);
      }
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => (track.enabled = !newMute));
      }
      return newMute;
    });
  };

  return {
    isMuted,
    toggleMute,
    usersInChannel,
    muteMap,
  };
} 