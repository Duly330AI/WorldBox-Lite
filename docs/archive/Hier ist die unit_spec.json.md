Hier ist die unit_spec.json. Sie enthält die Kampfeinheiten, Erkunder und Arbeiter basierend auf deiner Civilization IV Vorlage. Ich habe sie so strukturiert, dass dein VS Code Agent direkt die Kosten und die Technologie-Voraussetzungen für die ProductionQueue deiner Städte übernehmen kann.

3️⃣ unit_spec.json
code
JSON
download
content_copy
expand_less
{
  "spec_id": "civ_units_v1",
  "version": "1.0",
  "description": "Definition aller militärischen und zivilen Einheiten aus Civilization IV.",
  "units": {
    "scout": { "cost": 20, "required_tech": "hunting", "combat_strength": 1, "movement": 2, "is_combat": false },
    "worker": { "cost": 60, "required_tech": "agriculture", "combat_strength": 0, "movement": 2, "is_combat": false },
    "archer": { "cost": 25, "required_tech": "archery", "combat_strength": 3, "movement": 1, "is_combat": true },
    "axeman": { "cost": 40, "required_tech": "bronze_working", "combat_strength": 5, "movement": 1, "is_combat": true },
    "swordsman": { "cost": 40, "required_tech": "iron_working", "combat_strength": 6, "movement": 1, "is_combat": true },
    "horse_archer": { "cost": 50, "required_tech": "horseback_riding", "combat_strength": 6, "movement": 2, "is_combat": true },
    "catapult": { "cost": 50, "required_tech": "mathematics", "combat_strength": 5, "movement": 1, "is_combat": true },
    "musketman": { "cost": 60, "required_tech": "gunpowder", "combat_strength": 9, "movement": 1, "is_combat": true },
    "cannon": { "cost": 80, "required_tech": "steel", "combat_strength": 12, "movement": 1, "is_combat": true },
    "tank": { "cost": 150, "required_tech": "industrialism", "combat_strength": 28, "movement": 2, "is_combat": true },
    "modern_armor": { "cost": 200, "required_tech": "composites", "combat_strength": 40, "movement": 3, "is_combat": true }
  },
  "combat_rules": {
    "bonus_types": ["terrain", "promotion", "strength_vs_unit_type"],
    "movement_depletion": true,
    "can_fortify": true
  }
}
Integration für deinen VS Code Agenten:

Wenn du den Agenten anweist, das Spiel zu bauen, gib ihm diesen Hinweis zur Verknüpfung der Dateien:

Produktions-Queue: Der Agent soll in der City-Klasse prüfen: if (city.production >= unit_spec[target].cost && player.hasTech(unit_spec[target].required_tech)).

KI-Strategie (Wichtig!): Der Agent soll in der ai_agent_spec.json eine Logik schreiben wie:

Wenn enemy_nearby == true -> Priorisiere is_combat: true Einheiten mit der höchsten combat_strength.

Wenn empire_needs_development == true -> Baue worker.

Visualisierung: Wenn er die Einheiten rendert, soll er das combat_strength-Attribut nutzen, um kleine Status-Balken unter dem Einheiten-Icon anzuzeigen (z. B. ein roter Strich für Stärke 1-10, zwei für 11-30, etc.).

Was fehlt noch?

Wir haben jetzt:

World (Terrain/Tiles)

Buildings (Produktion/Wirtschaft)

Units (Militär/Erkundung)

Das Herzstück fehlt noch: ai_agent_spec.json. Hier wird die KI entscheiden, ob sie forscht, baut oder kämpft.

