import React, { useState, useEffect, useCallback } from 'react';
import { WorldState, ToolState, TerrainType, EntityType, Faction, FactionPerk } from './types';
import { createInitialState, simulateStep } from './engine';
import { Grid } from './components/Grid';
import { Toolbar } from './components/Toolbar';
import { Settings, Play, FolderOpen } from 'lucide-react';

function SetupScreen({ onStart, onLoad }: { onStart: (factions: Record<string, Faction>, size: number) => void, onLoad: () => void }) {
  const [size, setSize] = useState(50);
  const [factions, setFactions] = useState<Faction[]>([
    { id: 'red', name: 'Rotes Reich', color: '#ef4444', perk: 'aggressive' },
    { id: 'blue', name: 'Blaue Allianz', color: '#3b82f6', perk: 'defensive' }
  ]);

  const addFaction = () => {
    const id = `faction_${Math.random().toString(36).substr(2, 5)}`;
    setFactions([...factions, { id, name: `Fraktion ${factions.length + 1}`, color: '#10b981', perk: 'none' }]);
  };

  const updateFaction = (index: number, updates: Partial<Faction>) => {
    const newFactions = [...factions];
    newFactions[index] = { ...newFactions[index], ...updates };
    setFactions(newFactions);
  };

  const removeFaction = (index: number) => {
    setFactions(factions.filter((_, i) => i !== index));
  };

  const handleStart = () => {
    const factionDict: Record<string, Faction> = {};
    factions.forEach(f => factionDict[f.id] = f);
    onStart(factionDict, size);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Settings className="text-indigo-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">WorldBox 5.0 Setup</h1>
          </div>
          <button onClick={onLoad} className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2">
            <FolderOpen size={16} /> Spiel laden
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kartengröße ({size}x{size})</label>
            <input 
              type="range" min="20" max="80" step="10" 
              value={size} onChange={e => setSize(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Fraktionen</h2>
              <button onClick={addFaction} className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full hover:bg-indigo-200 font-medium">
                + Fraktion hinzufügen
              </button>
            </div>
            
            <div className="space-y-3">
              {factions.map((faction, i) => (
                <div key={faction.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <input 
                    type="color" value={faction.color} 
                    onChange={e => updateFaction(i, { color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                  />
                  <input 
                    type="text" value={faction.name} 
                    onChange={e => updateFaction(i, { name: e.target.value })}
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="Fraktionsname"
                  />
                  <select 
                    value={faction.perk} 
                    onChange={e => updateFaction(i, { perk: e.target.value as FactionPerk })}
                    className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="none">Kein Perk</option>
                    <option value="aggressive">Aggressiv (Kämpft lieber)</option>
                    <option value="defensive">Defensiv (Flieht, Heilt)</option>
                    <option value="builder">Baumeister (Günstige Häuser)</option>
                    <option value="gatherer">Sammler (Effizienter)</option>
                  </select>
                  {factions.length > 1 && (
                    <button onClick={() => removeFaction(i)} className="text-red-500 hover:text-red-700 px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={handleStart}
            className="w-full mt-8 bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <Play size={24} /> Simulation Starten
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [showSetup, setShowSetup] = useState(true);
  const [state, setState] = useState<WorldState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tool, setTool] = useState<ToolState>({ type: 'terrain', value: 'grass' });
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleStartSetup = (factions: Record<string, Faction>, size: number) => {
    setState(createInitialState(size, size, factions));
    setShowSetup(false);
  };

  const handleStep = useCallback(() => {
    setState(prev => prev ? simulateStep(prev) : null);
  },[]);

  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(handleStep, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, handleStep]);

  const handleReset = () => {
    setIsPlaying(false);
    setShowSetup(true);
    setState(null);
    showToast('Welt zurückgesetzt!');
  };

  const handleSave = () => {
    if (state) {
      localStorage.setItem('worldbox_save', JSON.stringify(state));
      showToast('Welt erfolgreich gespeichert!');
    }
  };

  const handleLoad = () => {
    const saved = localStorage.getItem('worldbox_save');
    if (saved) {
      setState(JSON.parse(saved));
      setIsPlaying(false);
      setShowSetup(false);
      showToast('Welt erfolgreich geladen!');
    } else {
      showToast('Kein Spielstand gefunden.');
    }
  };

  const handleExportTelemetry = () => {
    if (!state) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.telemetry, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "telemetry.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast('Telemetry exportiert!');
  };

  const handleTileClick = (x: number, y: number) => {
    setState(prev => {
      if (!prev) return prev;
      const newState = { ...prev };
      
      if (tool.type === 'terrain' && tool.value) {
        const newTerrain =[...prev.terrain.map(row => [...row])];
        newTerrain[y][x] = tool.value as TerrainType;
        newState.terrain = newTerrain;
      } else if (tool.type === 'entity' && tool.value) {
        let entityType = tool.value as EntityType;
        let team: string | undefined;

        if (tool.value.startsWith('human_')) {
          entityType = 'human';
          team = tool.value.replace('human_', '');
        } else if (tool.value.startsWith('house_')) {
          entityType = 'house';
          team = tool.value.replace('house_', '');
        }

        const newEntity = {
          id: Math.random().toString(36).substr(2, 9),
          type: entityType,
          x, y,
          health: 100,
          ...(team ? { team } : {}),
          ...(entityType === 'tree' ? { growth_stage: 3, max_growth: 3 } : {}),
          ...(entityType === 'human' ? { hunger: 0, thirst: 0, age: 0, wood: 0 } : {}),
          ...(entityType === 'wolf' ? { hunger: 0 } : {}),
          ...(entityType === 'house' ? { health: 200, spawn_timer: 0 } : {})
        };
        newState.entities = [...prev.entities, newEntity];
      } else if (tool.type === 'disaster' && tool.value === 'fire') {
        const fireEntity = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'fire' as EntityType,
          x, y, health: 100, duration: 10
        };
        newState.entities = [...prev.entities, fireEntity];
      } else if (tool.type === 'eraser') {
        newState.entities = prev.entities.filter(e => e.x !== x || e.y !== y);
      }

      return newState;
    });
  };

  if (showSetup) {
    return <SetupScreen onStart={handleStartSetup} onLoad={handleLoad} />;
  }

  if (!state) return null;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans p-4 md:p-8 relative">
      {toast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-top-4">
          {toast}
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">WorldBox 5.0</h1>
          <p className="text-gray-500 mt-1">Utility AI, Fraktions-Perks & Telemetry.</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <Toolbar 
            tool={tool} setTool={setTool} 
            isPlaying={isPlaying} setIsPlaying={setIsPlaying} 
            onStep={handleStep} onReset={handleReset}
            onSave={handleSave} onLoad={handleLoad}
            onExportTelemetry={handleExportTelemetry}
            state={state}
          />
          
          <div className="flex-1 overflow-auto bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <Grid state={state} tool={tool} onTileClick={handleTileClick} />
          </div>
        </div>
      </div>
    </div>
  );
}
