# KanzlerClash — Personas × Wahlprogramme (#LTW26)

Ein **Forschungs- und Bildungsprojekt** zu den Landtagswahlen 2026:

| Landtagswahl | Datum |
|---|---|
| Sachsen-Anhalt | **6. September 2026** |
| Berlin (Abgeordnetenhaus) | **20. September 2026** |
| Mecklenburg-Vorpommern | **20. September 2026** |

**Worum es geht:** Wir definieren detaillierte, fiktive **Personas** (Lebenslagen, keine realen Personen), cachen die **Wahlprogramme** der antretenden Parteien und lassen **mehrere LLMs** (je Modellversion und Zeitpunkt) bewerten, welche Punkte eines Programms diesen Personas **besonders gut oder besonders schlecht** gefallen — jeweils **mit Seitenzahl und wörtlichem Zitat belegt** und automatisch gegen das Programm geprüft. Zusätzlich erheben wir, **welcher Anteil der Bevölkerung** in einer solchen Lebenslage steckt (aus zitierbaren amtlichen Quellen).

> **Wichtig:** Die Personas sind **fiktive Archetypen**. Jede ist *aus ihrer Lage heraus* einseitig — Neutralität entsteht erst über die **Summe** aller Personas. Ziel ist politische Bildung durch Perspektivenvielfalt, **keine** Wahlempfehlung.

---

## Was in diesem Repo passiert — und was nicht

**Passiert (transparent dokumentiert und nachvollziehbar):**
- Personas, Themen-Taxonomie, Quell-Register der Programme und **alle Prompts** sind im Klartext eingecheckt.
- Jede LLM-Auswertung speichert **Modell, Version, Zeitpunkt, Temperatur, Prompt-Version, Token-/Kosten-/Zeit-Metrik** und Belege.
- Jedes Zitat wird automatisch gegen die zitierte Seite geprüft (`pnpm run verify`).

**Passiert NICHT / Grenzen:**
- **Keine Wahlempfehlung, keine Bewertung „richtig/falsch".** Das LLM beschreibt nur die Erst-Wirkung/Resonanz aus Sicht der Persona.
- **Die Wahlprogramme selbst werden nicht weiterverbreitet** (fremdes Urheberrecht, siehe Lizenz). Eingecheckt ist nur das Quell-Register; die Programme werden lokal nachgeladen (`cache/`, git-ignoriert).
- **Bevölkerungsanteile werden nicht vom LLM „geschätzt" und als Fakt übernommen.** Das LLM liefert nur einen *Entwurf mit Quellenvorschlägen*, der von Menschen gegen die Primärquelle geprüft werden muss.
- LLMs haben einen bekannten, breit **progressiven Bias** (v. a. ökonomisch). Der Prompt adressiert das explizit; trotzdem sind die Ergebnisse als Modell-Aussagen zu lesen, nicht als Wahrheit.

---

## Verzeichnisstruktur

```
personas/             16 Personas, je eine YAML (Slug = Dateiname); reiches Profil
bevoelkerung/         je Persona ein belegter Bevölkerungsanteil (Entwurf → verifiziert)
daten/
  themen.json         16-Themen-Taxonomie
  wahlprogramme.json  Quell-Register: Partei × Landtag → URL (+ Format, Stand)
  modelle.json        zu vergleichende LLMs (Slug, Gateway-ID, Temperatur)
prompts/
  vergleich.v1.md                System-Prompt des Persona×Programm-Vergleichs (versioniert)
  herkunft-personas-und-avatare.md  Modell + Anweisungen, mit denen Personas/Avatare entstanden
  herkunft-roster.md             Herkunft/Begründung des Persona-Rosters (Spektrum-Balance)
  ausfuehrung-claude-code.md     Runbook: Auswertungen lokal mit Claude Code erzeugen (ohne Gateway)
cache/                gecachte Programme (PDF/HTML, Text, seiten.json) — GIT-IGNORIERT
ergebnisse/           generierte LLM-Auswertungen (CC-BY-SA), je Lauf eine JSON
src/pipeline/         Node/TypeScript-Pipeline (tsx)
src/site/             statische Seite (Vite) für GitHub Pages
```

---

## 1. Personas

Jede Persona ist eine YAML unter `personas/<slug>.yaml`. Der **Slug ist der Dateiname** (z. B. `landwirt`). Felder (reich, aber bewusst **aufgabenrelevant** gehalten):

