import { WorldState, Entity, TerrainType, Faction, TelemetryEvent } from './types';

export function createInitialState(width = 50, height = 50, factions?: Record<string, Faction>): WorldState {
  const terrain: TerrainType[][] = Array(height).fill(null).map(() => Array(width).fill('grass'));
  
  // Einfache Terrain-Generierung (Seen und Berge)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distToCenter = Math.sqrt(Math.pow(x - width/2, 2) + Math.pow(y - height/2, 2));
      if (distToCenter < 6) terrain[y][x] = 'water'; // See in der Mitte
      else if (distToCenter < 8) terrain[y][x] = 'sand'; // Strand
      
      if (x > width - 10 && y < 10) terrain[y][x] = 'mountain'; // Gebirge oben rechts
      if (x < 10 && y > height - 10) terrain[y][x] = 'water'; // See unten links
    }
  }

  const defaultFactions: Record<string, Faction> = {
    'red': { id: 'red', name: 'Rotes Reich', color: 'red', perk: 'aggressive' },
    'blue': { id: 'blue', name: 'Blaue Allianz', color: 'blue', perk: 'defensive' }
  };

  const initialEntities: Entity[] = [
    { id: '1', type: 'tree', x: 20, y: 20, growth_stage: 3, max_growth: 3, health: 100 },
    { id: '2', type: 'tree', x: 22, y: 21, growth_stage: 3, max_growth: 3, health: 100 },
    { id: '5', type: 'wolf', x: width - 10, y: height - 10, health: 100, hunger: 0 }
  ];

  if (factions) {
    let i = 0;
    for (const factionId in factions) {
      initialEntities.push({
        id: `start_${factionId}`, type: 'human', 
        x: 10 + (i * 15) % (width - 20), 
        y: 10 + (i * 10) % (height - 20), 
        health: 100, hunger: 0, thirst: 0, age: 0, wood: 0, team: factionId
      });
      i++;
    }
  } else {
    initialEntities.push(
      { id: '3', type: 'human', x: 25, y: 10, health: 100, hunger: 0, thirst: 0, age: 0, wood: 0, team: 'red' },
      { id: '4', type: 'human', x: 26, y: 12, health: 100, hunger: 0, thirst: 0, age: 0, wood: 0, team: 'blue' }
    );
  }

  return {
    width,
    height,
    terrain,
    entities: initialEntities,
    step: 0,
    factions: factions || defaultFactions,
    telemetry: []
  };
}

