# Testing Strategy

This project is spec-driven and deterministic. The testing goal is to catch regressions in Specs, validation, and core simulation logic early.

## Test Layers

### 1) Schema Tests (Critical)
Validate all JSON Specs against their JSON Schemas using AJV. This prevents broken or incompatible specs from slipping in.

### 2) Determinism Tests
Given identical specs and the same RNG seed, world generation must produce identical buffers (terrain/features). This protects the simulation from random drift.

### 3) Worker Unit Tests
- Utility → Goal → Plan selection
- Action execution (e.g. CHOP_WOOD)
- Pathfinding (movement toward target)

### 4) Lightweight Integration Tests
Worker `init` → `sim_tick` → expected log events.

## Commands
- `npm run test` — run the full test suite
- `npm run test:watch` — watch mode

## Notes
Tests are intentionally minimal at first. As specs grow, add more tests around state transitions and event logging.
