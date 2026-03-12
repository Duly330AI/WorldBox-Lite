# Architecture

## Runtime Topology
- UI: React + Canvas 2D (render only)
- Engine: Web Worker (simulation, AI, data validation)
- Data: JSON Specs + JSON Schemas (AJV)

## Data Flow
- UI loads worker.
- Worker loads Specs from `public/specs` and validates them.
- Worker builds initial WorldState (TypedArrays).
- Worker emits state buffers and telemetry logs to the UI.

## Determinism
- The worker uses a seeded RNG.
- Given identical Specs, seed, and player inputs, the simulation is deterministic.

## World Simulation Loop (High Level)
1. Apply environmental dynamics (fire, lava, tree growth).
2. Process AI decisions (GOAP + Utility).
3. Update entities (movement/combat/resources).
4. Emit telemetry logs.
5. Render snapshot in UI.

## Worker Message Protocol (Current)
- `init`: load and validate specs, build initial buffers.
- `state`: return buffers and specs.
- `log`: telemetry entries.
- `error`: fatal error string.

## Planned Message Types
- `ai_tick`: run AI plan generation for one or more factions.
- `sim_tick`: advance simulation by one tick.
