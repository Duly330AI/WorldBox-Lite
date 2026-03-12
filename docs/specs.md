# Specs Overview

Specs are the single source of truth for all simulation rules and data. Each spec has a JSON Schema validated by AJV.

## Active Specs
- `specs/world_spec.json` (validated by `src/specs/schemas/world_spec.schema.json`)
- `specs/state_spec.json` (validated by `src/specs/schemas/state_spec.schema.json`)
- `specs/tech_spec.json` (validated by `src/specs/schemas/tech_spec.schema.json`)
- `specs/unit_behavior_spec.json` (validated by `src/specs/schemas/unit_behavior_spec.schema.json`)

## Loading
- Specs are mirrored into `public/specs/` for runtime fetch.
- Worker loads from `public/specs` and validates with AJV before use.

## Spec Dependencies
- `world_spec` defines tiles and terrain.
- `state_spec` defines TypedArray layout and entity properties.
- `tech_spec` defines the tech graph and unlocks.
- `unit_behavior_spec` defines GOAP actions and utility curves.
  - `goal_definitions` binds utility curves to target effects.
  - `utility_formulas` define the scoring functions.

## Consistency Rules
- Tech unlocks must reference real Unit/Building IDs.
- Feature IDs and Terrain IDs must not overlap.
- All arrays must obey the sizes defined in `state_spec`.
