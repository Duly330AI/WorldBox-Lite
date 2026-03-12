# Rendering

## Approach
- Canvas 2D renders the world grid.
- Terrain is drawn from `terrain_buffer` using color mapping.
- UI never mutates engine state directly.

## Performance
- Render only on new buffer snapshots or ticks.
- Prefer dirty-rect updates when entities are introduced.

## Visual Mapping
- Colors are defined in UI code for now.
- Long-term: move mappings into a `visualization_spec.json`.
