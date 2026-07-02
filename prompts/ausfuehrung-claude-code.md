<!--
Runbook: Persona×Programm-Auswertungen LOKAL mit einer Claude-Code-Instanz erzeugen
(ohne Vercel AI Gateway / ohne `pnpm run vergleich`). Versioniert & mit-committet.
Wer dieses Repo + diese Datei einer Claude-Code-Instanz gibt, kann damit weitere
Land/Partei-Kombinationen (z. B. mv, berlin) selbstständig fertigstellen.
-->

# Ausführung mit Claude Code (ohne Gateway)

Dieser Lauf erzeugt dieselben Ergebnis-JSONs wie die API-Pipeline (`pnpm run vergleich`),
nur dass **ein Claude-Code-Agent** die Bewertung übernimmt, statt das Modell über das
Vercel AI Gateway aufzurufen. Schema, Dateipfade und Belegregeln sind identisch, damit
`pnpm run verify` und die statische Seite unverändert weiterfunktionieren.

So entstanden bereits: **alle 7 Parteien in `sachsen-anhalt`** (je 16 Personas, `claude-opus-4-8`, lauf1 → 112 Auswertungen). Sonnet 4.6 lief analog; Gemini 3.1 Pro und GPT-5.5 über Agent-CLIs (siehe `ausfuehrung-cli.md`).

## Wann dieser Weg
- Kein `AI_GATEWAY_API_KEY` vorhanden / Gateway nicht erwünscht.
- Eine neue Land/Partei-Kombination soll ergänzt werden (z. B. `mv`, `berlin`), sobald
  das jeweilige Wahlprogramm im Cache liegt.

## Voraussetzungen
1. Das Wahlprogramm muss gecacht sein: `cache/<land>/<partei>/text.txt` mit
   Seitenmarkierungen `===== Seite N =====`. Falls nicht vorhanden:
   `pnpm run cache` (zieht aus `daten/wahlprogramme.json`). `cache/` ist git-ignoriert.
2. `daten/themen.json` (gültige `thema`-IDs) und `personas/<slug>.yaml` liegen vor.

## Eingaben, die der Agent liest
- **System-Regeln:** `prompts/vergleich.v1.md` — strikt befolgen (nur aus Lage/Haltung
  der Persona urteilen; jeden Punkt mit Seite + wörtlichem Zitat belegen; ohne Beleg
  weglassen; **keine erfundene Resonanz**; Erst-Wirkung statt Partei-Verdikt;
  **Anti-Bias** — markt-/wirtschaftsliberale und konservative Positionen mit gleichen
  Maßstäben wie progressive; **Würde** gerade bei marginalisierten Lebenslagen).
- **Themen-Taxonomie:** `daten/themen.json` — die `id`-Werte sind die **einzigen**
  gültigen Werte für das Feld `thema`.
- **Programmtext:** `cache/<land>/<partei>/text.txt`.
- **Persona-Profil (voll):** `personas/<slug>.yaml`.

## Die 16 Persona-Slugs
`landwirt, handwerkerin, pendler, rentnerpaar, polizist, studentin_queer,
alleinerziehende, pflegekraft, eingebuergerte, mieterin_berlin, industriearbeiter,
energie_strukturwandel, junge_familie_bau, solo_kreative, landaerztin, soldat`

Parteien-Schema (je nach Antritt im Land): `cdu, spd, afd, gruene, fdp, linke, bsw`.

## Ausgabe — genau eine Datei pro Persona
Pfad: `ergebnisse/<slug>/<land>/<partei>/<modell_slug>__<datum>__lauf<n>.json`
Beispiel: `ergebnisse/landwirt/sachsen-anhalt/bsw/claude-opus-4-8__2026-06-30__lauf1.json`

JSON-Struktur (exakt diese Felder, gültiges JSON):
```json
{
  "persona": "<slug>",
  "land": "<land>",
  "partei": "<partei>",
  "modell": "claude-opus-4-8[1m]",
  "modell_slug": "claude-opus-4-8",
  "zeitpunkt": "<ISO-8601, z. B. 2026-06-30T00:00:00Z>",
  "temperatur": 0,
  "lauf": 1,
  "programm_stand": null,
  "prompt_version": "vergleich.v1",
  "erzeugt_via": "claude-code-subagent (ohne Gateway)",
  "metrik": { "input_tokens": null, "output_tokens": null, "cached_tokens": null, "total_tokens": null, "dauer_ms": null, "usd": null },
  "besonders_gut": [ /* Highlights */ ],
  "besonders_schlecht": [ /* Highlights */ ],
  "gesamt": { "zusammenfassung": "<2-4 Sätze, dritte Person>", "score": -2..2 }
}
```
Jedes Highlight:
```json
{
  "titel_selbst": "<kurzer O-Ton-Slogan der Persona, max ~6 Wörter>",
  "thema": "<themen-id aus daten/themen.json>",
  "programmpunkt": "<Paraphrase der Parteiposition in eigenen Worten>",
  "seite": <Seitenzahl laut ===== Seite N =====>,
  "zitat": "<WÖRTLICHES Kurzzitat von GENAU dieser Seite, < 15 Wörter>",
  "bezug": "betrifft_mich" | "meine_sicht_auf_andere",
  "resonanz": "bestaetigt" | "kontaer",
  "begruendung": "<analytisch, dritte Person, 1-3 Sätze>",
  "begruendung_selbst": "<O-Ton der Persona, Ich-Form, untermauert titel_selbst>"
}
```
Hinweise: `metrik` bleibt `null` (kein Gateway = keine Token-/Kostenmessung).
`erzeugt_via` markiert den Lauf als agentisch erzeugt. Typisch 3–8 Highlights je Liste;
leere Liste ist erlaubt und gültig.

