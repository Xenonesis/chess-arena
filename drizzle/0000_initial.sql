CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "game_status" AS ENUM ('queued', 'running', 'paused', 'completed', 'aborted');
CREATE TYPE "game_result" AS ENUM ('white_win', 'black_win', 'draw', 'aborted');
CREATE TYPE "move_source" AS ENUM ('model', 'retry', 'fallback');

CREATE TABLE "models" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "provider" text NOT NULL DEFAULT 'openrouter',
  "openrouter_model" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "total_games" integer NOT NULL DEFAULT 0,
  "wins" integer NOT NULL DEFAULT 0,
  "losses" integer NOT NULL DEFAULT 0,
  "draws" integer NOT NULL DEFAULT 0,
  "score" numeric(12,2) NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "games" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "model_white_id" uuid NOT NULL REFERENCES "models"("id"),
  "model_black_id" uuid NOT NULL REFERENCES "models"("id"),
  "status" game_status NOT NULL DEFAULT 'queued',
  "result" game_result,
  "winner_model_id" uuid REFERENCES "models"("id"),
  "termination_reason" text,
  "current_fen" text NOT NULL,
  "turn" char(1) NOT NULL,
  "ply" integer NOT NULL DEFAULT 0,
  "max_plies" integer NOT NULL DEFAULT 300,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "moves" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "game_id" uuid NOT NULL REFERENCES "games"("id") ON DELETE CASCADE,
  "ply" integer NOT NULL,
  "played_by_model_id" uuid NOT NULL REFERENCES "models"("id"),
  "move_uci" varchar(5) NOT NULL,
  "move_san" text NOT NULL,
  "fen_before" text NOT NULL,
  "fen_after" text NOT NULL,
  "source" move_source NOT NULL DEFAULT 'model',
  "fallback_reason" text,
  "model_raw_output" text,
  "latency_ms" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "models_slug_key" ON "models" ("slug");
CREATE UNIQUE INDEX "models_openrouter_model_key" ON "models" ("openrouter_model");
CREATE INDEX "models_score_idx" ON "models" ("score", "total_games");

CREATE INDEX "games_status_created_at_idx" ON "games" ("status", "created_at");
CREATE INDEX "games_white_black_idx" ON "games" ("model_white_id", "model_black_id", "created_at");

CREATE UNIQUE INDEX "moves_game_ply_key" ON "moves" ("game_id", "ply");
CREATE INDEX "moves_game_ply_idx" ON "moves" ("game_id", "ply");
