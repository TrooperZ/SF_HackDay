import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

// Type for a player
interface Player {
  id: string;
  name: string;
  position: [number, number, number];
  color: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  channel: string;
}

interface UseTextChatResult {
  messages: ChatMessage[];
  sendMessage: (message: string) => void;
  currentChannel: string;
}

// Helper: distance between two positions
function dist(a: [number, number, number], b: [number, number, number]) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

export function useTextChat({
  myId,
  myName,
  myPosition,
  currentChannel,
  players,
  socketRef,
}: {
  myId: string;
  myName: string;
  myPosition: [number, number, number];
  currentChannel: string;
  players: Player[];
  socketRef: any;
}): UseTextChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Send a message
  const sendMessage = (message: string) => {
    if (!socketRef.current || !message.trim()) return;
    
    const chatMessage: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      senderId: myId,
      senderName: myName,
      message: message.trim(),
      timestamp: Date.now(),
      channel: currentChannel,
    };

    socketRef.current.emit('chat-message', chatMessage);
    
    // Don't add to local messages - let the server broadcast it back
  };

  // Listen for incoming messages
  useEffect(() => {
    if (!socketRef.current) return;

    function onChatMessage(message: ChatMessage) {
      // Only show messages from the current channel
      if (message.channel === currentChannel) {
        setMessages(prev => [...prev, message]);
      }
    }

    socketRef.current.on('chat-message', onChatMessage);
    return () => socketRef.current.off('chat-message', onChatMessage);
  }, [currentChannel, socketRef]);

  // Join channel when it changes
  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('join-channel', currentChannel);
  }, [currentChannel, socketRef]);

  // Clear old messages (keep last 50)
  useEffect(() => {
    if (messages.length > 50) {
      setMessages(prev => prev.slice(-50));
    }
  }, [messages.length]);

  return {
    messages,
    sendMessage,
    currentChannel,
  };
} 