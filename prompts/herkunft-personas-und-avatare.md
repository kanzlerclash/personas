# Herkunft der Personas und Avatar-Konfigurationen

Dieses Dokument hält transparent fest, **wie** die Persona-Profile (`personas/*.yaml`)
und die Avatar-Konfigurationen (`gesicht.config` darin) entstanden sind — inkl. Modell
und der verwendeten Anweisungen.

## Wichtig: kein reproduzierbarer API-Prompt

Anders als der **Programm-Vergleich** (`prompts/vergleich.v1.md`, ein **versionierter Prompt
mit festem JSON-Schema** — jederzeit reproduzierbar, egal ob über Gateway, Claude Code oder
Agent-CLI) wurden Personas und Avatare **redaktionell im interaktiven Dialog** erstellt — nicht
über ein Skript / die Vercel-AI-Gateway-Pipeline. Es gibt daher **keinen einzelnen Prompt mit
Temperatur/Seed** und keine Token-Metrik dazu. Die folgenden Angaben dokumentieren den realen
Entstehungsweg.

## Modell

- **Modell:** Claude Opus 4.8 (1M-Kontext), Modell-ID `claude-opus-4-8[1m]`, im Rahmen einer
  **Claude-Code**-Sitzung (interaktiver Coding-Agent).
- **Rolle:** Das Modell hat die Profile und Avatar-Configs auf Anweisung der projektführenden
  Person ausformuliert; jede Datei ist menschlich reviewbar und im Git-Verlauf nachvollziehbar.

## Persona-Profile — Anweisungen (die de-facto „Prompts")

Die Personas wurden auf Basis folgender Anweisungen der projektführenden Person erstellt
(sinngemäß/zitiert aus dem Arbeitsdialog):

1. Ausgangsmaterial: ein vorab kuratiertes **Roster** mit 16 Lebenslagen (Slugs, grobe Lage,
   Themen, bewusst über das politische Spektrum balanciert).
2. „Die Personas sind nicht detailliert genug. **Recherchiere, wie detailliert man das macht,
   um die LLMs gut arbeiten zu lassen.**" → daraufhin Web-Recherche (Quellen unten) und ein
   **reich-aber-relevantes** Schema (Demografie, Ökonomie, Werte/Haltung, Sicht auf andere
   Gruppen, Verhalten/Mediennutzung, Themen-Stakes, O-Töne).
3. „Die `*.yaml` braucht keine `id` (steckt im Dateinamen), nur `name` und Lage … Spannungs-
   achse, `appearsAt`, `questTemplates`, `challengeMap` sind **nicht** nötig."
4. „Wie sollen die restlichen 14 Personas … — **du erzeugst die selbst (ohne Gateway).**" →
   alle 16 Profile wurden vom Modell direkt geschrieben, nicht per API generiert.

**Leitlinie aus der Recherche** (warum mittlere, relevante Detailtiefe statt maximaler):
- „The Prompt Makes the Person(a)" — https://arxiv.org/html/2507.16076v2
- „When ‚A Helpful Assistant' Is Not Really Helpful" — https://arxiv.org/html/2311.10054v3
- Persona-Prompting-Übersicht — https://www.emergentmind.com/topics/persona-prompting-pp

Kernbefunde, die das Schema prägten: sehr feingranulare Details bringen kaum Mehrwert;
**irrelevante Deko-Details (Name, Lieblingsfarbe) können die Modellleistung um bis zu 30
Prozentpunkte senken und Stereotype verstärken** — daher viel aufgabenrelevante Lage/Haltung,
keine Trivia, würdevolle Formulierung gerade bei marginalisierten Lebenslagen.

## Avatar-Konfigurationen — Anweisung & Verfahren

- **Anweisung:** „Die Avatare passen NULL zu den Personen. Generiere bitte etwas, das jeweils
  zur Persona passt."
- **Verfahren (kein LLM-API-Call):** Aus der Library
  [`@retro-antlitz-kartei/generator`](https://dracoblue.github.io/retro-antlitz-kartei/) (MIT)
  wurden die verfügbaren Teile-IDs und Farbpaletten ausgelesen (`PARTS`, `HAIRS`, `SKIN`,
  `COLS`, `BG`). Das Modell hat daraus je Persona eine passende `gesicht.config` von Hand
  abgeleitet — orientiert an Beruf, Alter, Lebenswelt (z. B. Landwirt → Schirmmütze, Warnweste,
  ergrautes Haar; Pflegekraft → Kittel/Uniform-Farbe; Soldat → Schirmmütze, Uniform).
- **Bewusste Vereinfachung:** Die Avatare sind 8-Bit-Karikaturen und können Lebenslagen nur
  grob andeuten; sie sind Illustration, keine Aussage über reale Personen.

## Reproduzierbarkeit

Personas/Avatare sind **redaktionelle Artefakte** und stehen unter CC-BY-SA (siehe
`DATA-LICENSE`). Wer sie reproduzieren/fortschreiben will, nutzt dieses Dokument als
Methodenbeschreibung; eine 1:1-Reproduktion über einen festen API-Prompt ist hier
ausdrücklich **nicht** gegeben (im Gegensatz zum Programm-Vergleich).
