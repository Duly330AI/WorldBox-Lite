Das ist der Punkt, an dem wir das "KI-Gehirn" definieren. Wir brauchen eine Spezifikation, die der Agent als Entscheidungs-Framework nutzt. Er wird das ai_agent_spec.json File als Leitfaden verwenden, um bei jedem Spielzug eine Utility-Bewertung für alle möglichen Strategien vorzunehmen.

Hier ist die ai_agent_spec.json. Sie ist so konzipiert, dass ein KI-Agent die Logik für Diplomatie, Kriegführung und wirtschaftlichen Fokus als "Goals" abarbeiten kann.

4️⃣ ai_agent_spec.json
code
JSON
download
content_copy
expand_less
{
  "spec_id": "civ_ai_strategy_v1",
  "version": "1.0",
  "description": "Strategische Entscheidungslogik für Diplomatie, militärische Expansion und wirtschaftliche Entwicklung.",
  "utility_goals": {
    "EXPANSION": { "weight": 0.4, "triggers": ["empty_land_nearby", "high_food_tiles"] },
    "MILI_DEFENSE": { "weight": 0.3, "triggers": ["enemy_military_nearby", "low_army_strength"] },
    "DIPLOMACY": { "weight": 0.15, "triggers": ["multiple_rivals_existing", "common_enemy"] },
    "TECH_PROGRESS": { "weight": 0.15, "triggers": ["high_production_capacity", "research_stagnation"] }
  },
  "diplomatic_states": {
    "WAR": { "action_priority": 100, "allow_alliance": false, "target_logic": "destroy_units" },
    "PEACE": { "action_priority": 20, "allow_alliance": true, "target_logic": "trade_resources" },
    "ALLIANCE": { "action_priority": 10, "allow_alliance": true, "target_logic": "joint_war_or_research" }
  },
  "decision_logic": {
    "waffenruhe_evaluation": {
      "trigger_health": 0.3,
      "trigger_military_disadvantage": 0.5,
      "cooldown_ticks": 50
    },
    "alliance_evaluation": {
      "min_relation_score": 75,
      "mutual_threat_factor": 1.5
    }
  },
  "research_priorities": {
    "early_game": ["agriculture", "bronze_working", "writing"],
    "mid_game": ["gunpowder", "banking", "civil_service"],
    "late_game": ["combustion", "computers", "fission"]
  }
}
Wie der Agent diese Logik in Code übersetzt:

Utility-Scoring: Bei jedem Tick berechnet die KI für jede Fraktion einen Score für jedes Goal. Wenn MILI_DEFENSE durch einen nahen Feind ausgelöst wird, steigt der Weight-Faktor und die Produktion in den Städten wird automatisch auf unit_spec (Einheiten) statt auf building_spec (Wirtschaft) umgestellt.

Diplomatischer Status:

Der Agent implementiert ein Relationship-Matrix zwischen den Fraktionen (Werte von -100 bis +100).

Wenn die KI in den Zustand WAR eintritt, stellt sie automatisch die trade_resources-Logik ein und initiiert die ATTACK_ENEMY-Aktionen (die wir in Phase 5 definiert haben).

Lernfähigkeit (Reinforcement):

Der Agent soll nach einem Kampf prüfen: "Hat mein Bündnis (ALLIANCE) den Sieg beschleunigt?"

Wenn ja, speichert die Engine das in der knowledge-Datenbank (die wir in der Telemetrie bereits haben) und erhöht in Zukunft die Wahrscheinlichkeit, Allianzen einzugehen.

Was wir jetzt haben:

world_spec: Die physische Bühne.

building_spec: Die wirtschaftliche Kapazität.

unit_spec: Die militärische Kapazität.

ai_agent_spec: Die strategische Entscheidungsfindung.

Das ist ein komplettes Grundgerüst für ein Civilization-Spiel.

Der letzte Schliff für den Agenten:

Damit der Agent jetzt wirklich "loslaufen" kann, bräuchte er nur noch die simulation_spec.json. Diese Datei ist der "Motor", der alles zusammenhält (Rundenablauf, Ereignisse wie Naturkatastrophen, Siegbedingungen).
