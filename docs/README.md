# CivWorldBox Docs

Single Source of Truth for the project architecture, data specs, and AI behavior.

## What This Project Is
CivWorldBox is a simulation that combines WorldBox-style cellular dynamics with Civilization-style faction strategy. The engine runs in a Web Worker, the UI renders via Canvas, and all rules/data are driven by JSON Specs validated with AJV.

## Quick Links
- Architecture: `docs/architecture.md`
- Specs Overview: `docs/specs.md`
- State Model: `docs/state_model.md`
- AI/GOAP: `docs/ai.md`
- Telemetry: `docs/telemetry.md`
- Rendering: `docs/rendering.md`
- Cities & Economy: `docs/cities_economy.md`

## Source of Truth
- Specs live in `specs/` and are mirrored in `public/specs/` for browser loading.
- Schemas live in `src/specs/schemas/` and are validated with AJV.

## MVP WorldBox Dynamics
- Lava: damage tile, transforms adjacent grass to sand.
- Fire: cellular spread on forest features and house buildings, leaves sand.
- Wolves: neutral hostile entity, GOAP with simple chase/attack.
- Trees: organic growth on grass.

## Factions
- Support up to 8 factions.
- MVP setup: 2 factions (red, blue).

## Determinism
- Worker uses deterministic RNG (seeded).
- All gameplay changes come from the Specs or deterministic simulation rules.
