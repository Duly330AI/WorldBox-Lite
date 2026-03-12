import React from 'react';
import { ToolState, WorldState } from '../types';
import { Play, Pause, SkipForward, RotateCcw, TreePine, User, Dog, Square, Waves, Eraser, Mountain, Flame, Save, FolderOpen, Home, Download } from 'lucide-react';

interface ToolbarProps {
  tool: ToolState;
  setTool: (tool: ToolState) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onStep: () => void;
  onReset: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExportTelemetry: () => void;
  state: WorldState;
}

export function Toolbar({ tool, setTool, isPlaying, setIsPlaying, onStep, onReset, onSave, onLoad, onExportTelemetry, state }: ToolbarProps) {
  const ToolButton = ({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label: string }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
        active ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm border border-gray-100'
      }`}
      title={label}
    >
      {children}
      <span className="text-[10px] mt-1 font-medium uppercase tracking-wider text-center leading-tight">{label}</span>
    </button>
  );

  const houseCount = state.entities.filter(e => e.type === 'house').length;
  const treeCount = state.entities.filter(e => e.type === 'tree').length;

  return (
    <div className="flex flex-col gap-5 w-full max-w-xs bg-gray-50 p-5 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Controls</h2>
        <div className="text-xs font-mono bg-gray-200 px-2 py-1 rounded text-gray-700">Tag: {state.step}</div>
      </div>

      {/* Dashboard */}
      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Statistiken</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.values(state.factions || {}).map(faction => {
            const pop = state.entities.filter(e => e.type === 'human' && e.team === faction.id).length;
            return (
              <div key={faction.id} className="flex items-center gap-2 font-medium" style={{ color: faction.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: faction.color }}></span> {faction.name}: {pop}
              </div>
            );
          })}
          <div className="flex items-center gap-2 text-amber-800 font-medium">
            <Home size={12} /> Häuser: {houseCount}
          </div>
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <TreePine size={12} /> Bäume: {treeCount}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setIsPlaying(!isPlaying)} className={`flex items-center justify-center gap-2 py-2 rounded-xl font-medium transition-colors ${isPlaying ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} />} {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={onStep} disabled={isPlaying} className="py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50">
          <SkipForward size={16} className="mx-auto" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={onSave} className="p-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 flex justify-center" title="Save">
          <Save size={18} />
        </button>
        <button onClick={onLoad} className="p-2 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 flex justify-center" title="Load">
          <FolderOpen size={18} />
        </button>
        <button onClick={onReset} className="p-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 flex justify-center" title="Reset">
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Terrain</h3>
        <div className="grid grid-cols-3 gap-2">
          <ToolButton active={tool.value === 'grass'} onClick={() => setTool({ type: 'terrain', value: 'grass' })} label="Gras"><Square size={20} className="text-emerald-500 fill-emerald-500" /></ToolButton>
          <ToolButton active={tool.value === 'water'} onClick={() => setTool({ type: 'terrain', value: 'water' })} label="Wasser"><Waves size={20} className="text-blue-500" /></ToolButton>
          <ToolButton active={tool.value === 'sand'} onClick={() => setTool({ type: 'terrain', value: 'sand' })} label="Sand"><Square size={20} className="text-yellow-300 fill-yellow-300" /></ToolButton>
          <ToolButton active={tool.value === 'mountain'} onClick={() => setTool({ type: 'terrain', value: 'mountain' })} label="Berg"><Mountain size={20} className="text-stone-600" /></ToolButton>
          <ToolButton active={tool.value === 'lava'} onClick={() => setTool({ type: 'terrain', value: 'lava' })} label="Lava"><Square size={20} className="text-orange-600 fill-orange-600" /></ToolButton>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Entitäten</h3>
        <div className="grid grid-cols-3 gap-2">
          <ToolButton active={tool.value === 'tree'} onClick={() => setTool({ type: 'entity', value: 'tree' })} label="Baum"><TreePine size={20} className="text-emerald-700" /></ToolButton>
          <ToolButton active={tool.value === 'wolf'} onClick={() => setTool({ type: 'entity', value: 'wolf' })} label="Wolf"><Dog size={20} className="text-stone-700" /></ToolButton>
          {Object.values(state.factions || {}).map(faction => (
            <ToolButton key={`human_${faction.id}`} active={tool.value === `human_${faction.id}`} onClick={() => setTool({ type: 'entity', value: `human_${faction.id}` })} label={`Mensch (${faction.name})`}><User size={20} style={{ color: faction.color }} /></ToolButton>
          ))}
          {Object.values(state.factions || {}).map(faction => (
            <ToolButton key={`house_${faction.id}`} active={tool.value === `house_${faction.id}`} onClick={() => setTool({ type: 'entity', value: `house_${faction.id}` })} label={`Haus (${faction.name})`}><Home size={20} style={{ color: faction.color }} /></ToolButton>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Werkzeuge</h3>
        <div className="grid grid-cols-3 gap-2">
          <ToolButton active={tool.value === 'fire'} onClick={() => setTool({ type: 'disaster', value: 'fire' })} label="Feuer"><Flame size={20} className="text-red-500" /></ToolButton>
          <ToolButton active={tool.type === 'eraser'} onClick={() => setTool({ type: 'eraser', value: null })} label="Eraser"><Eraser size={20} className="text-pink-500" /></ToolButton>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Telemetry</h3>
        <button onClick={onExportTelemetry} className="w-full py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 flex items-center justify-center gap-2 text-sm font-medium">
          <Download size={16} /> Export JSON
        </button>
      </div>
    </div>
  );
}
