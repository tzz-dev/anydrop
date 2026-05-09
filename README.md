# AnyDrop

A peer-to-peer file transfer application using WebRTC for secure, direct file sharing over LAN or through private rooms.

## Features

- 🚀 **LAN Transfer**: Automatic file sharing with nearby devices
- 🔐 **Private Rooms**: Password-protected transfer with any device
- 🌍 **Multi-language**: Support for English, Japanese, and Chinese
- 🎨 **Dark Mode**: Light / dark / system theme toggle
- 📱 **Responsive**: Works on desktop, tablet, and mobile

## Project Structure

```text
anydrop/
├── client/              # Next.js frontend application
│   ├── app/             # Next.js app router pages and layout
│   ├── components/      # React components
│   ├── lib/             # Utility functions and hooks
│   │   ├── webrtc.ts    # WebRTC peer connection logic
│   │   ├── signaling.ts # Signaling client for server communication
│   │   ├── useSignaling.ts    # React hook for signaling
│   │   └── usePeers.ts  # React hook for peer management
│   ├── messages/        # i18n translation files
│   └── public/          # Static assets
├── server/              # WebSocket signaling server
│   ├── src/
│   │   ├── index.ts     # Signaling server implementation
│   │   └── types.ts     # Re-exports from packages/shared
│   └── tsconfig.json
├── packages/
│   └── shared/          # Shared types (monorepo package)
│       └── src/types.ts # Message format definitions
└── package.json         # Root workspace configuration
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Copy client environment configuration
cp client/.env.example client/.env.local
```

### Development

```bash
# Terminal 1: Start signaling server
pnpm dev:server

# Terminal 2: Start Next.js dev server
pnpm dev:client
```

The client will be available at `http://localhost:3000`

**For LAN access during development**, access the server via your local IP address (e.g., `http://192.168.1.100:3000`) and configure `NEXT_DEV_ORIGINS` in `client/.env.local`.

## Build & Deployment

### Building

```bash
pnpm build:client   # Build Next.js frontend
pnpm build:server   # Build signaling server
```

### Production Server

```bash
# Set environment variables
export PORT=3001
export ALLOWED_ORIGIN=https://yourdomain.com

# Start server
node server/dist/index.js
```

### Vercel Deployment

Deploy the frontend to Vercel:

```bash
vercel --prod
```

The signaling server should be deployed separately (e.g., on Heroku, AWS, DigitalOcean, or your own VPS).

## Environment Variables

### Client (`client/.env.local`)

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SIGNALING_URL` | WebSocket URL for the signaling server (e.g. `wss://ws.example.com`). If unset, auto-detected from the page origin. |
| `NEXT_DEV_ORIGINS` | Comma-separated LAN IP patterns allowed by the Next.js dev server (default: `192.168.1.*`). |

### Server (shell / PM2)

| Variable | Description |
| --- | --- |
| `PORT` | Port the signaling server listens on (default: `3001`). |
| `ALLOWED_ORIGIN` | Origin allowed for WebSocket connections. Leave empty to allow all origins (not recommended for production). |

## Architecture

### Flow

1. **Device Registration**: Client connects to signaling server via WebSocket
2. **Device Discovery**: Server broadcasts device list to all clients in the room
3. **Offer/Answer**: Peers negotiate WebRTC connection via signaling server
4. **ICE Candidates**: NAT traversal candidates exchanged through signaling
5. **Data Transfer**: Files transferred directly peer-to-peer over WebRTC data channel

### Signaling Protocol

Messages are JSON-formatted over WebSocket:

- `register`: Client joins a room
- `device-list`: Broadcast of available peers
- `offer/answer`: WebRTC session description
- `ice-candidate`: NAT traversal candidate
- `error`: Error notification

## Security Considerations

- ✅ Password hashing with SHA-256 (salted with room code)
- ✅ File size validation (max 10 GB)
- ✅ Message size limits (64 KB) to prevent DoS
- ✅ Rate limiting on WebSocket messages
- ✅ Origin validation for CORS
- ✅ Room isolation (devices only see peers in their room)

For production deployment:

- Use `wss://` (secure WebSocket) in `NEXT_PUBLIC_SIGNALING_URL`
- Set `ALLOWED_ORIGIN` to your domain only
- Deploy signaling server on HTTPS

## Technologies

### Frontend

- **Framework**: Next.js 16
- **UI**: React 19 with shadcn/ui components
- **Styling**: Tailwind CSS
- **i18n**: next-intl
- **Icons**: Lucide React

### Backend

- **Runtime**: Node.js
- **Protocol**: WebSocket (ws)
- **Language**: TypeScript

### Shared

- **Types**: TypeScript type definitions (monorepo package)

## License

MIT
