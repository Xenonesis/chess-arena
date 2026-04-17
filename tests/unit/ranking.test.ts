import { describe, expect, it } from "vitest";
import { getConfidenceScore, getPointsDelta } from "@/lib/ranking/points";

describe("ranking points", () => {
  it("assigns point values correctly", () => {
    expect(getPointsDelta("white", "white_win")).toBe(1);
    expect(getPointsDelta("black", "white_win")).toBe(0);
    expect(getPointsDelta("white", "draw")).toBe(0.5);
  });

  it("computes confidence adjusted score", () => {
    const score = getConfidenceScore(8, 10);
    expect(score).toBeCloseTo(0.65, 2);
  });
});
