<!--
Tool-neutrales Runbook: Persona×Programm-Auswertungen mit einer beliebigen agentischen
CLI erzeugen (Codex/GPT, Gemini CLI, Claude Code …) — ohne Vercel AI Gateway.
Hand dieser Datei + dem Repo der CLI; sie liest/schreibt die Dateien selbst.
-->

# Ausführung mit einer fremden CLI (Codex, Gemini CLI …) — ohne Gateway

Diese Anleitung erzeugt dieselben Ergebnis-JSONs wie die API-Pipeline (`pnpm run vergleich`),
nur dass **die jeweilige CLI (das Modell) die Bewertung übernimmt** und die Dateien direkt
ins Repo schreibt. Schema, Pfade und Belegregeln sind identisch — damit `pnpm run verify`
und die statische Seite unverändert weiterfunktionieren und die Modelle vergleichbar bleiben.

## Pro Lauf zu setzen (Parameter)

| Parameter | Bedeutung | Beispiel |
|---|---|---|
| `LAND` | Landtagswahl-Slug | `sachsen-anhalt` |
| `PARTEI` | eine von `cdu spd afd gruene fdp linke bsw` | `cdu` |
| `MODELL_SLUG` | stabiler Bezeichner des Modells (= Dateiname-Präfix **und** Tab-Label-Quelle auf der Seite) | siehe Tabelle |
| `MODELL` | vollständige Modell-ID | siehe Tabelle |
| `ERZEUGT_VIA` | womit erzeugt (Transparenz) | siehe Tabelle |

| Tool | `MODELL_SLUG` | `MODELL` | `ERZEUGT_VIA` |
|---|---|---|---|
| Codex / GPT-5.5 | `gpt-5.5` | `gpt-5.5` | `codex/gpt-5.5 (medium, ChatGPT-Login)` |
| Gemini via `agy` | `gemini-3.1-pro` | `Gemini 3.1 Pro (High)` | `agy (gemini-3.1-pro, ohne Gateway)` |

(Trag den **echten** Modellnamen ein, den deine CLI nutzt. Der `MODELL_SLUG` darf keine
`/` enthalten — er wird Teil des Dateinamens.)

## Voraussetzungen
1. Programm gecacht: `cache/<LAND>/<PARTEI>/text.txt` mit Markierungen `===== Seite N =====`.
   Fehlt es: `pnpm run cache` (zieht aus `daten/wahlprogramme.json`; `cache/` ist git-ignoriert).
2. `daten/themen.json` und `personas/<slug>.yaml` liegen vor.

## Was die CLI liest
- **System-Regeln:** `prompts/vergleich.v1.md` — strikt befolgen.
- **Themen-IDs:** `daten/themen.json` (einzige gültige Werte für `thema`).
- **Programmtext:** `cache/<LAND>/<PARTEI>/text.txt`.
- **Persona-Profil (voll):** `personas/<slug>.yaml`.

## Die 16 Persona-Slugs
`landwirt, handwerkerin, pendler, rentnerpaar, polizist, studentin_queer,
alleinerziehende, pflegekraft, eingebuergerte, mieterin, industriearbeiter,
energie_strukturwandel, junge_familie_bau, solo_kreative, landaerztin, soldat`

## Ausgabe — genau eine Datei pro Persona
Pfad: `ergebnisse/<slug>/<LAND>/<PARTEI>/<MODELL_SLUG>__<datum>__lauf1.json`
Beispiel: `ergebnisse/landwirt/sachsen-anhalt/cdu/gpt-5.5__2026-06-30__lauf1.json`

```json
{
  "persona": "<slug>",
  "land": "<LAND>",
  "partei": "<PARTEI>",
  "modell": "<MODELL>",
  "modell_slug": "<MODELL_SLUG>",
  "zeitpunkt": "<ISO-8601, z. B. 2026-06-30T00:00:00Z>",
  "temperatur": 0,
  "lauf": 1,
  "programm_stand": null,
  "prompt_version": "vergleich.v1",
  "erzeugt_via": "<ERZEUGT_VIA>",
  "metrik": { "input_tokens": null, "output_tokens": null, "cached_tokens": null, "total_tokens": null, "dauer_ms": null, "usd": null },
  "besonders_gut": [ /* Highlights */ ],
  "besonders_schlecht": [ /* Highlights */ ],
  "gesamt": { "zusammenfassung": "<2-4 Sätze, dritte Person>", "score": -2 }
}
```
Jedes Highlight:
```json
{
  "titel_selbst": "<kurzer O-Ton-Slogan der Persona, max ~6 Wörter>",
  "thema": "<themen-id aus daten/themen.json>",
  "programmpunkt": "<Paraphrase der Parteiposition in eigenen Worten>",
  "seite": 0,
  "zitat": "<WÖRTLICHES Kurzzitat von GENAU dieser Seite, < 15 Wörter>",
  "bezug": "betrifft_mich",
  "resonanz": "bestaetigt",
  "begruendung": "<analytisch, dritte Person, 1-3 Sätze>",
  "begruendung_selbst": "<O-Ton der Persona, Ich-Form, untermauert titel_selbst>"
}
```
`bezug` ∈ {`betrifft_mich`, `meine_sicht_auf_andere`}; `resonanz` ∈ {`bestaetigt`, `kontaer`}.
`metrik` bleibt `null`. Typisch 3–8 Highlights je Liste; leere Liste ist erlaubt und gültig.

