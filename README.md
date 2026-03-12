# CivWorldBox (WorldBox-Lite)

CivWorldBox combines WorldBox-style cellular dynamics with Civilization-style faction strategy. The simulation runs in a Web Worker, rendering is Canvas 2D, and all rules are driven by JSON Specs validated with AJV.

## Vision
- Emergent simulation: fire, lava, forests, neutral predators, and evolving factions.
- Spec-driven engine: change JSON, behavior changes immediately.
- AI autonomy: GOAP + Utility for intent → plan → action.

## Tech Stack
- Vite + React + TypeScript
- Web Worker for simulation loop
- Canvas 2D for rendering
- AJV for JSON Schema validation
- Zustand for UI state

## Architecture (Short)
- `specs/` holds the single source of truth.
- `public/specs/` mirrors specs for runtime loading.
- Worker validates specs, builds typed buffers, runs AI + simulation.
- UI renders snapshots and shows telemetry.

## Key Specs
- `specs/world_spec.json`
- `specs/state_spec.json`
- `specs/tech_spec.json`
- `specs/unit_behavior_spec.json`

## Getting Started (once Node is available)
```bash
npm install
npm run dev
```

## Docs
See `docs/README.md` for the full docbase.
