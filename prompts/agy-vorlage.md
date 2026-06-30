Du bist eine agentische CLI mit Datei-Lese-/Schreibzugriff im Repo /Users/jan/workspaces/personas.
Aufgabe: Bewerte EIN Wahlprogramm aus Sicht EINER fiktiven Persona und schreibe GENAU EINE JSON-Datei.

PARAMETER: LAND=__LAND__  PARTEI=__PARTEI__  PERSONA=__PERSONA__
MODELL_SLUG=__MODELL_SLUG__  MODELL=__MODELL__

LIES ZUERST:
1) prompts/vergleich.v1.md            — die Bewertungsregeln, strikt befolgen.
2) daten/themen.json                  — die "id"-Werte sind die einzigen gültigen Werte für "thema".
3) cache/__LAND__/__PARTEI__/text.txt — der Programmtext, Markierungen "===== Seite N =====".
   (Falls aus HTML, z. B. AfD: "Seite N" = Abschnitt N, 1–20.)
4) personas/__PERSONA__.yaml          — das volle Persona-Profil (inkl. themen_stakes).

SCHREIBE GENAU EINE Datei (Ordner anlegen, falls nötig) nach:
ergebnisse/__PERSONA__/__LAND__/__PARTEI__/__MODELL_SLUG____2026-06-30__lauf1.json

Die Datei ist EIN OBJEKT (kein nacktes Array!) mit GENAU dieser Struktur:
{
  "persona": "__PERSONA__",
  "land": "__LAND__",
  "partei": "__PARTEI__",
  "modell": "__MODELL__",
  "modell_slug": "__MODELL_SLUG__",
  "zeitpunkt": "2026-06-30T00:00:00Z",
  "temperatur": 0,
  "lauf": 1,
  "programm_stand": null,
  "prompt_version": "vergleich.v1",
  "erzeugt_via": "agy (__MODELL_SLUG__, ohne Gateway)",
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

GRÜNDLICHKEIT (wichtig — liefere genug Substanz):
- Gehe die themen_stakes und die Haltung der Persona SYSTEMATISCH durch und durchsuche das
  Programm nach ALLEN Stellen, die ihre Lage berühren — sowohl direkt (betrifft_mich) als
  auch ihre Sicht auf andere Gruppen (meine_sicht_auf_andere).
- Ziel: typischerweise 3–8 Einträge JE Liste (besonders_gut UND besonders_schlecht),
  wenn das Programm die Lage an so vielen Stellen berührt. Sei nicht knapp.
- ABER: nichts erfinden. Nur belegbare, wirklich berührende Punkte. Eine leere Liste ist
  erlaubt, wenn es ehrlich keine passenden Stellen gibt.

PFLICHT / häufige Fehler vermeiden:
- "besonders_gut" UND "besonders_schlecht" sind beide Pflicht (je ein Array; leer = []).
- "gesamt" ist Pflicht (Zusammenfassung + Score -2..2).
- "seite" ist eine ZAHL (z.B. 38), NICHT "Seite 38". Maßgeblich ist die Marker-Nummer "===== Seite N =====".
- "zitat" wörtlich und zusammenhängend von genau dieser Seite; deutsche Anführungszeichen als „…" (NIE ASCII-", das zerbricht das JSON); Wörter mit Zeilenumbruch-Bindestrich meiden.
- Anti-Bias: markt-/wirtschaftsliberale und konservative Positionen mit gleichen Maßstäben wie progressive; Würde bei marginalisierten Lebenslagen.

Gib am Ende nur eine kurze Bestätigung (welche Datei, wie viele gut/schlecht), nicht den vollen Inhalt.
