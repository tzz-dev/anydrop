import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type {
  Device,
  ClientMessage,
  ServerMessage,
  DeviceListMessage,
} from './types';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '';

const MAX_MESSAGE_SIZE = 64 * 1024; // 64 KB — prevents oversized SDP/ICE payloads
const MAX_ROOM_MEMBERS = 20;
const PING_INTERVAL_MS = 30_000; // 30 s — detect dead connections

// device registry: deviceId -> { ws, device, room }
const clients = new Map<string, { ws: WebSocket; device: Device; room: string }>();

// room password table: room -> passwordHash (empty string = no password)
const roomPasswords = new Map<string, string>();

// derive a stable 6-char room code from an IP address
// production: devices share a public IP after NAT, so same household/office lands in the same room
// local dev: access via LAN IP (not localhost) — otherwise ::1 and LAN IP produce different codes
function ipToRoomCode(ip: string): string {
  const clean = ip.replace(/^::ffff:/, '');
  let hash = 5381;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) + hash + clean.charCodeAt(i)) | 0;
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  let n = Math.abs(hash);
  for (let i = 0; i < 6; i++) {
    code += chars[n % chars.length];
    n = Math.floor(n / chars.length);
  }
  return code;
}

const server = http.createServer((req, res) => {
  if (req.url === '/welcome') {
    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' });
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN || '*',
    });
    const ip = req.socket.remoteAddress ?? '';
    res.end(JSON.stringify({ lanRoom: ipToRoomCode(ip) }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('anydrop signaling server');
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin ?? '';
  if (ALLOWED_ORIGIN && origin !== ALLOWED_ORIGIN) {
    console.warn(`[!] rejected connection from origin: ${origin}`);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

function broadcastDeviceList(room: string) {
  const roomClients = Array.from(clients.entries()).filter(([, c]) => c.room === room);
  const devices = roomClients.map(([, c]) => c.device);
  for (const [id, client] of roomClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      const msg: DeviceListMessage = {
        type: 'device-list',
        devices,
        selfId: id,
      };
      client.ws.send(JSON.stringify(msg));
    }
  }
}

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 1000;

wss.on('connection', (ws, req) => {
  const deviceId = uuidv4();
  console.log(`[+] connected: ${deviceId} from ${req.socket.remoteAddress}`);

  // ── Ping/pong heartbeat — detect and evict dead connections ─────────────
  let isAlive = true;
  ws.on('pong', () => { isAlive = true; });
  const pingTimer = setInterval(() => {
    if (!isAlive) {
      ws.terminate();
      return;
    }
    isAlive = false;
    ws.ping();
  }, PING_INTERVAL_MS);

  // ── Rate limiting ────────────────────────────────────────────────────────
  let messageCount = 0;
  let rateLimitTimer: ReturnType<typeof setTimeout> | null = null;

  ws.on('message', (raw, isBinary) => {
    // Reject binary frames — all messages are JSON text
    if (isBinary) {
      send(ws, { type: 'error', message: 'binary frames not supported' });
      ws.close();
      return;
    }

    // Size guard — prevents oversized SDP/payload attacks
    const rawStr = raw.toString();
    if (rawStr.length > MAX_MESSAGE_SIZE) {
      send(ws, { type: 'error', message: 'message too large' });
      ws.close();
      return;
    }

    // Rate limiting
    messageCount++;
    if (!rateLimitTimer) {
      rateLimitTimer = setTimeout(() => {
        messageCount = 0;
        rateLimitTimer = null;
      }, RATE_LIMIT_WINDOW_MS);
    }
    if (messageCount > RATE_LIMIT_MAX) {
      send(ws, { type: 'error', message: 'rate limit exceeded' });
      ws.close();
      return;
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(rawStr) as ClientMessage;
    } catch {
      send(ws, { type: 'error', message: 'invalid JSON' });
      return;
    }

    switch (msg.type) {
      case 'register': {
        if (
          typeof msg.name !== 'string' || msg.name.length > 64 ||
          typeof msg.room !== 'string' || msg.room.length > 32 ||
          typeof msg.stableId !== 'string' || msg.stableId.length > 64 ||
          typeof msg.userAgent !== 'string' || msg.userAgent.length > 512
        ) {
          send(ws, { type: 'error', message: 'invalid register fields' });
          return;
        }

        // Room capacity check
        const roomCount = Array.from(clients.values()).filter((c) => c.room === msg.room).length;
        if (roomCount >= MAX_ROOM_MEMBERS) {
          send(ws, { type: 'error', message: 'error.roomFull' });
          return;
        }

        // if already registered in another room, remove from old room first
        const existing = clients.get(deviceId);
        if (existing && existing.room !== msg.room) {
          const oldRoom = existing.room;
          clients.delete(deviceId);
          const oldRoomEmpty = !Array.from(clients.values()).some((c) => c.room === oldRoom);
          if (oldRoomEmpty) roomPasswords.delete(oldRoom);
          else broadcastDeviceList(oldRoom);
        }

        const incomingHash = msg.passwordHash ?? '';
        if (roomPasswords.has(msg.room)) {
          if (msg.exclusive) {
            send(ws, { type: 'error', message: 'error.roomExists' });
            return;
          }
          if (roomPasswords.get(msg.room) !== incomingHash) {
            send(ws, { type: 'error', message: 'error.wrongPassword' });
            return;
          }
        } else {
          // room doesn't exist — only create if explicitly requested
          if (msg.create === false) {
            send(ws, { type: 'error', message: 'error.roomNotFound' });
            return;
          }
          roomPasswords.set(msg.room, incomingHash);
        }
        const device: Device = {
          id: deviceId,
          stableId: msg.stableId,
          name: msg.name,
          userAgent: msg.userAgent,
          joinedAt: Date.now(),
        };
        clients.set(deviceId, { ws, device, room: msg.room });
        const safeName = msg.name.replace(/[\r\n\x1b]/g, ' ');
        console.log(`[✓] registered: ${safeName} (${deviceId}) room: ${msg.room}`);
        broadcastDeviceList(msg.room);
        break;
      }

      case 'offer':
      case 'answer':
      case 'ice-candidate': {
        if (typeof msg.to !== 'string') return;
        const target = clients.get(msg.to);
        const sender = clients.get(deviceId);
        if (!target || !sender || target.room !== sender.room) {
          send(ws, { type: 'error', message: `target device not found: ${msg.to}` });
          return;
        }
        // forward the message, injecting the verified sender id
        send(target.ws, { ...msg, from: deviceId });
        break;
      }
    }
  });

  ws.on('close', () => {
    clearInterval(pingTimer);
    if (rateLimitTimer) clearTimeout(rateLimitTimer);
    console.log(`[-] disconnected: ${deviceId}`);
    const room = clients.get(deviceId)?.room;
    clients.delete(deviceId);
    if (room) {
      const roomEmpty = !Array.from(clients.values()).some((c) => c.room === room);
      if (roomEmpty) roomPasswords.delete(room);
      else broadcastDeviceList(room);
    }
  });

  ws.on('error', (err) => {
    console.error(`[!] ws error (${deviceId}):`, err.message);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`anydrop signaling server listening on http://0.0.0.0:${PORT}`);
});
