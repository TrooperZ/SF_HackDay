const { Server } = require('socket.io');
const http = require('http');

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: '*' }
});

const players = {};
const userChannels = {}; // socket.id -> channel name

// --- Meeting/Room State ---
const rooms = {
  // Example structure:
  // 'Room 101': {
  //   meeting: { name, isPrivate, ownerId, participants: [socketId], joinRequests: [socketId] }
  // }
};

function broadcastRoomsState() {
  io.emit('rooms-state', rooms);
}

function getUsersInChannel(channel) {
  return Object.entries(userChannels)
    .filter(([_, ch]) => ch === channel)
    .map(([id]) => id);
}

io.on('connection', (socket) => {
  // When a new player joins
  socket.on('join', ({ name, color, position }) => {
    players[socket.id] = { id: socket.id, name, color, position };
    io.emit('players', Object.values(players));
  });

  // When a player moves
  socket.on('move', (position) => {
    if (players[socket.id]) {
      players[socket.id].position = position;
      io.emit('players', Object.values(players));
    }
  });

  // Join a voice channel
  socket.on('join-channel', (channel) => {
    console.log('🎤 User', socket.id, 'joining channel:', channel);
    // Leave previous channel room if any
    const prevChannel = userChannels[socket.id];
    if (prevChannel && prevChannel !== channel) {
      socket.leave(prevChannel);
      console.log('👋 User', socket.id, 'left channel:', prevChannel);
    }
    userChannels[socket.id] = channel;
    socket.join(channel);
    console.log('✅ User', socket.id, 'joined channel:', channel);
    console.log('📊 Current channels:', Object.entries(userChannels).map(([id, ch]) => `${id}: ${ch}`));
  });

  // Handle text chat messages
  socket.on('chat-message', (message) => {
    console.log('💬 Chat message from', socket.id, 'in channel:', message.channel);
    // Broadcast to all users in the same channel
    io.to(message.channel).emit('chat-message', message);
  });

  // Leave all channels on disconnect
  socket.on('disconnect', () => {
    delete players[socket.id];
    delete userChannels[socket.id];
    io.emit('players', Object.values(players));
    // Remove from all meetings
    for (const roomName in rooms) {
      const meeting = rooms[roomName].meeting;
      if (meeting) {
        if (meeting.ownerId === socket.id) {
          delete rooms[roomName].meeting;
        } else {
          meeting.participants = meeting.participants.filter(id => id !== socket.id);
          meeting.joinRequests = meeting.joinRequests.filter(id => id !== socket.id);
        }
      }
    }
    broadcastRoomsState();
  });

  // --- MEETING EVENTS ---
  // Start a meeting
  socket.on('start-meeting', ({ roomName, meetingName, isPrivate }) => {
    if (!rooms[roomName]) rooms[roomName] = {};
    rooms[roomName].meeting = {
      name: meetingName,
      isPrivate,
      ownerId: socket.id,
      participants: [socket.id],
      joinRequests: [],
    };
    broadcastRoomsState();
  });

  // End a meeting (only owner can end)
  socket.on('end-meeting', ({ roomName }) => {
    if (rooms[roomName] && rooms[roomName].meeting && rooms[roomName].meeting.ownerId === socket.id) {
      delete rooms[roomName].meeting;
      broadcastRoomsState();
    }
  });

  // Update meeting info (only owner)
  socket.on('update-meeting', ({ roomName, meetingName, isPrivate }) => {
    if (rooms[roomName] && rooms[roomName].meeting && rooms[roomName].meeting.ownerId === socket.id) {
      rooms[roomName].meeting.name = meetingName;
      rooms[roomName].meeting.isPrivate = isPrivate;
      broadcastRoomsState();
    }
  });

  // Ask to join a private meeting
  socket.on('ask-to-join', ({ roomName }) => {
    if (rooms[roomName] && rooms[roomName].meeting && rooms[roomName].meeting.isPrivate) {
      const meeting = rooms[roomName].meeting;
      if (!meeting.joinRequests.includes(socket.id)) {
        meeting.joinRequests.push(socket.id);
        // Notify owner (with a sound cue event)
        io.to(meeting.ownerId).emit('join-request', { roomName, userId: socket.id, user: players[socket.id] });
        broadcastRoomsState();
      }
    }
  });

  // Owner approves join request
  socket.on('approve-join', ({ roomName, userId }) => {
    if (rooms[roomName] && rooms[roomName].meeting && rooms[roomName].meeting.ownerId === socket.id) {
      const meeting = rooms[roomName].meeting;
      if (meeting.joinRequests.includes(userId)) {
        meeting.joinRequests = meeting.joinRequests.filter(id => id !== userId);
        if (!meeting.participants.includes(userId)) meeting.participants.push(userId);
        // Notify approved user to teleport inside
        io.to(userId).emit('join-approved', { roomName });
        broadcastRoomsState();
      }
    }
  });

  // Leave meeting (participant or owner)
  socket.on('leave-meeting', ({ roomName }) => {
    if (rooms[roomName] && rooms[roomName].meeting) {
      const meeting = rooms[roomName].meeting;
      if (meeting.ownerId === socket.id) {
        // Owner leaves: end meeting
        delete rooms[roomName].meeting;
      } else {
        meeting.participants = meeting.participants.filter(id => id !== socket.id);
      }
      broadcastRoomsState();
    }
  });
});

server.listen(3001, () => {
  console.log('Socket.IO server running on port 3001');
}); 