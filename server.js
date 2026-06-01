const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const rooms = new Map();
const ROOM_LIFETIME_MS = 1000 * 60 * 60; // 1 hour

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function cleanupRooms() {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (room.expiresAt <= now) {
      rooms.delete(id);
    }
  }
}

setInterval(cleanupRooms, 1000 * 60);

app.post('/api/room/create', (req, res) => {
  const roomId = generateRoomCode();
  const initialState = {
    board: req.body.board || null,
    currentTurn: req.body.currentTurn || 'white',
    lastMove: req.body.lastMove || null,
    moveHistory: req.body.moveHistory || [],
    capturedWhite: req.body.capturedWhite || [],
    capturedBlack: req.body.capturedBlack || [],
    isGameOver: req.body.isGameOver || false,
    result: req.body.result || null,
    timerMinutes: req.body.timerMinutes || 3,
    timestamp: Date.now(),
    hostJoined: true
  };

  rooms.set(roomId, {
    state: initialState,
    expiresAt: Date.now() + ROOM_LIFETIME_MS
  });

  res.json({ roomId, roomState: initialState });
});

app.post('/api/room/join', (req, res) => {
  const roomId = String(req.body.roomId || '').trim().toUpperCase();
  if (!roomId || !rooms.has(roomId)) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const room = rooms.get(roomId);
  room.expiresAt = Date.now() + ROOM_LIFETIME_MS;
  return res.json({ roomId, roomState: room.state });
});

app.get('/api/room/:roomId', (req, res) => {
  const roomId = String(req.params.roomId || '').trim().toUpperCase();
  if (!roomId || !rooms.has(roomId)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const room = rooms.get(roomId);
  room.expiresAt = Date.now() + ROOM_LIFETIME_MS;
  return res.json({ roomId, roomState: room.state });
});

app.post('/api/room/:roomId/update', (req, res) => {
  const roomId = String(req.params.roomId || '').trim().toUpperCase();
  if (!roomId || !rooms.has(roomId)) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const room = rooms.get(roomId);
  room.state = {
    ...room.state,
    ...req.body,
    timestamp: Date.now()
  };
  room.expiresAt = Date.now() + ROOM_LIFETIME_MS;
  return res.json({ roomId, roomState: room.state });
});

app.delete('/api/room/:roomId', (req, res) => {
  const roomId = String(req.params.roomId || '').trim().toUpperCase();
  rooms.delete(roomId);
  return res.json({ roomId, deleted: true });
});

app.listen(port, () => {
  console.log(`Chess backend running on http://localhost:${port}`);
});
