# CivWorldBox / WorldBox-Lite

**CivWorldBox** is an experimental 2D sandbox simulation prototype built with **Vite**, **React**, **TypeScript**, and **Canvas 2D**.

The project explores a mix of **WorldBox-style cellular world simulation** and **Civilization-style faction strategy**. It is focused on grid-based world generation, terrain editing, simple entities, simulation ticks, and an early spec-driven architecture.

This is not a finished game. It is a prototype and learning project for experimenting with sandbox simulation mechanics, AI behavior concepts, and data-driven game rules.

## Status

**Prototype / experimental sandbox**

The current version demonstrates the foundation of a world simulation, editor-style interaction, and early architecture ideas. Advanced AI behavior, deep faction strategy, long-term simulation balance, and complete gameplay loops are not fully implemented yet.

## Features

* Grid-based world map
* Canvas 2D rendering
* Terrain types such as grass, water, sand, forest, lava, and mountain-like areas
* Entity placement such as humans, trees, wolves, and test workers
* Simulation tick/day counter
* Pause/resume controls
* Basic editor-style UI
* Early save/load/reset controls
* Early event log and inspector panels
* Experimental spec-driven rule structure

## Vision

The long-term idea was to combine:

* emergent cellular simulation such as fire, lava, forests, and neutral predators
* simple faction behavior and resource interaction
* spec-driven rules that can be changed through JSON
* early AI autonomy concepts such as GOAP and utility-based decision making

Not all of these systems are complete in the current prototype.

## Tech Stack

* Vite
* React
* TypeScript
* Canvas 2D
* Web Worker for simulation loop experiments
* AJV for JSON Schema validation
* Zustand for UI state

## Architecture

* `specs/` contains JSON-based rule definitions.
* `public/specs/` mirrors runtime-loadable specs.
* The simulation worker validates specs, builds runtime state, and advances the simulation.
* The UI renders snapshots and displays telemetry, event logs, and inspector data.

## Key Specs

* `specs/world_spec.json`
* `specs/state_spec.json`
* `specs/tech_spec.json`
* `specs/unit_behavior_spec.json`

## Screenshots

Add screenshots here, for example:

```md
<img width="1880" height="860" alt="Screenshot 2026-03-13 012229" src="https://github.com/user-attachments/assets/77a40eea-c821-4fa6-8a49-22153f356f3d" />

```

## Getting Started

```bash
npm install
npm run dev
```

## Documentation

See `docs/README.md` for the extended documentation.

## Notes

This repository is kept as an experimental prototype. It demonstrates early work on simulation architecture, grid-based world interaction, spec-driven rules, and sandbox-style UI tooling.
