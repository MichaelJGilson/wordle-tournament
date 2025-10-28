# 🎮 Word Royale - Battle Royale Wordle

A real-time multiplayer Wordle battle royale game built with React, TypeScript, and Socket.io. Support for up to 100 players competing simultaneously in Tetris 99-style gameplay.

![Word Royale](https://img.shields.io/badge/Players-Up%20to%20100-brightgreen)
![Tech](https://img.shields.io/badge/React-TypeScript-blue)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success)

---

## 🚀 Quick Start

### Development

```bash
# Terminal 1 - Backend Server
npm install
npm start

# Terminal 2 - React Frontend
cd client
npm install
npm run dev
```

Visit **http://localhost:5173**

### Production Build

```bash
# Build React app
cd client
npm run build

# Start production server
cd ..
npm start
```

Visit **http://localhost:3000**

---

## 🎯 Game Features

### Battle Royale Mode
- **100 players** competing simultaneously
- **15-minute** timed matches
- **Dynamic matchmaking** - random opponent pairing
- **Garbage system** - Tetris 99-style mechanics
  - Complete word in 1 try = Instant KO
  - Complete in 2+ tries = Send garbage rows (6 - attempts)
- **Real-time leaderboard** and rankings

### Custom Rooms
- Create private rooms with shareable Game IDs
- Host controls when game starts (2+ players required)
- All Battle Royale mechanics included

### Game Mechanics
- 6 rows for guesses with color feedback (🟩🟨⬜)
- Garbage rows block playable space
- Real-time opponent progress display
- Victory/Elimination overlays with stats

---

## 🏗️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast builds and hot reload
- **Socket.io-client** for real-time communication
- **CSS** with modern gradients and animations

### Backend
- **Node.js** with Express
- **Socket.io** for WebSocket connections
- **SQLite** for game state persistence
- **UUID** for unique game/player IDs

### Architecture
- Component-based React architecture (15 components)
- Custom hooks for state and socket management
- Type-safe with full TypeScript coverage
- Real-time synchronization via WebSocket

---

## 📁 Project Structure

```
WordleRoyale/
├── client/                      # React Frontend
│   ├── src/
│   │   ├── components/          # React Components
│   │   │   ├── Game/           # Game board, grid, cells
│   │   │   ├── UI/             # Keyboard, stats, players list
│   │   │   ├── Menus/          # Main menu, lobbies
│   │   │   └── Overlays/       # Victory, elimination screens
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # Socket.io service
│   │   ├── types/              # TypeScript definitions
│   │   └── App.tsx             # Main app component
│   ├── dist/                   # Production build (generated)
│   └── package.json
├── server.js                   # Node.js server + game logic
├── package.json               # Server dependencies
├── nixpacks.toml              # Railway deployment config
└── docs/                      # Additional documentation
```

---

## 🎮 How to Play

1. **Choose Mode**
   - 🔥 **Public Battle Royale** - Quick match with random players
   - 🏠 **Custom Room** - Play with friends using Game ID

2. **Gameplay**
   - Type 5-letter words and press ENTER
   - 🟩 Green = Correct letter in correct position
   - 🟨 Yellow = Correct letter in wrong position
   - ⬜ Gray = Letter not in word

3. **Win Conditions**
   - **Battle Royale**: Last player alive wins
   - Complete words quickly to send garbage to opponents
   - Avoid filling your board with garbage rows

---

## 🚀 Deployment

### Railway (Recommended)

Railway auto-deploys from GitHub main branch.

**Requirements:**
- Node.js 20+
- Automatic builds configured via `nixpacks.toml`

**Process:**
1. Push to main branch
2. Railway detects changes
3. Installs dependencies
4. Builds React app
5. Starts server
6. **Live!** 🎉

### Manual Deployment

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Build frontend
npm run build

# Start server
npm start
```

**Environment Variables:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production/development)

---

## 🔧 Development

### Available Scripts

```bash
# Root directory
npm start          # Start production server
npm run dev        # Start with nodemon (auto-reload)
npm run build      # Build React app

# Client directory
cd client
npm run dev        # Start Vite dev server (hot reload)
npm run build      # Build for production
npm run preview    # Preview production build
```

### File Organization

**Components** - Organized by function:
- `Game/` - Core gameplay components
- `UI/` - Reusable UI elements
- `Menus/` - Navigation and lobby screens
- `Overlays/` - Modal/overlay components

**Hooks** - Custom React hooks:
- `useGameState` - Game state management
- `useSocket` - Socket.io connection
- `useKeyboard` - Physical keyboard handling

**Services** - Business logic:
- `socketService` - Centralized Socket.io communication

---

## 🐛 Troubleshooting

### Build Fails
- **Error**: `Vite requires Node.js 20+`
- **Fix**: Upgrade Node.js to v20 or higher

### Connection Issues
- **Error**: "Disconnected from server"
- **Fix**: Check that backend is running on port 3000
- Verify Socket.io proxy in `vite.config.ts`

### Blank Page After Deployment
- **Check**: `client/dist/` folder exists and has files
- **Check**: `server.js` serves static files correctly
- **Check**: No errors in browser console (F12)

---

## 📊 Performance

- **Bundle Size**: 255KB (79KB gzipped)
- **Build Time**: ~2 seconds
- **Load Time**: <2 seconds on fast connection
- **Concurrent Players**: Tested up to 100 players
- **WebSocket Latency**: <100ms (local), <200ms (cross-region)

---

## 🛠️ Tech Details

### State Management
- React hooks for local state
- Socket.io for server synchronization
- Real-time updates pushed from server

### Game Logic
- Server-authoritative (prevents cheating)
- Word validation using official Wordle word lists
- Scoring system with bonuses for speed

### Networking
- WebSocket connections via Socket.io
- Automatic reconnection on disconnect
- Event-based communication pattern

---

## 📝 Version History

### v1.0.1 (Current)
- ✅ React + TypeScript migration complete
- ✅ 15 components, 3 custom hooks
- ✅ Production-ready build system
- ✅ Railway deployment configured

### Previous (v1.0.0)
- Vanilla JavaScript implementation
- Single 3,063-line HTML file
- Available on `vanilla-version` branch

---

## 🤝 Contributing

This is a personal project, but feel free to:
- Report bugs via GitHub Issues
- Suggest features
- Fork and experiment

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🎉 Credits

Built with ❤️ using:
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Socket.io](https://socket.io/)
- [Express](https://expressjs.com/)

Original Wordle by Josh Wardle

---

## 📞 Support

For questions or issues:
- Check `/docs` folder for detailed guides
- Review troubleshooting section above
- Check Railway/Render deployment logs

---

**Ready to play? Join the Battle Royale!** 🎮🔥
