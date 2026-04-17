# 🧠 PRD: AI vs AI Chess Simulation Platform

## 1. 📌 Product Overview

This project is an **AI vs AI Chess Simulation Platform** where multiple AI models (via OpenRouter) play chess against each other. The system allows users to trigger simulations on demand, observe gameplay, and view a leaderboard ranking models based on performance.

The system is designed to run on a **serverless architecture (Vercel)** with **step-based execution**, ensuring compatibility with execution limits.

---

## 2. 🎯 Objectives

* Enable **AI models to play chess autonomously**
* Maintain **game state and context persistence**
* Track **model performance and rankings**
* Provide a **visual simulation UI**
* Build a **scalable, portfolio-grade system**

---

## 3. 🧩 Core Features

### 3.1 AI vs AI Simulation

* User starts simulation manually
* Two selected models play turn-by-turn
* Each move is generated via OpenRouter API
* Game continues until:

  * Checkmate
  * Stalemate
  * Draw
  * Max move limit reached

---

### 3.2 Game State Management (Context Persistence)

* Store:

  * Current board (FEN)
  * Move history (PGN or array)
  * Current turn
* Persist in **NeonDB (PostgreSQL)**

👉 Purpose:

* Prevent models from "forgetting" state
* Enable resume capability (future feature)

---

### 3.3 Move Validation Layer

* Use `chess.js` to:

  * Validate moves
  * Reject illegal moves
  * Detect game end conditions

Fallback strategy:

* Retry AI call OR
* Select random legal move

---

### 3.4 Model Ranking System

* Each model has:

  * Wins
  * Losses
  * Draws
  * Total games
  * Elo-like score (optional)

Ranking page:

* Sorted by performance score
* Benchmark for comparing models

---

### 3.5 Leaderboard UI

* Displays:

  * Model name
  * Win rate
  * Score
  * Total matches
* Auto-updates after each match

---

### 3.6 Simulation UI

* Chessboard visualization
* Move history panel
* Start / Stop button
* Model selection dropdown
* Speed control (optional)

---

## 4. ⚙️ Technical Architecture

### 4.1 Frontend

* Framework: Next.js (React)
* Hosted on Vercel

Responsibilities:

* Control simulation loop
* Maintain temporary state (FEN)
* Trigger API calls
* Render chessboard

---

### 4.2 Backend (Serverless APIs)

* Next.js API routes

Endpoints:

#### `/api/move`

Input:

* FEN
* Model ID

Output:

* Move
* Updated FEN

#### `/api/game`

* Create new game
* Store initial state in DB

#### `/api/result`

* Store game result
* Update rankings

#### `/api/leaderboard`

* Fetch model rankings

---

### 4.3 Database (NeonDB - PostgreSQL)

#### Tables:

### `models`

```sql
id
name
provider
total_games
wins
losses
draws
score
```

### `games`

```sql
id
model_a_id
model_b_id
status
winner
created_at
```

### `moves`

```sql
id
game_id
move_number
fen
move
played_by
```

---

## 5. 🔄 Simulation Flow

### Step-by-Step Execution:

1. User clicks "Start Simulation"
2. Game created in DB
3. Frontend starts loop:

   * Call `/api/move` (Model A)
   * Update board
   * Save move
   * Call `/api/move` (Model B)
   * Repeat
4. On game end:

   * Store result
   * Update rankings

---

## 6. 🤖 AI Integration (OpenRouter)

### Input to Model:

* FEN string
* Instruction prompt

### Output:

* Move in UCI format (e.g., e2e4)

### Prompt Template:

```
You are a chess engine.
Given the board in FEN format, return ONLY the best move in UCI format.

FEN: {fen}
```

### Config:

* Temperature: 0.2
* Max tokens: low

---

## 7. ⚠️ Constraints & Solutions

### Problem: Vercel Timeout

Solution:

* No infinite loops in backend
* Loop handled in frontend

---

### Problem: AI Invalid Moves

Solution:

* Validate via chess.js
* Retry or fallback move

---

### Problem: Stateless Backend

Solution:

* Persist state in NeonDB

---

### Problem: Slow AI Responses

Solution:

* Add delay + loading UI
* Optimize prompt size

---

## 8. 📊 Ranking Logic

Basic scoring:

* Win = +1
* Draw = +0.5
* Loss = 0

Advanced (optional):

* Elo rating system

---

## 9. 🚀 Future Enhancements

* Tournament mode (round-robin)
* Multiple games in parallel
* Replay system
* Game analysis (best/worst moves)
* AI commentary generation
* Stockfish evaluation integration
* WebSocket real-time updates

---

## 10. 🧪 Testing Strategy

* Unit test:

  * Move validation
  * API responses
* Integration test:

  * Full game simulation
* Edge cases:

  * Invalid AI outputs
  * Game loop breaking

---

## 11. 📦 Deployment

* Frontend + API: Vercel
* Database: NeonDB
* Env variables:

  * OPENROUTER_API_KEY
  * DATABASE_URL

---

## 12. 🎯 Success Metrics

* Number of games simulated
* Model performance accuracy
* API response success rate
* UI responsiveness

---

## 13. 🧠 Final System Identity

This is not just a chess app.

👉 It is an:
**AI Benchmarking Platform using Chess as a competitive environment**

---

## 14. 🔥 MVP Scope (Build First)

* AI vs AI match
* Chessboard UI
* Move validation
* Basic leaderboard
* NeonDB integration

---

This PRD is optimized for:

* Fast development using GitHub Copilot
* Clean architecture
* Strong portfolio impact
