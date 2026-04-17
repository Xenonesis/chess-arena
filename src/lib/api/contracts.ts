import { z } from "zod";

export const createGameSchema = z.object({
  whiteModelSlug: z.string().min(2),
  blackModelSlug: z.string().min(2),
  maxPlies: z.number().int().min(20).max(400).default(200),
  initialFen: z.string().optional(),
});

export const moveStepSchema = z.object({
  gameId: z.string().uuid(),
  expectedVersion: z.number().int().positive().optional(),
});

export const resultSchema = z.object({
  gameId: z.string().uuid(),
  result: z.enum(["white_win", "black_win", "draw", "aborted"]),
  terminationReason: z.string().min(2).default("manual"),
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
