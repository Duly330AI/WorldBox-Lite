# Cities, Resources, Logistics (Design Draft)

This document is the source of truth for the upcoming city, economy, and logistics systems. It is written to avoid drift before implementation.

## Design Goals
- Add city entities with Civilization-style population sizes.
- Make food, growth, and starvation meaningful.
- Add stone, copper, and iron with mining and tech gates.
- Make roads increase transport and movement efficiency.
- Keep rules deterministic and spec-driven.

## Core Concepts
- City center is a building entity that owns a working radius.
- Cities cannot be placed adjacent to another city center.
- Population is discrete: size 1, size 2, size 3.
- City growth depends on food surplus and storage.
- Workers are required to build improvements and harvest yields.

## City Placement Rules
- Action: `FOUND_CITY`.
- Placement must be on passable land.
- No adjacency: a city center cannot be placed on any of the 8 neighboring tiles of another city center.
- No overlap: working radii must not overlap between cities.

## City Size and Radius
- Size 1: radius 1 (3x3 square, Chebyshev distance).
- Size 2: radius 2.
- Size 3: radius 3.
- Radius determines which tiles can be worked for yields.
- City size unlocks benefits:
  - Size 1: basic storage, 1 working tile group.
  - Size 2: larger storage, +1 working tile group, improved production.
  - Size 3: largest storage, +2 working tile groups, strategic bonuses (e.g., faster build).

## Food, Growth, Starvation
- City has local food stockpile.
- Each size consumes food per tick:
  - Size 1: 2 food per tick.
  - Size 2: 4 food per tick.
  - Size 3: 6 food per tick.
- Surplus food increases growth points.
- When growth points reach threshold, city size increases.
- If stockpile is empty, city loses growth points.
- If growth points reach 0 while starving, size decreases by 1.

## Tile Yields (Base)
- Grass: 1 food.
- Grass with wheat feature: 2 food.
- Forest: 1 wood.
- Hills: 1 stone.
- Mountain: 2 stone, but slower movement.
- Water: 0 food unless fishing tech.

## Improvements
- Farm: build on grass, yield 2 food. Requires worker to harvest.
- Mine: build on ore (stone, copper, iron), yields ore per tick.
- Quarry: build on stone tile, yields stone per tick.
- Road: build on passable tile, reduces movement cost and increases transport capacity.
- Storage building: expands city stockpile capacity.

## Mining and Metals
- New resources: stone, copper, iron.
- Mining yields base 1 ore per tick.
- With relevant tech, mine yield increases:
  - Copper Working: +1 copper yield.
  - Iron Working: +1 iron yield.
- Smelting converts copper + tin (optional) to bronze, and iron to steel later.
- Metals unlock better units and faster construction.

## Roads and Transport
- Roads reduce movement cost for units on the road tile.
- Roads increase transport throughput between cities and resource sites.
- Workers can carry resources and prefer roads.
- Roads can provide a percent bonus to resource delivery:
  - +50 percent delivery rate when at least 60 percent of the path is on roads.
  - Movement cost minimum is 1.

## Workers and Harvesting
- Worker actions:
  - Build improvements.
  - Harvest farms.
  - Mine ore.
  - Deliver resources to city stockpile.
- Farms require periodic harvest to produce food.
- Mines and quarries produce automatically but still need delivery.

## Ownership and Working Tiles
- City claims tiles within its radius.
- Only the owning city can work claimed tiles.
- If two cities overlap, resolve by priority or disallow overlap (see Open Questions).

## Tech Tree Hooks
- Agriculture: unlocks farms, increases food yield.
- Mining: unlocks quarries, copper mines.
- Bronze Working: improves copper yield, unlocks bronze units.
- Iron Working: unlocks iron mines, iron units.
- Road Building: unlocks roads and transport bonuses.

## AI Implications
- New goals:
  - SETTLE (found city).
  - IMPROVE (farm, mine, road).
  - SUPPLY (deliver resources).
  - GROW_CITY (prioritize food surplus).
- Utility curves should consider:
  - Food deficit or surplus.
  - Available city slots.
  - Known nearby resources.
  - Road connectivity.

## Telemetry and Events
- New events:
  - CITY_FOUNDED
  - CITY_GROWTH
  - CITY_STARVATION
  - IMPROVEMENT_BUILT
  - RESOURCE_DELIVERED
- City dashboards show:
  - Size, food stockpile, growth points, worked tiles.

## Data Model Changes (High Level)
- State: add city entity type, city size, stockpile, growth points, radius.
- Specs: add resource definitions for stone, copper, iron.
- World: add ore features and optional wheat feature.
- Behavior: add actions for `FOUND_CITY`, `BUILD_FARM`, `BUILD_MINE`, `BUILD_ROAD`, `DELIVER_RESOURCES`.

## Decisions (Locked)
- Radius shape: square (Chebyshev).
- Overlap: disallowed.
- Food economy: local city stockpile only.
- Road bonus: movement and delivery.
- Minimum city distance: no adjacent centers (8-neighbor rule), plus no radius overlap.
