Du bist eine agentische CLI mit Datei-Lese-/Schreibzugriff im Repo /Users/jan/workspaces/personas.
Aufgabe: Bewerte EIN Wahlprogramm aus Sicht EINER fiktiven Persona und schreibe GENAU EINE JSON-Datei.

PARAMETER: LAND=sachsen-anhalt  PARTEI=cdu  PERSONA=landwirt
MODELL_SLUG=gemini-3.1-pro  MODELL=Gemini 3.1 Pro (High)

LIES ZUERST:
1) prompts/vergleich.v1.md      — die Bewertungsregeln, strikt befolgen.
2) daten/themen.json            — die "id"-Werte sind die einzigen gültigen Werte für "thema".
3) cache/sachsen-anhalt/cdu/text.txt — der Programmtext, Markierungen "===== Seite N =====".
4) personas/landwirt.yaml       — das volle Persona-Profil.

SCHREIBE GENAU EINE Datei (Ordner anlegen, falls nötig) nach:
ergebnisse/landwirt/sachsen-anhalt/cdu/gemini-3.1-pro__2026-06-30__lauf1.json

Die Datei ist EIN OBJEKT (kein nacktes Array!) mit GENAU dieser Struktur:
{
  "persona": "landwirt",
  "land": "sachsen-anhalt",
  "partei": "cdu",
  "modell": "Gemini 3.1 Pro (High)",
  "modell_slug": "gemini-3.1-pro",
  "zeitpunkt": "2026-06-30T00:00:00Z",
  "temperatur": 0,
  "lauf": 1,
  "programm_stand": null,
  "prompt_version": "vergleich.v1",
  "erzeugt_via": "agy (gemini-3.1-pro, ohne Gateway)",
  "metrik": { "input_tokens": null, "output_tokens": null, "cached_tokens": null, "total_tokens": null, "dauer_ms": null, "usd": null },
  "besonders_gut": [ <Highlights, die der Persona GEFALLEN> ],
  "besonders_schlecht": [ <Highlights, die der Persona MISSFALLEN> ],
  "gesamt": { "zusammenfassung": "<2-4 Sätze, dritte Person>", "score": <ganzzahl -2..2> }
}

JEDES HIGHLIGHT:
{
  "titel_selbst": "<kurzer O-Ton-Slogan der Persona, max ~6 Wörter>",
  "thema": "<themen-id aus daten/themen.json>",
  "programmpunkt": "<Paraphrase der Parteiposition in eigenen Worten>",
  "seite": 38,
  "zitat": "<WÖRTLICH von genau dieser Seite, unter 15 Wörter, keine Auslassungen>",
  "bezug": "betrifft_mich" oder "meine_sicht_auf_andere",
  "resonanz": "bestaetigt" oder "kontaer",
  "begruendung": "<analytisch, dritte Person, 1-3 Sätze>",
  "begruendung_selbst": "<O-Ton der Persona in Ich-Form, untermauert titel_selbst>"
}

PFLICHT / häufige Fehler vermeiden:
- "besonders_gut" UND "besonders_schlecht" sind beide Pflicht (je ein Array; leer = []).
- "gesamt" ist Pflicht (Zusammenfassung + Score).
- "seite" ist eine ZAHL (z.B. 38), NICHT "Seite 38". Maßgeblich ist die Marker-Nummer aus "===== Seite N =====".
- "zitat" wörtlich und zusammenhängend von genau dieser Seite; deutsche Anführungszeichen als „…" (NIE ASCII-", das zerbricht das JSON); Wörter mit Zeilenumbruch-Bindestrich meiden.
- Nur Punkte, die die Lage/Haltung der Persona WIRKLICH berühren; lieber wenige starke; leere Liste erlaubt. Keine erfundene Resonanz.
- Anti-Bias: markt-/wirtschaftsliberale und konservative Positionen mit gleichen Maßstäben wie progressive.

Gib am Ende nur eine kurze Bestätigung (welche Datei geschrieben), nicht den vollen Inhalt.
