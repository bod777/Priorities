import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerLobbyHandlers } from './handlers/lobbyHandlers.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';
import { registerDisconnectHandlers } from './handlers/disconnectHandlers.js';
import type { ClientEvents, ServerEvents } from '../../shared/src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  },
  // Mobile browsers can be backgrounded for 30-60s before their radio wakes back up.
  // Ping every 30s, allow 60s for a pong before declaring disconnect.
  pingInterval: 30000,
  pingTimeout: 60000,
});

app.use(cors());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  registerLobbyHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerDisconnectHandlers(io, socket);
});

const PORT = Number(process.env.PORT) || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
