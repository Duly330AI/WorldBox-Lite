import { useWorldStore } from "../store";

export function UnitInspector() {
  const selectedId = useWorldStore((s) => s.selectedEntityId);
  const buffers = useWorldStore((s) => s.buffers);
  const debug = useWorldStore((s) => s.entityDebug);
  const entitySpec = useWorldStore((s) => s.entitySpec);

  if (selectedId === null || !buffers) {
    return (
      <div
        style={{
          border: "1px solid #222",
          borderRadius: 8,
          padding: 12,
          background: "#fafafa"
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Unit Inspector</div>
        <div style={{ color: "#666" }}>No unit selected.</div>
      </div>
    );
  }

  const health = (buffers.entities.health as Uint8Array)[selectedId] ?? 0;
  const wood = (buffers.entities.inventory_wood as Uint8Array)[selectedId] ?? 0;
  const food = (buffers.entities.inventory_food as Uint8Array)[selectedId] ?? 0;
  const progress = (buffers.entities.action_progress as Uint8Array)[selectedId] ?? 0;
  const meta = debug[selectedId] ?? {};
  const typeId = (buffers.entities.type as Uint8Array)[selectedId] ?? 0;
  const factionId = (buffers.entities.faction_id as Uint8Array)[selectedId] ?? 0;
  const citySize = (buffers.entities.city_size as Uint8Array | undefined)?.[selectedId] ?? 0;
  const cityGrowth = (buffers.entities.city_growth_points as Uint16Array | undefined)?.[selectedId] ?? 0;
  const cityFood = (buffers.entities.city_food_stockpile as Uint16Array | undefined)?.[selectedId] ?? 0;

  let typeName = typeId ? `Type ${typeId}` : "Unknown";
  if (typeId === 210) typeName = "City";
  if (entitySpec) {
    for (const [name, def] of Object.entries(entitySpec.units)) {
      if (def.type_id === typeId) {
        typeName = name;
        break;
      }
    }
    for (const [name, def] of Object.entries(entitySpec.buildings)) {
      if (def.type_id === typeId) {
        typeName = name;
        break;
      }
    }
  }

  return (
    <div
      style={{
        border: "1px solid #222",
        borderRadius: 8,
        padding: 12,
        background: "#fafafa"
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Unit Inspector</div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>Entity #{selectedId}</div>
      <div style={{ fontSize: 12 }}>Type: {typeName}</div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>Faction: {factionId}</div>
      <div style={{ fontSize: 12 }}>Health: {health}</div>
      <div style={{ fontSize: 12 }}>Wood: {wood}</div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>Food: {food}</div>
      {typeId === 210 ? (
        <>
          <div style={{ fontSize: 12 }}>City Size: {citySize}</div>
          <div style={{ fontSize: 12 }}>Growth Points: {cityGrowth}</div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>City Food: {cityFood}</div>
        </>
      ) : null}
      <div style={{ fontSize: 12, marginBottom: 4 }}>Action Progress</div>
      <div style={{ height: 8, background: "#ddd", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, progress)}%`,
            background: "#2ecc71"
          }}
        />
      </div>
      <div style={{ fontSize: 12, marginTop: 8 }}>Top Goal: {meta.goal ?? "-"}</div>
      <div style={{ fontSize: 12 }}>Plan: {(meta.plan ?? []).join(" → ") || "-"}</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>Utilities:</div>
      <div style={{ fontSize: 12, color: "#333" }}>
        {meta.utilities
          ? Object.entries(meta.utilities).map(([k, v]) => (
              <div key={k}>
                {k}: {v.toFixed(2)}
              </div>
            ))
          : "-"}
      </div>
    </div>
  );
}
