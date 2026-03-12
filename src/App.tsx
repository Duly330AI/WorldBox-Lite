import { useEffect } from "react";
import { WorldCanvas } from "./ui/canvas/WorldCanvas";
import { useWorldStore } from "./ui/store";

export function App() {
  const setWorld = useWorldStore((s) => s.setWorld);
  const error = useWorldStore((s) => s.error);
  const setError = useWorldStore((s) => s.setError);

  useEffect(() => {
    const worker = new Worker(new URL("./engine/worker.ts", import.meta.url), {
      type: "module"
    });
    let simTimer: number | undefined;

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
        simTimer = window.setInterval(() => {
          worker.postMessage({ type: "sim_tick", entityIndices: [0, 1] });
        }, 500);
      }
      if (ev.data.type === "error") {
        setError(ev.data.message);
      }
      if (ev.data.type === "log") {
        // Placeholder for telemetry sink (UI or file in future)
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

  return (
    <div style={{ padding: 16, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>CivWorldBox</h1>
      <p style={{ marginTop: 0, color: "#555" }}>World generation preview (Canvas 2D)</p>
      {error ? (
        <div style={{ color: "#b00020" }}>{error}</div>
      ) : (
        <WorldCanvas />
      )}
    </div>
  );
}
