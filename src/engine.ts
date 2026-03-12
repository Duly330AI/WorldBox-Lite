import { WorldState, Entity, TerrainType } from './types';

export function createInitialState(width = 20, height = 20): WorldState {
  const terrain: TerrainType[][] = Array(height).fill(null).map(() => Array(width).fill('grass'));
  
  // Add some water and sand
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < 3 || y < 3) terrain[y][x] = 'water';
      else if (x < 4 || y < 4) terrain[y][x] = 'sand';
    }
  }

  return {
    width,
    height,
    terrain,
    entities: [
      { id: '1', type: 'tree', x: 5, y: 5, growth_stage: 0, max_growth: 3, health: 100 },
      { id: '2', type: 'human', x: 10, y: 10, health: 100, hunger: 0 },
      { id: '3', type: 'wolf', x: 15, y: 15, health: 100 }
    ],
    step: 0
  };
}

export function simulateStep(state: WorldState): WorldState {
  const newState = { ...state, step: state.step + 1 };
  
  // Create a map of entities by position for quick lookup
  const entityMap = new Map<string, Entity[]>();
  state.entities.forEach(e => {
    const key = `${e.x},${e.y}`;
    if (!entityMap.has(key)) entityMap.set(key, []);
    entityMap.get(key)!.push(e);
  });

  const newEntities: Entity[] = [];
  const newTrees: Entity[] = [];
  const killedEntityIds = new Set<string>();

  // Process existing entities
  state.entities.forEach(entity => {
    if (entity.health <= 0 || killedEntityIds.has(entity.id)) return;

    let nextEntity = { ...entity };

    if (nextEntity.type === 'tree') {
      if (nextEntity.growth_stage! < nextEntity.max_growth!) {
        nextEntity.growth_stage! += 1;
      } else {
        // Spread seeds
        if (Math.random() < 0.05) {
          const dx = Math.floor(Math.random() * 3) - 1;
          const dy = Math.floor(Math.random() * 3) - 1;
          const nx = nextEntity.x + dx;
          const ny = nextEntity.y + dy;
          if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height) {
            if (state.terrain[ny][nx] === 'grass') {
              const key = `${nx},${ny}`;
              const occupied = (entityMap.get(key) || []).some(e => e.type === 'tree') || newTrees.some(e => e.x === nx && e.y === ny);
              if (!occupied) {
                newTrees.push({
                  id: Math.random().toString(36).substr(2, 9),
                  type: 'tree',
                  x: nx,
                  y: ny,
                  growth_stage: 0,
                  max_growth: 3,
                  health: 100
                });
              }
            }
          }
        }
      }
    } else if (nextEntity.type === 'human') {
      nextEntity.hunger! += 1;
      if (nextEntity.hunger! > 50) {
        nextEntity.health -= 1;
      }
      
      // Move random
      const dx = Math.floor(Math.random() * 3) - 1;
      const dy = Math.floor(Math.random() * 3) - 1;
      const nx = nextEntity.x + dx;
      const ny = nextEntity.y + dy;
      if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height) {
        if (state.terrain[ny][nx] === 'grass' || state.terrain[ny][nx] === 'sand') {
          nextEntity.x = nx;
          nextEntity.y = ny;
        }
      }
    } else if (nextEntity.type === 'wolf') {
      nextEntity.health -= 1; // hunger
      
      // Hunt
      let hunted = false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = nextEntity.x + dx;
          const ny = nextEntity.y + dy;
          const key = `${nx},${ny}`;
          const humans = (entityMap.get(key) || []).filter(e => e.type === 'human' && e.health > 0 && !killedEntityIds.has(e.id));
          if (humans.length > 0) {
            // Kill human
            const target = humans[0];
            killedEntityIds.add(target.id);
            nextEntity.health = Math.min(100, nextEntity.health + 20);
            nextEntity.x = nx;
            nextEntity.y = ny;
            hunted = true;
            break;
          }
        }
        if (hunted) break;
      }

      if (!hunted) {
        // Move random
        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        const nx = nextEntity.x + dx;
        const ny = nextEntity.y + dy;
        if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height) {
          if (state.terrain[ny][nx] !== 'water') {
            nextEntity.x = nx;
            nextEntity.y = ny;
          }
        }
      }
    }

    if (nextEntity.health > 0 && !killedEntityIds.has(nextEntity.id)) {
      newEntities.push(nextEntity);
    }
  });

  newState.entities = [...newEntities.filter(e => !killedEntityIds.has(e.id)), ...newTrees];

  return newState;
}
