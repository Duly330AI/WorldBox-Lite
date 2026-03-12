Hier ist die simulation_spec.json. Dies ist die "Master-Datei", die den Takt und die logische Abfolge des Spiels vorgibt. Dein VS Code Agent wird diese Datei als Haupt-Loop seiner Engine implementieren.

5️⃣ simulation_spec.json
code
JSON
download
content_copy
expand_less
{
  "spec_id": "civ_simulation_engine_v1",
  "version": "1.0",
  "description": "Haupt-Taktgeber und Regelwerk für den Simulations-Loop (Runden-basiert oder Echtzeit).",
  "game_loop_config": {
    "mode": "hybrid_ticks",
    "ticks_per_turn": 10,
    "max_turns": 500,
    "simulation_speed_multiplier": 1.0
  },
  "turn_sequence": [
    "LOG_TELEMETRY",
    "CALCULATE_RESOURCES",
    "PROCESS_AI_DECISIONS",
    "PROCESS_MOVEMENT_AND_COMBAT",
    "GROWTH_AND_HEALING",
    "EVENT_TRIGGER"
  ],
  "event_triggers": {
    "natural_disasters": { "frequency_per_100_turns": 2, "types": ["flood", "drought", "volcano"] },
    "diplomatic_events": { "chance_per_turn": 0.05, "types": ["trade_proposal", "peace_offer", "border_tension"] }
  },
  "victory_conditions": {
    "conquest": { "active": true, "requirement": "capture_all_capitals" },
    "technology": { "active": true, "requirement": "research_future_tech" },
    "time": { "active": true, "requirement": "highest_score_at_turn_500" }
  },
  "global_constants": {
    "starting_population": 4,
    "population_growth_threshold": 20,
    "combat_luck_factor": 0.1
  }
}
Was dein VS Code Agent jetzt tun muss:

Damit das Projekt nun autark von deinem Agenten gebaut werden kann, legst du alle 5 SPECs (world_spec, building_spec, unit_spec, ai_agent_spec, simulation_spec) in einen Ordner (z.B. /specs) und gibst dem Agenten diesen finalen Instruktions-Prompt:

Instruktion an den VS Code Agent:
"Ich habe dir die vollständige Architektur für ein Civilization-ähnliches Sandbox-Spiel in 5 SPEC-Dateien geliefert.

Deine Aufgabe:

Erstelle basierend auf diesen Specs die notwendige Ordnerstruktur: /src/engine, /src/ai, /src/data.

Implementiere die SimulationEngine unter Nutzung aller SPEC-Files.

Die KI muss die ai_agent_spec als Utility-Framework nutzen und alle Entscheidungen in der telemetry_log.json protokollieren.

Das Spiel soll die simulation_spec nutzen, um den Spielrhythmus zu steuern.

Erstelle eine einfache Dashboard.tsx, die die Statistiken aus den knowledge- und telemetry-Daten visualisiert.

Alles ist modular und datengesteuert aufgebaut. Wenn ich die Parameter in einer der JSON-Files ändere, muss sich das Spielverhalten sofort anpassen."

Abschließende Empfehlung:

Du hast jetzt ein hochkomplexes, KI-gesteuertes System auf dem Papier. Der Agent wird jetzt einen "Utility-AI-Loop" programmieren, der die Welt berechnet.

Mein Rat: Lass den Agenten zuerst einen Test-Modus bauen, in dem die KI nur auf einer 20x20 Map gegen sich selbst spielt (ohne Grafik, nur Konsole/Logs), um sicherzustellen, dass die Utility-Logik keine Endlosschleifen erzeugt.

Wenn das läuft, kannst du die Visualisierung (Grid.tsx / App.tsx) aus deinen bisherigen Experimenten einfach darüberlegen.

