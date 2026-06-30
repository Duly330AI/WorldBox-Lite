# WorldBox-Lite

**WorldBox-Lite** is an experimental 2D sandbox/world simulation prototype built as a browser-based portfolio project.

The project explores grid-based world simulation, terrain interaction, simple entity behavior, spec-driven rules, and editor-style controls. It is an early prototype focused on experimentation rather than a finished game.

## Status

**Experimental 2D sandbox simulation prototype**

The project is useful as a portfolio piece for showing simulation-style UI, world-state rendering, Web Worker experiments, and early systems design. It is not a finished game and should not be compared in scope to commercial sandbox or strategy games.

## Features

* Grid-based world map
* Canvas 2D rendering
* Terrain types such as grass, water, sand, forest, lava, and mountain-like areas
* Entity placement and simple entity simulation
* Simulation tick/day counter
* Pause/resume controls
* Editor-style UI
* Early save/load/reset controls
* Event log and inspector panels
* Experimental JSON/spec-driven rule structure
* Web Worker simulation experiments
* AJV-based spec validation

## Experimental / Planned Concepts

The repository includes early experiments and documentation around larger simulation concepts. These should be treated as prototype systems and design experiments, not complete gameplay.

* Faction behavior experiments
* JSON rule/spec validation
* GOAP or utility-style behavior concepts
* City, combat, economy, and tech-tree specs
* More advanced simulation rules

## Screenshots

<img width="1880" height="860" alt="Screenshot 2026-03-13 012229" src="https://github.com/user-attachments/assets/77a40eea-c821-4fa6-8a49-22153f356f3d" />

## Tech Stack

* React
* TypeScript
* Vite
* Canvas 2D
* Web Worker
* AJV
* Zustand
* Vitest

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

## Getting Started

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Run tests

```bash
npm run test
```

## Documentation

See `docs/README.md` for extended documentation.

## Notes

This is an experimental portfolio prototype for exploring world simulation, canvas rendering, and system-design ideas.

This project is an unofficial learning/portfolio implementation and is not affiliated with WorldBox, Civilization, or their rights holders.
