# Telemetry

## Purpose
Telemetry is designed for post-hoc analysis and training. Logs must be rich enough to explain wins/losses based on decisions (especially tech choices).

## Core Events (Current)
- `AI_PLAN_CHANGE`: AI selects a new goal/plan.
- `UNIT_ACTION`: unit performed an action.
- `ECONOMY_UPDATE`: resource deltas from actions.
- `RESEARCH_TARGET`: faction sets a tech target.
- `TECH_UNLOCKED`: tech completed.
- `UNIT_DIED`: combat death.
- `MATCH_OVER`: victory milestone.
- `WORLD_EVENT`: fire/lava/tree growth events.

## Required Fields (All Events)
- `ts` (timestamp)
- `tick` (simulation tick)
- `event_type`

## Optional Fields (Common)
- `faction_id` (not always present)
- `entity_id` (if applicable)
- `level` (INFO/DECISION/COMBAT/ECONOMY)

## AI_PLAN_CHANGE Requirements
- `goal`
- `plan` (ordered action list)
- `utilities` (raw utility values for each goal)
- `reason` (short string)

## Export Note
The `export_spec` event streams currently mirror raw event entries and do not include `ts` or `tick`.
