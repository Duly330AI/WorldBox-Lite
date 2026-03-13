# AI (GOAP + Utility)

## Core Idea
The AI uses Utility to select the top goal, then GOAP to generate an action plan that satisfies that goal.

## Inputs
- `unit_behavior_spec.json` defines actions, preconditions, and effects.
- `goal_definitions` bind utility curves to target effects.
- `utility_formulas` define how goals are scored.

## Planner
- Action graph is derived from `actions`.
- Planner searches for a sequence that satisfies the selected goal.
- Plans are recomputed when a new goal is selected or when goal lock expires.

## Unit Roles (Current)
- Workers: gather, build, deliver, found cities.
- Scouts: explore and engage (no harvesting).

## Anti-Oscillation
- Goal lock for N ticks (`plan_lock_ticks`).

## Telemetry Requirements
- Every plan change emits `AI_PLAN_CHANGE`.
- Logs must include utility values for each goal.
