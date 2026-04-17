# AI vs AI Chess Simulation Platform

This project is a serverless-friendly AI benchmarking platform where OpenRouter models play chess against each other. Every turn is persisted to NeonDB and validated with chess.js.

## MVP includes

- AI vs AI simulation loop
- Live model catalog from OpenRouter API (with searchable selection UI)
- Move validation and deterministic fallback for invalid model outputs
- Persistent game state in PostgreSQL
- Leaderboard with confidence-adjusted scoring
- Next.js App Router API and UI hosted on Vercel

## Tech stack

- Next.js 16 + React 19
- Neon PostgreSQL + Drizzle ORM
- OpenRouter via OpenAI SDK
- chess.js for rule enforcement
- react-chessboard for board rendering
- Vitest for unit tests

## Setup

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Fill required environment values in `.env.local`:

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- Optional: `OPENROUTER_BASE_URL`
- Optional: `OPENROUTER_APP_NAME`

3. Install dependencies:

```bash
npm install
```

4. Create DB schema:

```bash
npm run db:generate
npm run db:migrate
```

5. Start development server:

```bash
npm run dev
```

## API endpoints

- `GET /api/models`: returns available model catalog
- `POST /api/game`: create a new game
- `GET /api/game?gameId=<uuid>`: fetch game snapshot and moves
- `POST /api/move`: execute one move (one ply)
- `POST /api/result`: finalize/abort a game
- `GET /api/leaderboard`: fetch ranked models

## Verification commands

```bash
npm run lint
npm run test
```

## Notes

- Backend loop is step-based (one move per request) to avoid serverless timeout.
- OpenRouter failure returns an API error. The deterministic fallback path is used for invalid model outputs, not synthetic offline play.
- Game page is dynamic and reads live database state.
