import React from 'react';
import { WorldState, ToolState, TerrainType } from '../types';
import { TreePine, User, Dog, Flame, Home } from 'lucide-react';

interface GridProps {
  state: WorldState;
  tool: ToolState;
  onTileClick: (x: number, y: number) => void;
}

const terrainColors: Record<TerrainType, string> = {
  grass: 'bg-emerald-500',
  water: 'bg-blue-500',
  sand: 'bg-yellow-200',
  mountain: 'bg-stone-500',
  lava: 'bg-orange-600'
};

export function Grid({ state, tool, onTileClick }: GridProps) {
  return (
    <div 
      className="grid gap-px bg-gray-800 p-px rounded-lg shadow-xl w-max m-auto"
      style={{ 
        gridTemplateColumns: `repeat(${state.width}, max-content)`
      }}
    >
      {state.terrain.map((row, y) => (
        row.map((terrain, x) => {
          const entities = state.entities.filter(e => e.x === x && e.y === y);
          
          return (
            <div 
              key={`${x}-${y}`}
              className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 shrink-0 ${terrainColors[terrain]} flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => onTileClick(x, y)}
            >
              {entities.map(entity => {
                if (entity.type === 'tree') {
                  const size = entity.growth_stage === 0 ? 10 : entity.growth_stage === 1 ? 12 : entity.growth_stage === 2 ? 14 : 18;
                  // Baum wird rot, wenn er in der Nähe von Lava ist
                  return <TreePine key={entity.id} size={size} className="text-emerald-900 drop-shadow-md" />;
                }
                if (entity.type === 'human') {
                  // Mensch wird leicht transparent, wenn hungrig/durstig
                  const opacity = (entity.hunger! > 50 || entity.thirst! > 50) ? 'opacity-60' : '';
                  const faction = entity.team ? state.factions[entity.team] : undefined;
                  const color = faction ? faction.color : '#fef3c7'; // amber-100 fallback
                  return <User key={entity.id} size={16} style={{ color }} className={`drop-shadow-md ${opacity}`} />;
                }
                if (entity.type === 'wolf') {
                  return <Dog key={entity.id} size={16} className="text-stone-900 drop-shadow-md" />;
                }
                if (entity.type === 'fire') {
                  return <Flame key={entity.id} size={16} className="text-yellow-400 fill-yellow-400 animate-pulse drop-shadow-md" />;
                }
                if (entity.type === 'house') {
                  const faction = entity.team ? state.factions[entity.team] : undefined;
                  const color = faction ? faction.color : '#92400e'; // amber-800 fallback
                  return <Home key={entity.id} size={18} style={{ color, fill: color }} className="drop-shadow-md" />;
                }
                return null;
              })}
            </div>
          );
        })
      ))}
    </div>
  );
}
