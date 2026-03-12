/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { WorldState, ToolState, TerrainType, EntityType } from './types';
import { createInitialState, simulateStep } from './engine';
import { Grid } from './components/Grid';
import { Toolbar } from './components/Toolbar';

export default function App() {
  const [state, setState] = useState<WorldState>(createInitialState());
  const [isPlaying, setIsPlaying] = useState(false);
  const [tool, setTool] = useState<ToolState>({ type: 'terrain', value: 'grass' });

  const handleStep = useCallback(() => {
    setState(prev => simulateStep(prev));
  }, []);

  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(handleStep, 500); // 2 steps per second
    }
    return () => clearInterval(interval);
  }, [isPlaying, handleStep]);

  const handleReset = () => {
    setIsPlaying(false);
    setState(createInitialState());
  };

  const handleTileClick = (x: number, y: number) => {
    setState(prev => {
      const newState = { ...prev };
      
      if (tool.type === 'terrain' && tool.value) {
        const newTerrain = [...prev.terrain.map(row => [...row])];
        newTerrain[y][x] = tool.value as TerrainType;
        newState.terrain = newTerrain;
      } else if (tool.type === 'entity' && tool.value) {
        const entityType = tool.value as EntityType;
        const newEntity = {
          id: Math.random().toString(36).substr(2, 9),
          type: entityType,
          x,
          y,
          health: 100,
          ...(entityType === 'tree' ? { growth_stage: 3, max_growth: 3 } : {}),
          ...(entityType === 'human' ? { hunger: 0 } : {})
        };
        newState.entities = [...prev.entities, newEntity];
      } else if (tool.type === 'eraser') {
        newState.entities = prev.entities.filter(e => e.x !== x || e.y !== y);
      }

      return newState;
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">WorldBox Lite</h1>
          <p className="text-gray-500 mt-1">A sandbox world simulation. Build, populate, and watch it evolve.</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <Toolbar 
            tool={tool} 
            setTool={setTool} 
            isPlaying={isPlaying} 
            setIsPlaying={setIsPlaying} 
            onStep={handleStep}
            onReset={handleReset}
            stepCount={state.step}
          />
          
          <div className="flex-1 overflow-auto bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center">
            <Grid state={state} tool={tool} onTileClick={handleTileClick} />
          </div>
        </div>
      </div>
    </div>
  );
}

