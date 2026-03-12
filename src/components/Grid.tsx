import React from 'react';
import { WorldState, ToolState, TerrainType, EntityType } from '../types';
import { TreePine, User, Dog } from 'lucide-react';

interface GridProps {
  state: WorldState;
  tool: ToolState;
  onTileClick: (x: number, y: number) => void;
}

const terrainColors: Record<TerrainType, string> = {
  grass: 'bg-emerald-500',
  water: 'bg-blue-500',
  sand: 'bg-yellow-200'
};

export function Grid({ state, tool, onTileClick }: GridProps) {
  return (
    <div 
      className="grid gap-px bg-gray-800 p-px rounded-lg shadow-xl"
      style={{ 
        gridTemplateColumns: `repeat(${state.width}, minmax(0, 1fr))`,
        width: 'fit-content'
      }}
    >
      {state.terrain.map((row, y) => (
        row.map((terrain, x) => {
          const entities = state.entities.filter(e => e.x === x && e.y === y);
          
          return (
            <div 
              key={`${x}-${y}`}
              className={`w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 ${terrainColors[terrain]} flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => onTileClick(x, y)}
            >
              {entities.map(entity => {
                if (entity.type === 'tree') {
                  const size = entity.growth_stage === 0 ? 12 : entity.growth_stage === 1 ? 16 : entity.growth_stage === 2 ? 20 : 24;
                  return <TreePine key={entity.id} size={size} className="text-emerald-900 drop-shadow-md" />;
                }
                if (entity.type === 'human') {
                  return <User key={entity.id} size={20} className="text-amber-100 drop-shadow-md" />;
                }
                if (entity.type === 'wolf') {
                  return <Dog key={entity.id} size={20} className="text-stone-800 drop-shadow-md" />;
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
