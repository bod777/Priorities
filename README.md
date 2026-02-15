# Priorities

A multiplayer ranking game where players submit cards, one player ranks them, and others try to guess the ranking.

## Features

- 3-6 player support
- Real-time multiplayer with Socket.IO
- Multiple game modes (individual, collective guessing)
- Authorship guessing
- Personal rankings
- Progressive reveal animations
- Disconnection handling with auto-submit
- Mobile-responsive design

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Backend**: Node.js, Express, Socket.IO
- **Shared**: TypeScript types across client and server
- **Deployment**: Railway

## Development

### Prerequisites

- Node.js 18+ and npm

### Setup

```bash
# Install dependencies
npm install

# Run development servers (client + server)
npm run dev

# Run typecheck
npm run typecheck

# Build for production
npm run build

# Start production server
npm start
```

### Project Structure

```
priorities/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   └── screens/
│   └── package.json
├── server/          # Express + Socket.IO backend
│   ├── src/
│   │   ├── handlers/
│   │   ├── cards.ts
│   │   ├── game.ts
│   │   ├── lobby.ts
│   │   ├── scoring.ts
│   │   └── index.ts
│   └── package.json
├── shared/          # Shared TypeScript types
│   └── src/types.ts
└── package.json     # Root workspace config
```

## Deployment

### Railway

1. Push code to GitHub
2. Create new Railway project from GitHub repo
3. Set environment variable: `NODE_ENV=production`
4. Railway will automatically build and deploy
5. Access via the generated Railway URL

## Game Rules

1. **Lobby**: 3-6 players join a lobby with a 4-character code
2. **Card Submission**: Each player submits a card (except the ranker)
3. **Ranking**: One player (the ranker) ranks all submitted cards
4. **Guessing**: Other players try to guess the ranker's ranking
5. **Reveal**: Scores are calculated and revealed progressively
6. **Multiple Rounds**: Game continues for the configured number of rounds
7. **Game Over**: Final scores and superlatives are shown

## License

MIT
