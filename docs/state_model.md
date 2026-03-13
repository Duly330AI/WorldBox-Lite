# State Model

The WorldState lives in the worker as TypedArrays for performance and transfer efficiency.

## Tile Buffers
Each tile buffer length equals `width * height`.
- `terrain_buffer`: `Uint8Array`
- `feature_buffer`: `Uint8Array`
- `building_buffer`: `Uint16Array`
- `height_buffer`: `Int8Array`
- `pollution_buffer`: `Uint8Array`
- `explored_buffer`: `Uint8Array` (bitmask for 8 factions)

## Entity Buffers
Entity buffers are SoA (Structure of Arrays) aligned with `max_entities`.
The `properties_per_entity` entries in `state_spec.json` define the exact fields and widths.

## Transfer Strategy
- Prefer `SharedArrayBuffer` when available.
- Fallback to Transferables (ArrayBuffer) when SAB is not available.

## Deterministic Layout
- Buffer sizes are derived from `state_spec` and `world_spec`.
- No dynamic resizing in the worker.
