import { useEffect, useRef, useState } from "react";
import { WorldCanvas } from "./ui/canvas/WorldCanvas";
import { EventLog } from "./ui/components/EventLog";
import { Minimap } from "./ui/components/Minimap";
import { TechTree } from "./ui/components/TechTree";
import { UnitInspector } from "./ui/components/UnitInspector";
import { VictoryPanel } from "./ui/components/VictoryPanel";
import { useWorldStore } from "./ui/store";
import { loadAssetSpec } from "./engine/io/specLoader";

export function App() {
  const setWorld = useWorldStore((s) => s.setWorld);
  const error = useWorldStore((s) => s.error);
  const setError = useWorldStore((s) => s.setError);
  const addEvents = useWorldStore((s) => s.addEvents);
  const setPaths = useWorldStore((s) => s.setPaths);
  const setEntityDebug = useWorldStore((s) => s.setEntityDebug);
  const setStats = useWorldStore((s) => s.setStats);
  const setBuildingOwners = useWorldStore((s) => s.setBuildingOwners);
  const setAttackLines = useWorldStore((s) => s.setAttackLines);
  const setWorker = useWorldStore((s) => s.setWorker);
  const setPerfStats = useWorldStore((s) => s.setPerfStats);
  const setMatchOver = useWorldStore((s) => s.setMatchOver);
  const setKnowledge = useWorldStore((s) => s.setKnowledge);
  const setResearch = useWorldStore((s) => s.setResearch);
  const setChronicles = useWorldStore((s) => s.setChronicles);
  const setTilesetImages = useWorldStore((s) => s.setTilesetImages);
  const setAssetSpec = useWorldStore((s) => s.setAssetSpec);
  const tilesetImages = useWorldStore((s) => s.tilesetImages);
  const assetSpec = useWorldStore((s) => s.assetSpec);
  const setTickStore = useWorldStore((s) => s.setTick);
  const setTickIntervalMs = useWorldStore((s) => s.setTickIntervalMs);
  const setMinimapBuffer = useWorldStore((s) => s.setMinimapBuffer);
  const stats = useWorldStore((s) => s.stats);
  const perfStats = useWorldStore((s) => s.perfStats);
  const simulationSpec = useWorldStore((s) => s.simulationSpec);
  const matchOver = useWorldStore((s) => s.matchOver);
  const knowledge = useWorldStore((s) => s.knowledge);
  const research = useWorldStore((s) => s.research);
  const chronicles = useWorldStore((s) => s.chronicles);
  const godTool = useWorldStore((s) => s.godTool);
  const setGodTool = useWorldStore((s) => s.setGodTool);
  const setBrushSize = useWorldStore((s) => s.setBrushSize);
  const [isPlaying, setIsPlaying] = useState(true);
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState(500);
  const [assetSpecStatus, setAssetSpecStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./engine/worker.ts", import.meta.url), {
      type: "module"
    });
    workerRef.current = worker;
    setWorker(worker);

    worker.onmessage = (ev) => {
      if (ev.data.type === "world") {
        const terrain = new Uint8Array(ev.data.terrain);
        setWorld(ev.data.spec, terrain, null, null, null, null, null, null);
      }
      if (ev.data.type === "state") {
        const terrain = ev.data.buffers?.terrain
          ? new Uint8Array(ev.data.buffers.terrain.buffer)
          : new Uint8Array(ev.data.terrain);
        setWorld(
          ev.data.worldSpec,
          terrain,
          ev.data.buffers ?? null,
          ev.data.unitBehaviorSpec ?? null,
          ev.data.loggingSpec ?? null,
          ev.data.simulationSpec ?? null,
          ev.data.techSpec ?? null,
          null
        );
      }
      if (ev.data.type === "error") {
        setError(ev.data.message);
      }
      if (ev.data.type === "tick") {
        setTick(ev.data.tick);
        setTickStore(ev.data.tick);
        if (ev.data.paths) {
          setPaths(ev.data.paths);
        }
        if (ev.data.entityDebug) {
          setEntityDebug(ev.data.entityDebug);
        }
        if (ev.data.stats) {
          setStats(ev.data.stats);
        }
        if (ev.data.buildingOwners) {
          setBuildingOwners(ev.data.buildingOwners);
        }
        if (ev.data.attackLines) {
          setAttackLines(ev.data.attackLines);
        }
      }
      if (ev.data.type === "perf_stats") {
        setPerfStats(ev.data);
        if (ev.data.knowledge) {
          setKnowledge(ev.data.knowledge);
        }
        if (ev.data.research) {
          setResearch(ev.data.research);
        }
        if (ev.data.chronicles) {
          setChronicles(ev.data.chronicles);
        }
      }
      if (ev.data.type === "match_over") {
        setMatchOver(ev.data);
        setIsPlaying(false);
      }
      if (ev.data.type === "minimap") {
        const buf = new Uint8ClampedArray(ev.data.buffer);
        setMinimapBuffer(buf);
      }
      if (ev.data.type === "export_data") {
        const blob = new Blob([JSON.stringify(ev.data.payload, null, 2)], {
          type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "ai_chronicle.json";
        link.click();
        URL.revokeObjectURL(url);
      }
      if (ev.data.type === "log") {
        console.debug("telemetry", ev.data.entries);
        addEvents(ev.data.entries ?? []);
      }
    };

    worker.postMessage({
      type: "init",
      worldSpecUrl: "/specs/world_spec.json",
      stateSpecUrl: "/specs/state_spec.json",
      techSpecUrl: "/specs/tech_spec.json",
      unitBehaviorSpecUrl: "/specs/unit_behavior_spec.json",
      loggingSpecUrl: "/specs/logging_spec.json",
      combatSpecUrl: "/specs/combat_spec.json",
      entitySpecUrl: "/specs/entity_spec.json",
      simulationSpecUrl: "/specs/simulation_spec.json",
      exportSpecUrl: "/specs/export_spec.json",
      seed: 1337
    });

    return () => worker.terminate();
  }, [setWorld, setError, addEvents, setPaths, setEntityDebug, setStats, setBuildingOwners, setAttackLines, setWorker, setPerfStats, setMatchOver, setKnowledge, setResearch, setChronicles, setTilesetImages, setMinimapBuffer]);

  useEffect(() => {
    let cancelled = false;
    setAssetSpecStatus("loading");
    const specTimeout = window.setTimeout(() => {
      if (!cancelled) {
        setError("asset_spec did not load (timeout)");
        setAssetSpecStatus("error");
      }
    }, 3000);
    loadAssetSpec("/specs/asset_spec.json")
      .then((spec) => {
        if (cancelled) return;
        window.clearTimeout(specTimeout);
        setAssetSpec(spec);
        setAssetSpecStatus("loaded");
        const images: Record<string, HTMLImageElement> = {};
        const loaders = spec.tilesets.map(
          (ts) =>
            new Promise<void>(async (resolve) => {
              try {
                const res = await fetch(ts.image);
                if (!res.ok) {
                  setError(`Missing tileset image: ${ts.image}`);
                  resolve();
                  return;
                }
                const blob = await res.blob();
                if (blob.size === 0) {
                  setError(`Tileset image empty: ${ts.image}`);
                  resolve();
                  return;
                }
                const img = new Image();
                const url = URL.createObjectURL(blob);
                const timeout = window.setTimeout(() => {
                  setError(`Failed to load tileset image: ${ts.image}`);
                  URL.revokeObjectURL(url);
                  resolve();
                }, 2000);
                img.onload = () => {
                  window.clearTimeout(timeout);
                  URL.revokeObjectURL(url);
                  images[ts.name] = img;
                  resolve();
                };
                img.onerror = () => {
                  window.clearTimeout(timeout);
                  URL.revokeObjectURL(url);
                  setError(`Failed to load tileset image: ${ts.image}`);
                  resolve();
                };
                img.src = url;
              } catch {
                setError(`Missing tileset image: ${ts.image}`);
                resolve();
              }
            })
        );
        const watchdog = window.setTimeout(() => {
          setError("Sprite load timeout");
        }, 3000);
        Promise.all(loaders).then(() => {
          window.clearTimeout(watchdog);
          if (cancelled) return;
          setTilesetImages(images);
          const missing = spec.tilesets.filter((ts) => !images[ts.name]);
          if (missing.length > 0) {
            setError(`Missing tileset images: ${missing.map((m) => m.image).join(", ")}`);
          }
        });
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setError("Failed to load asset_spec.json");
          setAssetSpecStatus("error");
        }
      });
    return () => {
      cancelled = true;
      window.clearTimeout(specTimeout);
    };
  }, [setTilesetImages, setAssetSpec]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        worker.postMessage({ type: "sim_tick" });
      }, speed);
    }

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, speed]);

  useEffect(() => {
    setTickIntervalMs(speed);
  }, [speed, setTickIntervalMs]);

  const warningMs = simulationSpec?.performance_targets.warning_threshold_ms ?? 100;
  const avgTickMs = perfStats?.avg_tick_ms ?? 0;
  const perfColor = avgTickMs > warningMs ? "#b00020" : "#222";
  const leadingFaction = stats
    ? Object.entries(stats.military).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0]
    : null;
  const leaderKnowledge = leadingFaction ? knowledge[Number(leadingFaction)] ?? {} : {};
  const topKnowledge = Object.entries(leaderKnowledge)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const factionIds = stats
    ? Array.from(
        new Set([
          ...Object.keys(stats.population),
          ...Object.keys(stats.houses),
          ...Object.keys(stats.wood),
          ...Object.keys(stats.military)
        ])
      )
        .map((id) => Number(id))
        .sort((a, b) => a - b)
    : [];
  const factionColors = ["#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#14b8a6", "#eab308", "#64748b"];

  const assetsReady = assetSpec
    ? assetSpec.tilesets.every((ts) => tilesetImages[ts.name])
    : false;
  const assetProgress = assetSpec
    ? `${Object.keys(tilesetImages).length}/${assetSpec.tilesets.length}`
    : "0/0";

  return (
    <div style={{ padding: 16, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>CivWorldBox</h1>
      <p style={{ marginTop: 0, color: "#555" }}>World generation preview (Canvas 2D)</p>
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12, flexWrap: "wrap" }}>
        {factionIds.map((id) => (
          <div key={id} style={{ color: factionColors[id % factionColors.length] }}>
            Faktion {id}: {stats?.population?.[id] ?? 0} Menschen, {stats?.houses?.[id] ?? 0} Häuser,{" "}
            {stats?.wood?.[id] ?? 0} Holz, Militär {stats?.military?.[id] ?? 0},{" "}
            K/D {chronicles?.[id]?.battle_win_loss_ratio ?? 0},{" "}
            Research {research?.[id]?.current ? "1/tick" : "0/tick"}
          </div>
        ))}
        <div style={{ color: perfColor }}>
          Tick: {avgTickMs.toFixed(1)}ms • Entities: {perfStats?.entity_count ?? 0} • Pathfinding:{" "}
          {perfStats?.pathfinding_calls_per_tick ?? 0}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <button
          onClick={() => setIsPlaying((v) => !v)}
          style={{
            padding: "6px 12px",
            border: "1px solid #333",
            background: isPlaying ? "#222" : "#f5f5f5",
            color: isPlaying ? "#fff" : "#222",
            borderRadius: 6
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <div>Tick: {tick}</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Speed
          <input
            type="range"
            min={100}
            max={1000}
            step={50}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          <span>{speed}ms</span>
        </label>
        <button
          onClick={() => workerRef.current?.postMessage({ type: "spawn_unit", unitType: 201, factionId: 0 })}
          style={{
            padding: "6px 12px",
            border: "1px solid #333",
            background: "#f5f5f5",
            color: "#222",
            borderRadius: 6
          }}
        >
          Spawn Test-Worker
        </button>
        <button
          onClick={() => workerRef.current?.postMessage({ type: "export_chronicle" })}
          style={{
            padding: "6px 12px",
            border: "1px solid #333",
            background: "#f5f5f5",
            color: "#222",
            borderRadius: 6
          }}
        >
          Export AI Chronicle
        </button>
        <div style={{ marginLeft: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#555" }}>God Tools</span>
          {["lava", "forest", "water", "ignite"].map((tool) => (
            <button
              key={tool}
              onClick={() => setGodTool(godTool.tool === tool ? null : (tool as "lava" | "forest" | "water" | "ignite"))}
              style={{
                padding: "4px 10px",
                border: "1px solid #333",
                background: godTool.tool === tool ? "#222" : "#f5f5f5",
                color: godTool.tool === tool ? "#fff" : "#222",
                borderRadius: 6,
                fontSize: 12
              }}
            >
              {tool}
            </button>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            Brush
            <select
              value={godTool.brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            >
              {(simulationSpec?.god_tools.brush_sizes ?? [1, 3, 5]).map((size) => (
                <option key={size} value={size}>
                  {size}x{size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          {error ? (
            <div style={{ color: "#b00020" }}>{error}</div>
          ) : (
            <WorldCanvas />
          )}
        </div>
        <div style={{ width: 280 }}>
          <EventLog />
          <div style={{ height: 12 }} />
          <Minimap />
          <div style={{ height: 12 }} />
          <UnitInspector />
          <div style={{ height: 12 }} />
          <div
            style={{
              border: "1px solid #222",
              borderRadius: 8,
              padding: 12,
              background: "#fafafa"
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Knowledge Viewer</div>
            {topKnowledge.length === 0 ? (
              <div style={{ fontSize: 12, color: "#666" }}>No knowledge yet.</div>
            ) : (
              topKnowledge.map(([key, value]) => (
                <div key={key} style={{ fontSize: 12 }}>
                  {key}: {value}
                </div>
              ))
            )}
          </div>
          <div style={{ height: 12 }} />
          <TechTree />
        </div>
      </div>
      {!assetsReady && !error ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            color: "#fff",
            fontWeight: 600
          }}
        >
          Loading sprites… ({assetProgress}, assetSpec: {assetSpecStatus})
        </div>
      ) : null}
      <VictoryPanel />
    </div>
  );
}
