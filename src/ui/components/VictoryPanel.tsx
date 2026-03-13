import { useWorldStore } from "../store";

export function VictoryPanel() {
  const matchOver = useWorldStore((s) => s.matchOver);
  if (!matchOver) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 24,
          borderRadius: 12,
          minWidth: 320,
          textAlign: "center"
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Match Over</div>
        <div style={{ fontSize: 14, marginBottom: 8 }}>
          Sieger: {matchOver.winnerName} (Faktion {matchOver.winnerFactionId})
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>Dauer: {matchOver.tick} Ticks</div>
        {matchOver.summary ? (
          <div style={{ marginTop: 12, fontSize: 12, textAlign: "left" }}>
            <div>Gesammeltes Holz: {matchOver.summary.collected_wood}</div>
            <div>Gefallene Einheiten: {matchOver.summary.fallen_units}</div>
            <div>
              Erforschte Techs:{" "}
              {matchOver.summary.researched_techs.length > 0
                ? matchOver.summary.researched_techs.join(", ")
                : "Keine"}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