export function simulateStep(state: WorldState): WorldState {
  const newState = { ...state, step: state.step + 1, telemetry: [...state.telemetry] };
  const entityMap = new Map<string, Entity[]>();
  
  state.entities.forEach(e => {
    const key = `${e.x},${e.y}`;
    if (!entityMap.has(key)) entityMap.set(key,[]);
    entityMap.get(key)!.push(e);
  });

  const newEntities: Entity[] = [];
  const spawnedEntities: Entity[] =[];
  const killedEntityIds = new Set<string>();

  // Hilfsfunktion: Distanz berechnen
  const getDist = (x1: number, y1: number, x2: number, y2: number) => Math.abs(x1 - x2) + Math.abs(y1 - y2);

  state.entities.forEach(entity => {
    if (entity.health <= 0 || killedEntityIds.has(entity.id)) return;
    let nextEntity = { ...entity };

    // Fallback für alte Speicherstände
    if ((nextEntity.type === 'human' || nextEntity.type === 'house') && !nextEntity.team) {
      nextEntity.team = 'neutral';
    }

    // --- FIRE LOGIC ---
    if (nextEntity.type === 'fire') {
      nextEntity.duration! -= 1;
      if (nextEntity.duration! <= 0) {
        nextEntity.health = 0; // Feuer erlischt
      } else {
        // Zerstört Umgebung und breitet sich aus
        if (state.terrain[nextEntity.y][nextEntity.x] === 'grass') {
          newState.terrain[nextEntity.y][nextEntity.x] = 'sand'; // Verbrannte Erde
        }
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = nextEntity.x + dx, ny = nextEntity.y + dy;
            if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height) {
              const targets = entityMap.get(`${nx},${ny}`) ||[];
              targets.forEach(t => {
                if (t.type === 'human' || t.type === 'wolf') t.health -= 20; // Feuerschaden
                if (t.type === 'house') t.health -= 20; // Feuer beschädigt Häuser
                if (t.type === 'tree' && Math.random() < 0.3) {
                  t.health = 0; // Baum verbrennt
                  spawnedEntities.push({ id: Math.random().toString(36).substr(2,9), type: 'fire', x: nx, y: ny, health: 100, duration: 5 });
                }
              });
            }
          }
        }
      }
    }

    // --- TREE LOGIC ---
    else if (nextEntity.type === 'tree') {
      if (nextEntity.growth_stage! < nextEntity.max_growth!) nextEntity.growth_stage! += 1;
      else if (Math.random() < 0.05) { // Erhöhte Spawn-Rate für Bäume
        // Samen streuen
        const nx = nextEntity.x + Math.floor(Math.random() * 3) - 1;
        const ny = nextEntity.y + Math.floor(Math.random() * 3) - 1;
        if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height && state.terrain[ny][nx] === 'grass') {
          if (!(entityMap.get(`${nx},${ny}`) ||[]).some(e => e.type === 'tree')) {
            spawnedEntities.push({ id: Math.random().toString(36).substr(2,9), type: 'tree', x: nx, y: ny, growth_stage: 0, max_growth: 3, health: 100 });
          }
        }
      }
      // Lava entzündet Bäume
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = nextEntity.x + dx, ny = nextEntity.y + dy;
          if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height && state.terrain[ny][nx] === 'lava') {
            nextEntity.health = 0;
            spawnedEntities.push({ id: Math.random().toString(36).substr(2,9), type: 'fire', x: nextEntity.x, y: nextEntity.y, health: 100, duration: 5 });
          }
        }
      }
    }

    // --- HOUSE LOGIC ---
    else if (nextEntity.type === 'house') {
      nextEntity.spawn_timer = (nextEntity.spawn_timer || 0) + 1;
      
      // Heile Menschen in der Nähe (nur eigenes Team)
      const perk = nextEntity.team ? state.factions[nextEntity.team]?.perk : 'none';
      const healAmount = perk === 'defensive' ? 10 : 5;

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = nextEntity.x + dx, ny = nextEntity.y + dy;
          const targets = entityMap.get(`${nx},${ny}`) || [];
          targets.forEach(t => {
            if (t.type === 'human' && t.health > 0 && t.team === nextEntity.team) {
              t.health = Math.min(100, t.health + healAmount);
            }
          });
        }
      }

      // Spawne neuen Menschen
      if (nextEntity.spawn_timer > 50) {
        const humanCount = state.entities.filter(e => e.type === 'human' && e.health > 0).length + spawnedEntities.filter(e => e.type === 'human').length;
        if (humanCount < 100) { // Max Population 100
          spawnedEntities.push({
            id: Math.random().toString(36).substr(2, 9),
            type: 'human',
            x: nextEntity.x,
            y: nextEntity.y,
            health: 100,
            hunger: 0,
            thirst: 0,
            age: 0,
            wood: 0,
            team: nextEntity.team
          });
        }
        nextEntity.spawn_timer = 0;
      }
    }

    // --- HUMAN LOGIC (UTILITY AI) ---
    else if (nextEntity.type === 'human') {
      nextEntity.hunger = (nextEntity.hunger || 0) + 1;
      nextEntity.thirst = (nextEntity.thirst || 0) + 1;
      nextEntity.age = (nextEntity.age || 0) + 1;
      nextEntity.wood = nextEntity.wood || 0;

      if (nextEntity.hunger > 80 || nextEntity.thirst > 80) nextEntity.health -= 5;
      if (nextEntity.age > 500) nextEntity.health -= 1; // Altersschwäche

      if (nextEntity.health <= 0) {
        killedEntityIds.add(nextEntity.id);
        return;
      }

      const teamPopulation = state.entities.filter(e => e.type === 'human' && e.team === nextEntity.team && e.health > 0).length;
      const perk = nextEntity.team ? state.factions[nextEntity.team]?.perk : 'none';
      const woodNeeded = perk === 'builder' ? 2 : 3;

      // Find nearest enemy (distance <= 5)
      let nearestEnemy: Entity | null = null;
      let enemyDist = 999;
      state.entities.forEach(e => {
        if ((e.type === 'human' || e.type === 'house' || e.type === 'wolf') && e.team !== nextEntity.team && e.team !== 'neutral' && e.health > 0 && !killedEntityIds.has(e.id)) {
          const d = getDist(nextEntity.x, nextEntity.y, e.x, e.y);
          if (d < enemyDist && d <= 5) {
            enemyDist = d;
            nearestEnemy = e;
          }
        }
      });

      // Calculate Utility Scores
      const scores = {
        drink: 0,
        eat: 0,
        attack: 0,
        flee: 0,
        chop_wood: 0,
        build_house: 0,
        wander: 10 // Base score
      };

      // Drink Score
      if (nextEntity.thirst > 40) {
        scores.drink = nextEntity.thirst;
        if (perk === 'gatherer') scores.drink += 10;
      }

      // Eat Score
      if (nextEntity.hunger > 40) {
        scores.eat = nextEntity.hunger;
        if (perk === 'gatherer') scores.eat += 10;
      }

      // Attack Score
      if (nearestEnemy && enemyDist <= 1) {
        scores.attack = 50;
        if (perk === 'aggressive') scores.attack += 30;
        if (teamPopulation < 3) scores.attack -= 40;
        if (nextEntity.health < 30) scores.attack -= 50;
      }

      // Flee Score
      if (nearestEnemy) {
        if (nextEntity.health < 30 || teamPopulation < 3) {
          scores.flee = 80;
          if (perk === 'defensive') scores.flee += 20;
        }
      }

      // Chop Wood Score
      if (nextEntity.wood < woodNeeded && nextEntity.hunger <= 60 && nextEntity.thirst <= 60) {
        scores.chop_wood = 60;
        if (perk === 'gatherer') scores.chop_wood += 15;
      }

      // Build House Score
      if (nextEntity.wood >= woodNeeded) {
        scores.build_house = 90;
      }

      // Find best action
      let bestAction = 'wander';
      let maxScore = scores.wander;

      for (const [action, score] of Object.entries(scores)) {
        if (score > maxScore) {
          maxScore = score;
          bestAction = action;
        }
      }

      // Execute Best Action
      let reason = '';

      if (bestAction === 'attack' && nearestEnemy) {
        nearestEnemy.health -= 10;
        if (nearestEnemy.health <= 0) killedEntityIds.add(nearestEnemy.id);
        reason = `Attacked enemy (Score: ${scores.attack})`;
      } 
      else if (bestAction === 'flee' && nearestEnemy) {
        nextEntity.x += Math.sign(nextEntity.x - nearestEnemy.x);
        nextEntity.y += Math.sign(nextEntity.y - nearestEnemy.y);
        // Bounds check
        nextEntity.x = Math.max(0, Math.min(state.width - 1, nextEntity.x));
        nextEntity.y = Math.max(0, Math.min(state.height - 1, nextEntity.y));
        reason = `Fled from enemy (Score: ${scores.flee})`;
      }
      else if (bestAction === 'drink') {
        let nearestWater = null;
        let minDist = 999;
        for (let y = Math.max(0, nextEntity.y - 5); y < Math.min(state.height, nextEntity.y + 6); y++) {
          for (let x = Math.max(0, nextEntity.x - 5); x < Math.min(state.width, nextEntity.x + 6); x++) {
            if (state.terrain[y][x] === 'water') {
              const d = getDist(nextEntity.x, nextEntity.y, x, y);
              if (d < minDist) { minDist = d; nearestWater = { x, y }; }
            }
          }
        }
        if (nearestWater) {
          if (minDist === 1) { nextEntity.thirst = 0; reason = 'Drank water'; }
          else {
            nextEntity.x += Math.sign(nearestWater.x - nextEntity.x);
            nextEntity.y += Math.sign(nearestWater.y - nextEntity.y);
            reason = 'Moving to water';
          }
        } else {
          bestAction = 'wander'; // Fallback
        }
      }
      else if (bestAction === 'eat') {
        let nearestFood: Entity | null = null;
        let minDist = 999;
        state.entities.forEach(e => {
          if (e.type === 'tree' && e.growth_stage === e.max_growth && e.health > 0 && !killedEntityIds.has(e.id)) {
            const d = getDist(nextEntity.x, nextEntity.y, e.x, e.y);
            if (d < minDist) { minDist = d; nearestFood = e; }
          }
        });
        if (nearestFood) {
          if (minDist <= 1) {
            nextEntity.hunger = 0;
            nearestFood.growth_stage = 0;
            reason = 'Ate food';
          } else {
            nextEntity.x += Math.sign((nearestFood as Entity).x - nextEntity.x);
            nextEntity.y += Math.sign((nearestFood as Entity).y - nextEntity.y);
            reason = 'Moving to food';
          }
        } else {
          bestAction = 'wander';
        }
      }
      else if (bestAction === 'chop_wood') {
        let nearestTree: Entity | null = null;
        let minDist = 999;
        state.entities.forEach(e => {
          if (e.type === 'tree' && e.growth_stage === e.max_growth && e.health > 0 && !killedEntityIds.has(e.id)) {
            const d = getDist(nextEntity.x, nextEntity.y, e.x, e.y);
            if (d < minDist) { minDist = d; nearestTree = e; }
          }
        });
        if (nearestTree) {
          if (minDist <= 1) {
            nearestTree.health = 0;
            killedEntityIds.add(nearestTree.id);
            nextEntity.wood += 1;
            reason = 'Chopped wood';
          } else {
            nextEntity.x += Math.sign((nearestTree as Entity).x - nextEntity.x);
            nextEntity.y += Math.sign((nearestTree as Entity).y - nextEntity.y);
            reason = 'Moving to tree';
          }
        } else {
          bestAction = 'wander';
        }
      }
      else if (bestAction === 'build_house') {
        if (state.terrain[nextEntity.y][nextEntity.x] === 'grass' && !(entityMap.get(`${nextEntity.x},${nextEntity.y}`) || []).some(e => e.type === 'house' || e.type === 'tree')) {
          nextEntity.wood = 0;
          spawnedEntities.push({
            id: Math.random().toString(36).substr(2, 9),
            type: 'house',
            x: nextEntity.x,
            y: nextEntity.y,
            health: 200,
            spawn_timer: 0,
            team: nextEntity.team
          });
          reason = 'Built house';
        } else {
          let nearestGrass = null;
          let minDist = 999;
          for (let y = Math.max(0, nextEntity.y - 5); y < Math.min(state.height, nextEntity.y + 6); y++) {
            for (let x = Math.max(0, nextEntity.x - 5); x < Math.min(state.width, nextEntity.x + 6); x++) {
              if (state.terrain[y][x] === 'grass' && !(entityMap.get(`${x},${y}`) || []).some(e => e.type === 'house' || e.type === 'tree')) {
                const d = getDist(nextEntity.x, nextEntity.y, x, y);
                if (d < minDist) { minDist = d; nearestGrass = { x, y }; }
              }
            }
          }
          if (nearestGrass) {
            nextEntity.x += Math.sign(nearestGrass.x - nextEntity.x);
            nextEntity.y += Math.sign(nearestGrass.y - nextEntity.y);
            reason = 'Moving to build site';
          } else {
            bestAction = 'wander';
          }
        }
      }
      
      if (bestAction === 'wander') {
        const nx = nextEntity.x + Math.floor(Math.random() * 3) - 1;
        const ny = nextEntity.y + Math.floor(Math.random() * 3) - 1;
        if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height && ['grass', 'sand'].includes(state.terrain[ny][nx])) {
          nextEntity.x = nx; nextEntity.y = ny;
        }
        reason = 'Wandering';
      }

      // Log Telemetry
      if (bestAction !== 'wander' || Math.random() < 0.05) { // Log all non-wander actions, and 5% of wanders to save space
        newState.telemetry.push({
          tick: state.step,
          entityId: nextEntity.id,
          team: nextEntity.team || 'neutral',
          action: bestAction,
          reason: reason,
          coordinates: [nextEntity.x, nextEntity.y]
        });
      }
    }

    // --- WOLF LOGIC ---
    else if (nextEntity.type === 'wolf') {
      nextEntity.hunger = (nextEntity.hunger || 0) + 1;
      if (nextEntity.hunger > 60) nextEntity.health -= 2;

      let hunted = false;
      const humans = state.entities.filter(e => e.type === 'human' && e.health > 0);
      let nearestHuman: Entity | null = null;
      let minDist = 999;

      humans.forEach(h => {
        const d = getDist(nextEntity.x, nextEntity.y, h.x, h.y);
        if (d < 6 && d < minDist) { minDist = d; nearestHuman = h; } // Sichtweite 5 Felder
      });

      if (nearestHuman) {
        if (minDist <= 1) {
          (nearestHuman as Entity).health -= 20; // Wolf macht 20 Schaden
          if ((nearestHuman as Entity).health <= 0) killedEntityIds.add((nearestHuman as Entity).id);
          nextEntity.hunger = 0;
          nextEntity.health = Math.min(100, nextEntity.health + 30);
          hunted = true;
        } else {
          const nx = nextEntity.x + Math.sign((nearestHuman as Entity).x - nextEntity.x);
          const ny = nextEntity.y + Math.sign((nearestHuman as Entity).y - nextEntity.y);
          if (['grass', 'sand', 'mountain'].includes(state.terrain[ny]?.[nx])) {
            nextEntity.x = nx; nextEntity.y = ny;
            hunted = true;
          }
        }
      }

      if (!hunted) {
        const nx = nextEntity.x + Math.floor(Math.random() * 3) - 1;
        const ny = nextEntity.y + Math.floor(Math.random() * 3) - 1;
        if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height && state.terrain[ny][nx] !== 'water') {
          nextEntity.x = nx; nextEntity.y = ny;
        }
      }
    }

    if (nextEntity.health > 0) newEntities.push(nextEntity);
    else killedEntityIds.add(nextEntity.id);
  });

  newState.entities =[...newEntities, ...spawnedEntities].filter(e => !killedEntityIds.has(e.id));
  
  // Förster-Logik: Spawne neue Bäume, wenn es zu wenige gibt
  const treeCount = newState.entities.filter(e => e.type === 'tree').length;
  if (treeCount < 10 && Math.random() < 0.2) {
    for (let i = 0; i < 10; i++) {
      const nx = Math.floor(Math.random() * state.width);
      const ny = Math.floor(Math.random() * state.height);
      if (state.terrain[ny][nx] === 'grass' && !newState.entities.some(e => e.x === nx && e.y === ny && (e.type === 'tree' || e.type === 'house'))) {
        newState.entities.push({ id: Math.random().toString(36).substr(2,9), type: 'tree', x: nx, y: ny, growth_stage: 0, max_growth: 3, health: 100 });
        break;
      }
    }
  }

  // Limit telemetry size to prevent memory leaks (keep last 1000)
  if (newState.telemetry.length > 1000) {
    newState.telemetry = newState.telemetry.slice(-1000);
  }

  return newState;
}
