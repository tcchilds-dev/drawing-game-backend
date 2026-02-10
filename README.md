# Drawing Game Backend

Express + Socket.IO backend for a realtime multiplayer drawing game.

It handles:

- player identity setup
- room creation and joins
- game flow (rounds, word selection, timers, scoring)
- drawing event relay/synchronization
- disconnect/reconnect grace behavior

## Tech Stack

- Node.js + Express
- Socket.IO
- TypeScript
- typia runtime validation
- Vitest integration tests

## Requirements

- Node.js 22+
- pnpm 10+

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

1. Create local env file:

```bash
cp .env.example .env
```

1. Set env values (defaults shown):

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

1. Build and run:

```bash
pnpm run build
pnpm start
```

Server health check:

```bash
curl http://localhost:3000/health
```

## Scripts

- `pnpm run build` - compile TypeScript to `dist/`
- `pnpm start` - run compiled server (`dist/src/index.js`)
- `pnpm test` - build + run integration tests

## Environment Variables

- `PORT` - HTTP port to bind (Render provides this automatically)
- `CORS_ORIGIN` - allowed frontend origin(s) for Socket.IO CORS

`CORS_ORIGIN` accepts a comma-separated list.  
Example:

```env
CORS_ORIGIN=https://my-game.pages.dev,https://my-preview.workers.dev
```

## API Surface

### HTTP

- `GET /health` -> `{ "status": "ok" }`

### Socket.IO (high level)

- User: `user:username`
- Room: `room:create`, `room:join`, `room:leave`
- Game: `game:start`, `word:choice`, `chat:guessage`
- Drawing: `stroke:start`, `stroke:points`, `stroke:end`, `canvas:undo`, `canvas:clear`

Event contracts are defined in `src/types/event.types.ts`.

## Game Rules and Runtime Notes

- Minimum 2 players required to start a game.
- Room config supports max players, rounds, draw timer, word choice count, and other lobby options.
- Scores are time-weighted per correct guess.
- Artist disconnect behavior:
  - short grace window before skipping turn if needed
  - longer grace window before removing disconnected players
- Game and room state are in-memory (`Map`), so process restarts reset active rooms/games.

## Word List

- Primary source: `words.txt` in project root.
- If missing/unreadable/empty, the server uses a small fallback word list and logs a warning.

## Deployment

Primary deployment target is Render.

- `render.yaml` is included for blueprint deploys.
- Required env var in Render: `CORS_ORIGIN=<your-frontend-origin>`
- Recommended build command: `pnpm install --frozen-lockfile && pnpm run build`
- Start command: `pnpm start`

See `DEPLOYMENT.md` for full backend + frontend deployment steps.

## Troubleshooting

- `ERR_MODULE_NOT_FOUND` at startup on Render:
  - Ensure build command includes `pnpm run build`.
  - Clear build cache and redeploy.
- Frontend cannot connect:
  - Verify `CORS_ORIGIN` includes the exact deployed frontend origin.
  - Verify frontend `VITE_SOCKET_URL` points to this backend URL.
