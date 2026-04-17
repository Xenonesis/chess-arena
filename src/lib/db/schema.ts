import {
  bigint,
  boolean,
  char,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const gameStatusEnum = pgEnum("game_status", [
  "queued",
  "running",
  "paused",
  "completed",
  "aborted",
]);

export const gameResultEnum = pgEnum("game_result", [
  "white_win",
  "black_win",
  "draw",
  "aborted",
]);

export const moveSourceEnum = pgEnum("move_source", [
  "model",
  "retry",
  "fallback",
]);

export const models = pgTable(
  "models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    provider: text("provider").notNull().default("openrouter"),
    openrouterModel: text("openrouter_model").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    totalGames: integer("total_games").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    score: numeric("score", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("models_slug_key").on(table.slug),
    uniqueIndex("models_openrouter_model_key").on(table.openrouterModel),
    index("models_score_idx").on(table.score, table.totalGames),
  ],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    modelWhiteId: uuid("model_white_id")
      .notNull()
      .references(() => models.id),
    modelBlackId: uuid("model_black_id")
      .notNull()
      .references(() => models.id),
    status: gameStatusEnum("status").notNull().default("queued"),
    result: gameResultEnum("result"),
    winnerModelId: uuid("winner_model_id").references(() => models.id),
    terminationReason: text("termination_reason"),
    currentFen: text("current_fen").notNull(),
    turn: char("turn", { length: 1 }).notNull(),
    ply: integer("ply").notNull().default(0),
    maxPlies: integer("max_plies").notNull().default(300),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("games_status_created_at_idx").on(table.status, table.createdAt),
    index("games_white_black_idx").on(
      table.modelWhiteId,
      table.modelBlackId,
      table.createdAt,
    ),
  ],
);

export const moves = pgTable(
  "moves",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    ply: integer("ply").notNull(),
    playedByModelId: uuid("played_by_model_id")
      .notNull()
      .references(() => models.id),
    moveUci: varchar("move_uci", { length: 5 }).notNull(),
    moveSan: text("move_san").notNull(),
    fenBefore: text("fen_before").notNull(),
    fenAfter: text("fen_after").notNull(),
    source: moveSourceEnum("source").notNull().default("model"),
    fallbackReason: text("fallback_reason"),
    modelRawOutput: text("model_raw_output"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("moves_game_ply_key").on(table.gameId, table.ply),
    index("moves_game_ply_idx").on(table.gameId, table.ply),
  ],
);

export type ModelRow = typeof models.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type MoveRow = typeof moves.$inferSelect;

export type GameStatus = (typeof gameStatusEnum.enumValues)[number];
export type GameResult = (typeof gameResultEnum.enumValues)[number];
export type MoveSource = (typeof moveSourceEnum.enumValues)[number];
