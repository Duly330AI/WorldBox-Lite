import { describe, expect, it } from "vitest";
import unitBehaviorSpec from "../specs/unit_behavior_spec.json";

function buildFormula(expr: string) {
  const safe = expr.replace(/\s+/g, "");
  const normalized = safe.replace(/\^/g, "**");
  return (vars: Record<string, number>) => {
    const fn = new Function("vars", `with (vars) { return (${normalized}); }`) as (
      v: Record<string, number>
    ) => number;
    const value = fn(vars);
    return Number.isFinite(value) ? value : 0;
  };
}

function computeUtilities(inputs: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const [key, expr] of Object.entries(unitBehaviorSpec.utility_formulas)) {
    out[key] = buildFormula(expr)(inputs);
  }
  return out;
}

function pickGoal(utilities: Record<string, number>) {
  let best = "";
  let bestScore = -Infinity;
  let bestPriority = Number.MAX_SAFE_INTEGER;
  for (const [goal, def] of Object.entries(unitBehaviorSpec.goal_definitions)) {
    const score = utilities[def.utility_curve] ?? 0;
    if (score > bestScore || (score === bestScore && def.priority < bestPriority)) {
      bestScore = score;
      bestPriority = def.priority;
      best = goal;
    }
  }
  return best;
}

describe("GOAP utility", () => {
  it("wood shortage prioritizes GATHERING", () => {
    const utilities = computeUtilities({ wood: 0, health: 100, hunger: 0, tiles_explored: 1, enemy_nearby: 0 });
    const goal = pickGoal(utilities);
    expect(goal).toBe("GATHERING");
  });
});
