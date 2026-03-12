# Telemetry

## Purpose
Telemetry is designed for post-hoc analysis and training. Logs must be rich enough to explain wins/losses based on decisions (especially tech choices).

## Core Events (MVP)
- `AI_PLAN_CHANGE`: emitted when the AI selects a new plan.
- `TECH_RESEARCH_START`: a faction begins a tech.
- `TECH_RESEARCH_COMPLETE`: a tech is completed.
- `COMBAT_RESOLVE`: combat event summary.
- `WORLD_EVENT`: fire/lava/tree growth events.

## Required Fields (All Events)
- `ts` (timestamp)
- `tick` (simulation tick)
- `faction_id`
- `entity_id` (if applicable)
- `event_type`

## AI_PLAN_CHANGE Requirements
- `goal`
- `plan` (ordered action list)
- `utilities` (raw utility values for each goal)
- `reason` (short string)
