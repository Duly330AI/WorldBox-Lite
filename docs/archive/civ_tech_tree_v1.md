
{
  "spec_id": "civ_tech_tree_v1",
  "version": "1.0",
  "description": "Technologiebaum basierend auf Sid Meier's Civilization IV.",
  "techs": {
    "agriculture": { "cost": 60, "prerequisites": [], "unlocks": ["farm"] },
    "mining": { "cost": 50, "prerequisites": [], "unlocks": ["mine"] },
    "pottery": { "cost": 80, "prerequisites": ["agriculture"], "unlocks": ["granary", "cottage"] },
    "bronze_working": { "cost": 120, "prerequisites": ["mining"], "unlocks": ["axeman", "copper", "slavery"] },
    "iron_working": { "cost": 200, "prerequisites": ["bronze_working"], "unlocks": ["swordsman", "iron", "clear_jungle"] },
    "writing": { "cost": 120, "prerequisites": ["alphabet"], "unlocks": ["library", "open_borders"] },
    "civil_service": { "cost": 800, "prerequisites": ["math", "code_of_laws"], "unlocks": ["maceman", "bureaucracy"] },
    "gunpowder": { "cost": 1000, "prerequisites": ["guilds", "education"], "unlocks": ["musketman"] },
    "steam_power": { "cost": 1800, "prerequisites": ["scientific_method"], "unlocks": ["coal", "workers_50_percent_faster"] }
  },
  "era_progression": [
    "ancient", "classical", "medieval", "renaissance", "industrial", "modern", "future"
  ],
  "ai_research_weights": {
    "expansionist": ["agriculture", "pottery", "sailing"],
    "militarist": ["bronze_working", "iron_working", "gunpowder"],
    "economic": ["mining", "currency", "banking"]
  }
}
Ideen für die weiteren notwendigen SPEC Files (basierend auf der Roadmap):

Nachdem wir nun die Technologien definiert haben, brauchst du für deinen VS Code Agenten als Nächstes:

building_spec.json:

Idee: Definiere hier, was ein Gebäude kostet (Produktion) und was es generiert (Gold, Food, Beaker).

Beispiel-Inhalt: {"granary": {"cost": 60, "food_bonus": 2, "required_tech": "pottery"}}

unit_spec.json:

Idee: Kampfwerte (Stärke), Bewegungspunkte, Baukosten.

Beispiel-Inhalt: {"axeman": {"strength": 5, "cost": 40, "required_tech": "bronze_working"}}

ai_behavior_weights.json (Neu & sehr wichtig für dein Ziel):

Idee: Da du willst, dass die KI "lernt", brauchen wir eine Datei, die Gewichtungstabellen enthält. Wenn die KI oft verliert, soll der Agent diese Werte in der Datei anpassen.

Ziel: Diese Datei fungiert als "Gehirn-Konfiguration", die der Agent bei einer Niederlage umschreiben kann.

Wie ein VS Code Agent das komplett selbst bauen kann:

Damit dein Agent das wirklich autark baut, gib ihm folgenden Auftrag ("Prompt"):

"Ich baue eine Civilization-ähnliche Simulation. Erstelle mir basierend auf den bereitgestellten SPEC-Files (world, tech, building, unit) eine SimulationEngine-Klasse.

Die Engine muss einen 'Tick'-basierten Loop haben.

Sie muss prüfen: Hat eine KI die nötigen Ressourcen für eine Tech? Wenn ja, starte Forschung.

Jedes Tick soll ein Telemetrie-Log in eine telemetry_log.json schreiben, das meine Entscheidungen (Goal, Plan, Action) festhält.

Nutze das Utility-System für Entscheidungen."