## KRITISCHE Belegregeln (sonst schlägt die Prüfung fehl)
1. **`zitat` wörtlich** und zusammenhängend von **genau der angegebenen Seite**, < 15 Wörter,
   **keine Auslassungen/`...`**.
2. **`seite` = Marker-Nummer** aus `===== Seite N =====`, NICHT die gedruckte Kopfzeile
   (die kann um 1 abweichen). Im Zweifel die Marker-Zahl N nehmen.
3. **Wörter mit Zeilenumbruch-Bindestrich (`wort- teil`) meiden** — lieber eine andere,
   saubere Passage zitieren.
4. **JSON muss valide sein.** Deutsche Anführungszeichen im Zitat als „…“ (typografisch)
   schreiben, NICHT als ASCII `"` — ein ASCII-`"` im String zerbricht das JSON.
5. Nur Punkte aufnehmen, die die Lage/Haltung der Persona **wirklich** berühren.

## Empfohlenes Vorgehen
- **Eine Partei pro CLI-Sitzung** (16 Dateien). Mehrere Parteien parallel = mehrere Terminals.
- Programmtext einmal lesen, dann der Reihe nach alle 16 Personas abarbeiten und je eine
  Datei schreiben.

## Nach dem Lauf (vom Menschen, einmal)
```bash
pnpm run verify --fix     # Zitate gegen Seiten prüfen, verschobene Seiten korrigieren
pnpm run site:data        # data.json für die Seite neu bauen
pnpm run build            # statische Seite bauen (optional)
```
Verbleibende `beleg_ok: false` sind transparent als „⚠ ungeprüft" auf der Seite sichtbar.

## So wurde es konkret genutzt (Befehle + Skripte)

**Gemini 3.1 Pro über `agy`** (`MODELL_SLUG=gemini-3.1-pro`):
```bash
# Einzelaufruf (eine Persona):
agy --dangerously-skip-permissions --model "Gemini 3.1 Pro (High)" --print-timeout 6m -p "$PROMPT"
# Batch je Partei (16 Personas):           bash scripts/agy-lauf.sh <partei>
# Idempotent nur Lücken füllen (sequenziell): bash scripts/agy-fill.sh
```

**GPT-5.5 über Codex** (`MODELL_SLUG=gpt-5.5`, ChatGPT-Login):
```bash
codex exec --dangerously-bypass-approvals-and-sandbox -m gpt-5.5 "$PROMPT"
# (oder --full-auto; read-only reicht NICHT zum Schreiben)
```
Prompt jeweils aus `prompts/llm-cli-vorlage.md` per Platzhalter-Ersetzung (`__LAND__`, `__PARTEI__`,
`__PERSONA__`, `__MODELL_SLUG__`, `__MODELL__`); `erzeugt_via` an das Tool anpassen.

Nachbereitung: `node scripts/fix-agy.mjs <partei>` (Score auf −2..2 clampen, Seitenzahl auf die
belegende Seite korrigieren) → `pnpm run verify --fix` → `pnpm run site:data && pnpm run build`.

## Betriebs-Lektionen (aus dem echten Lauf)
- **Nicht stark parallel:** 6 gleichzeitige `agy`-Jobs liefen ins Rate-Limit → ~halbe Belegschaft
  fehlte. Sequenziell ist verlässlich.
- **Headless ist flaky:** mal Sofort-Abbruch (leere Antwort), mal Hänger trotz `--print-timeout`.
  Gegenmittel: hartes `timeout` pro Aufruf + `agy-fill.sh` (idempotent) mehrfach laufen lassen.
- **Abgebrochene Teilschreibungen** (valides JSON ohne `gesamt`) vor dem Verifizieren entfernen.
- Pro Aufruf liest die CLI das ganze Programm neu — kein geteilter Cache wie über das Gateway.
