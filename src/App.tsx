import { useEffect, useRef, useState } from "react";
import { WorldCanvas } from "./ui/canvas/WorldCanvas";
import { useWorldStore } from "./ui/store";

export function App() {
  const setWorld = useWorldStore((s) => s.setWorld);
  const error = useWorldStore((s) => s.error);
  const setError = useWorldStore((s) => s.setError);
  const [isPlaying, setIsPlaying] = useState(true);
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState(500);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./engine/worker.ts", import.meta.url), {
      type: "module"
    });
    workerRef.current = worker;

    worker.onmessage = (ev) => {
      if (ev.data.type === "world") {
        const terrain = new Uint8Array(ev.data.terrain);
        setWorld(ev.data.spec, terrain);
      }
      if (ev.data.type === "state") {
        const terrain = ev.data.buffers?.terrain
          ? new Uint8Array(ev.data.buffers.terrain.buffer)
          : new Uint8Array(ev.data.terrain);
        setWorld(ev.data.worldSpec, terrain);
      }
      if (ev.data.type === "error") {
        setError(ev.data.message);
      }
      if (ev.data.type === "tick") {
        setTick(ev.data.tick);
      }
      if (ev.data.type === "log") {
        console.debug("telemetry", ev.data.entries);
      }
    };

    worker.postMessage({
      type: "init",
      worldSpecUrl: "/specs/world_spec.json",
      stateSpecUrl: "/specs/state_spec.json",
      techSpecUrl: "/specs/tech_spec.json",
      unitBehaviorSpecUrl: "/specs/unit_behavior_spec.json",
      seed: 1337
    });

    return () => worker.terminate();
  }, [setWorld, setError]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        worker.postMessage({ type: "sim_tick", entityIndices: [0, 1] });
      }, speed);
    }

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, speed]);

  return (
    <div style={{ padding: 16, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>CivWorldBox</h1>
      <p style={{ marginTop: 0, color: "#555" }}>World generation preview (Canvas 2D)</p>
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
      </div>
      {error ? (
        <div style={{ color: "#b00020" }}>{error}</div>
      ) : (
        <WorldCanvas />
      )}
    </div>
  );
}