`name`, `einzeiler`, `themen` (IDs aus der Taxonomie), `demografie`, `oekonomie`, `werte_haltung` (Grundwerte, Sorgen, Hoffnungen, politische Grundhaltung **ohne Partei**, Menschenbild), `sicht_auf_andere` (Haltung zu anderen Gruppen), `verhalten` (Mediennutzung, Alltag, Informationsverhalten), `themen_stakes` (was pro Thema konkret auf dem Spiel steht), `stimme` (O-Töne in Ich-Form).

### Wie die Personas entstanden sind (Methodik & Prompts)

- Die **Lebenslagen** (16 Slugs, grobe Lage, Themen, Spannungsachsen) stammen aus einem vorab kuratierten Roster, das das politische Spektrum bewusst ausbalanciert (für jede „linke" Lage eine plausibel „rechte", urban/ländlich, jung/alt, Ost-Biografie, mit/ohne Migrationsgeschichte).
- Die **ausführlichen Profile** und die **Avatar-Konfigurationen** wurden **direkt im Dialog von einem Sprachmodell (Claude Opus 4.8) ausformuliert — nicht über ein automatisiertes Skript / die API-Pipeline**. Modell, die verwendeten Anweisungen und das Verfahren sind vollständig dokumentiert in [`prompts/herkunft-personas-und-avatare.md`](prompts/herkunft-personas-und-avatare.md). Es gibt für Personas/Avatare bewusst keinen reproduzierbaren API-Prompt mit Temperatur/Seed (anders als beim Programm-Vergleich); die Artefakte sind redaktionell erstellt und menschlich reviewbar.
- **Detailtiefe nach Forschungslage:** Die Profile sind *mittel-detailliert und relevant* gehalten. Forschung zeigt, dass (a) sehr feingranulare Details die Qualität kaum steigern und (b) **irrelevante Deko-Details (Name, Lieblingsfarbe) die Modellleistung um bis zu 30 Prozentpunkte senken und Stereotype verstärken** können. Deshalb: viel aufgabenrelevante Lage/Haltung, keine Trivia, würdevolle Formulierung gerade bei marginalisierten Lebenslagen. Quellen:
  - „The Prompt Makes the Person(a)" — https://arxiv.org/html/2507.16076v2
  - „When ‚A Helpful Assistant' Is Not Really Helpful" — https://arxiv.org/html/2311.10054v3
  - Persona-Prompting-Übersicht — https://www.emergentmind.com/topics/persona-prompting-pp

## 2. Themen

`daten/themen.json` — 16 Politikfelder mit `id`, `name`, `beschreibung`. Die `id`s sind die einzigen gültigen Werte für das Feld `thema` in den Auswertungen.

## 3. Wahlprogramme (Cache)

`daten/wahlprogramme.json` ist das **Quell-Register**: pro Partei × Landtag eine `url`, optional `format` (`pdf` Standard, oder `html`) und `stand`. Antretende Parteien (Schema): `cdu, spd, afd, gruene, fdp, linke, bsw`.

`pnpm run cache` lädt die Programme nach `cache/<landtag>/<partei>/`:
- `original.pdf` / `original.html` — das Originaldokument
- `text.txt` — extrahierter Text mit Seitenmarkierungen `===== Seite N =====` (bei HTML: Abschnitte nach Überschriften)
- `seiten.json` — seiten-/abschnittsindiziert (Basis der Beleg-Prüfung)
- `meta.json` — Quell-URL, **SHA-256**, Abrufdatum, Bytes, Seitenzahl, Format, Stand

> **`cache/` ist git-ignoriert.** Wahlprogramme sind urheberrechtlich geschützt und werden nicht relizenziert/weiterverbreitet. Eingecheckt ist nur das Register; jeder kann den Cache reproduzierbar neu erzeugen.

## 4. LLM-Vergleich

`pnpm run vergleich` lädt für jede Kombination **Persona × Land × Partei × Modell** den Programmtext aus dem Cache und ruft das Modell über das **Vercel AI Gateway** auf (ein `AI_GATEWAY_API_KEY` für alle Provider, zentrale Kostensicht). Modelle stehen in `daten/modelle.json` (Standard-Temperatur **0.0** — isoliert den Modell-Effekt; Rest-Varianz misst man über mehrere Läufe via `LAEUFE`).

**Prompt:** `prompts/vergleich.v1.md` (versioniert, mit-committet, enthält Anti-Bias- und Würde-Regeln).

