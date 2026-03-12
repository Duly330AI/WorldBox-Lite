1️⃣ world_spec.json

Dieses File definiert den "Physischen Rahmen" deiner Welt. Der Agent wird dies als "Source of Truth" für die Map-Generierung und Tile-Eigenschaften nutzen.

code
JSON
download
content_copy
expand_less
{
  "spec_id": "world_v1",
  "version": "1.0",
  "description": "Definition des physischen Grids und der Tile-Eigenschaften für die WorldBox-Simulation.",
  "grid": {
    "default_dimensions": [80, 80],
    "wrap_around": false,
    "tile_size_pixels": 32
  },
  "terrain_types": {
    "grass": { "movement_cost": 1, "is_walkable": true, "resource_yield": { "food": 1 } },
    "water": { "movement_cost": 99, "is_walkable": false, "resource_yield": {} },
    "sand": { "movement_cost": 2, "is_walkable": true, "resource_yield": { "food": 0 } },
    "mountain": { "movement_cost": 5, "is_walkable": true, "resource_yield": { "production": 2 } },
    "lava": { "movement_cost": 5, "is_walkable": true, "damage_per_tick": 20 }
  },
  "resources": {
    "food": { "stackable": true, "decay_rate": 0.05 },
    "wood": { "stackable": true, "decay_rate": 0 },
    "gold": { "stackable": true, "decay_rate": 0 }
  },
  "world_generation": {
    "noise_type": "perlin",
    "biomes": ["grassland", "desert", "mountains"],
    "lake_density": 0.15,
    "forest_density": 0.3
  },
  "global_rules": {
    "tick_duration_ms": 500,
    "max_entities_per_tile": 1
  }
}