## KRITISCHE Belegregeln (sonst schlägt die Prüfung fehl)
1. **`zitat` wörtlich** und zusammenhängend von **genau der angegebenen Seite**, unter
   15 Wörter, **keine Auslassungen/`...`**.
2. **Seitenzahl = Marker-Nummer** aus `===== Seite N =====` — **nicht** die im Fließtext
   gedruckte Kopfzeile. ACHTUNG, häufiger Fehler: Die gedruckte Kopfzeile `Seite | X` ist
   in diesem Datensatz **um 1 kleiner** als der Marker (Deckblatt-Versatz), d. h.
   **Marker N enthält den Text mit Kopfzeile `Seite | N-1`**. Immer die **Marker-Zahl N**
   ins Feld `seite` schreiben.
3. **Zeilenumbruch-Bindestriche meiden:** Die PDF-Extraktion trennt Wörter als
   `wort- teil`. Wähle ein sauberes, zusammenhängendes Teilstück **ohne** solchen
   Trennstrich (z. B. nicht „Zusam- menlegung“ zitieren, sondern eine andere Passage).
4. Nur Punkte aufnehmen, die die Lage/Haltung der Persona **wirklich** berühren.

## Selbstprüfung vor dem Abschluss
1. **JSON valide:**
   ```bash
   for f in $(find ergebnisse -path "*<land>/<partei>/claude-opus-4-8__*__lauf1.json"); do \
     python3 -c "import json;json.load(open('$f'))" && echo OK $f || echo BAD $f; done
   ```
2. **Zitate verbatim auf der Marker-Seite** (eigene Vorabkontrolle, robust gegen
   NBSP/Soft-Hyphen):
   ```bash
   python3 - <<'PY'
   import json,glob,re,unicodedata
   LAND,PARTEI="<land>","<partei>"
   def norm(s):
       s=unicodedata.normalize('NFKC',s).replace(' ',' ').replace('\xad','')
       return re.sub(r'\s+',' ',s).lower().strip()
   pages={};cur=None;buf=[]
   for line in open(f'cache/{LAND}/{PARTEI}/text.txt'):
       m=re.match(r'=====\s*Seite\s+(\d+)\s*=====',line)
       if m:
           if cur is not None: pages[cur]=' '.join(buf)
           cur=int(m.group(1));buf=[]
       else: buf.append(line)
   if cur is not None: pages[cur]=' '.join(buf)
   np={k:norm(v) for k,v in pages.items()};bad=0;tot=0
   for fp in glob.glob(f'ergebnisse/*/{LAND}/{PARTEI}/claude-opus-4-8__*__lauf1.json'):
       d=json.load(open(fp))
       for key in ('besonders_gut','besonders_schlecht'):
           for h in d[key]:
               tot+=1;q=norm(h['zitat']);p=h['seite']
               if not (p in np and q in np[p]):
                   bad+=1;print("MISMATCH",fp,p,h['zitat'][:70])
   print(f"checked {tot} quotes, mismatches: {bad}")
   PY
   ```
   Erst weiter, wenn `mismatches: 0`.
3. **Offizielle Belegprüfung:** `pnpm run verify` (Fuzzy-Match gegen `seiten.json`,
   ±1 Seite Toleranz) setzt `beleg_ok` je Highlight.

## Ablauf für eine neue Kombination (z. B. mv oder berlin)
1. `pnpm run cache` für das Land ausführen (oder sicherstellen, dass
   `cache/<land>/<partei>/text.txt` existiert).
2. Pro Partei: für **alle 16 Slugs** je eine Datei nach obigem Schema erzeugen
   (Persona-YAML + Programmtext lesen, `prompts/vergleich.v1.md` strikt befolgen).
3. Selbstprüfung 1–3 laufen lassen; bei Mismatch Seite/Zitat korrigieren.
4. Kurzes Fazit (Anzahl Dateien, auffällige Scores) zurückmelden.