**Ergebnis je Lauf** (`ergebnisse/<persona>/<land>/<partei>/<modell>__<datum>__lauf<n>.json`):
- `besonders_gut[]` und `besonders_schlecht[]` — je Highlight: `thema`, `programmpunkt` (Paraphrase), **`seite` + `zitat`** (wörtlich, <15 Wörter), zwei Achsen `bezug` (`betrifft_mich` / `meine_sicht_auf_andere`) × `resonanz` (`bestaetigt` / `kontaer`), sowie **`begruendung`** (analytisch, 3. Person) und **`begruendung_selbst`** (O-Ton der Persona, Ich-Form)
- `gesamt` — Zusammenfassung + Score (−2…+2)
- Metadaten: `persona, land, partei, modell, modell_slug, zeitpunkt, temperatur, lauf, programm_stand, prompt_version`, optional `erzeugt_via` (Quelle des Laufs)
- `metrik`: `input_tokens, output_tokens, cached_tokens, total_tokens, dauer_ms, usd`

### Alternative ohne Gateway: Auswertung mit Claude Code

Statt über das AI Gateway lässt sich ein Lauf auch **lokal von einer Claude-Code-Instanz** erzeugen — gleiches Schema, gleiche Belegregeln, gleiche Pfade. Solche Läufe tragen `"erzeugt_via": "claude-code-subagent (ohne Gateway)"` und `metrik: null` (keine Token-/Kostenmessung). Das vollständige Runbook (inkl. der wichtigen Regel **`seite` = Marker-Nummer `===== Seite N =====`**, nicht die gedruckte Kopfzeile) steht in [`prompts/ausfuehrung-claude-code.md`](prompts/ausfuehrung-claude-code.md). So erzeugt: **alle 7 Parteien in `sachsen-anhalt`** (je 16 Personas, `claude-opus-4-8`, lauf1 → 112 Auswertungen, 710/711 Belege automatisch verifiziert). Für `mv`/`berlin` genügt es, diese Datei einer Claude-Code-Instanz zu geben, sobald die Programme im Cache liegen.

### Beleg-Prüfung

`pnpm run verify` prüft jedes `zitat` fuzzy gegen die angegebene Seite in `seiten.json` (robust gegen PDF-Extraktions-Rauschen, ±1 Seite Toleranz) und schreibt `beleg_ok` (`true`/`false`/`null`) je Highlight zurück. So ist leicht nachweisbar, ob das Programm das wirklich gesagt hat.

## 5. Bevölkerungsanteil

`pnpm run bevoelkerung` erzeugt je Persona einen **Entwurf** (`bevoelkerung/<slug>.yaml`, `verifiziert: false`) mit grobem Anteil, Bezug und **Quellenvorschlägen** (Destatis, Zensus 2022, Statistische Landesämter). **Jede Zahl muss von Menschen gegen die Primärquelle geprüft** und dann `verifiziert: true` gesetzt werden.

## 6. Statische Seite

`src/site/` rendert die Daten statisch (Vite). Jede Persona erhält über [`@retro-antlitz-kartei/generator`](https://dracoblue.github.io/retro-antlitz-kartei/) (MIT) deterministisch ein 8-Bit-Gesicht (Seed = Slug). Deploy nach GitHub Pages.

---

## Schnellstart

```bash
pnpm install
cp .env.example .env          # AI_GATEWAY_API_KEY eintragen

pnpm run cache                # Programme nach cache/ laden
pnpm run vergleich -- --persona landwirt --land sachsen-anhalt --partei spd --modell claude-opus-4-8
pnpm run verify               # Zitate gegen Seiten prüfen
pnpm run bevoelkerung -- --persona landwirt
pnpm run dev                  # Seite lokal (pnpm run build / preview)
```

Filter-Flags für `cache`/`vergleich`/`verify`/`bevoelkerung`: `--land`, `--partei`, `--persona`, `--modell`. Mehrere Läufe: `LAEUFE=3 pnpm run vergleich …`.

---

## Lizenz

- **Code:** MIT (`LICENSE`).
- **Generierte Daten** (Personas, Prompts, Themen, Auswertungen, Bevölkerungs-Belege): **CC-BY-SA 4.0** (`DATA-LICENSE`).
- **Wahlprogramme:** Urheberrecht der jeweiligen Parteien — **nicht** in diesem Repo enthalten, nur als Quell-URL referenziert.
