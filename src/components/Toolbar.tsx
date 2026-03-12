import React from 'react';
import { ToolState, TerrainType, EntityType } from '../types';
import { Play, Pause, SkipForward, RotateCcw, TreePine, User, Dog, Square, Waves, Eraser } from 'lucide-react';

interface ToolbarProps {
  tool: ToolState;
  setTool: (tool: ToolState) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onStep: () => void;
  onReset: () => void;
  stepCount: number;
}

export function Toolbar({ tool, setTool, isPlaying, setIsPlaying, onStep, onReset, stepCount }: ToolbarProps) {
  const ToolButton = ({ 
    active, 
    onClick, 
    children, 
    label 
  }: { 
    active: boolean; 
    onClick: () => void; 
    children: React.ReactNode; 
    label: string 
  }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
        active 
          ? 'bg-indigo-600 text-white shadow-md scale-105' 
          : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm border border-gray-100'
      }`}
      title={label}
    >
      {children}
      <span className="text-[10px] mt-1 font-medium uppercase tracking-wider">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-xs bg-gray-50 p-6 rounded-2xl shadow-sm border border-gray-200">
      
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Controls</h2>
        <div className="text-xs font-mono bg-gray-200 px-2 py-1 rounded text-gray-700">
          Step: {stepCount}
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${
            isPlaying ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button 
          onClick={onStep}
          disabled={isPlaying}
          className="p-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
          title="Step Forward"
        >
          <SkipForward size={18} />
        </button>
        <button 
          onClick={onReset}
          className="p-3 bg-white border border-gray-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors"
          title="Reset World"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Terrain</h3>
        <div className="grid grid-cols-3 gap-2">
          <ToolButton 
            active={tool.type === 'terrain' && tool.value === 'grass'} 
            onClick={() => setTool({ type: 'terrain', value: 'grass' })}
            label="Grass"
          >
            <Square size={24} className="text-emerald-500 fill-emerald-500" />
          </ToolButton>
          <ToolButton 
            active={tool.type === 'terrain' && tool.value === 'water'} 
            onClick={() => setTool({ type: 'terrain', value: 'water' })}
            label="Water"
          >
            <Waves size={24} className="text-blue-500" />
          </ToolButton>
          <ToolButton 
            active={tool.type === 'terrain' && tool.value === 'sand'} 
            onClick={() => setTool({ type: 'terrain', value: 'sand' })}
            label="Sand"
          >
            <Square size={24} className="text-yellow-300 fill-yellow-300" />
          </ToolButton>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Entities</h3>
        <div className="grid grid-cols-3 gap-2">
          <ToolButton 
            active={tool.type === 'entity' && tool.value === 'tree'} 
            onClick={() => setTool({ type: 'entity', value: 'tree' })}
            label="Tree"
          >
            <TreePine size={24} className="text-emerald-700" />
          </ToolButton>
          <ToolButton 
            active={tool.type === 'entity' && tool.value === 'human'} 
            onClick={() => setTool({ type: 'entity', value: 'human' })}
            label="Human"
          >
            <User size={24} className="text-amber-700" />
          </ToolButton>
          <ToolButton 
            active={tool.type === 'entity' && tool.value === 'wolf'} 
            onClick={() => setTool({ type: 'entity', value: 'wolf' })}
            label="Wolf"
          >
            <Dog size={24} className="text-stone-700" />
          </ToolButton>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tools</h3>
        <div className="grid grid-cols-3 gap-2">
          <ToolButton 
            active={tool.type === 'eraser'} 
            onClick={() => setTool({ type: 'eraser', value: null })}
            label="Eraser"
          >
            <Eraser size={24} className="text-pink-500" />
          </ToolButton>
        </div>
      </div>

    </div>
  );
}
