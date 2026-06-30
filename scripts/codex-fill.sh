#!/usr/bin/env bash
# Selbstheilend & sequenziell: erzeugt mit Codex (GPT-5.5) nur die FEHLENDEN/KAPUTTEN
# (Partei × Persona)-Auswertungen. Idempotent — valide Dateien bleiben.
# Aufruf: bash scripts/codex-fill.sh
set -u
cd /Users/jan/workspaces/personas || exit 1

LAND="sachsen-anhalt"
MODELL_SLUG="gpt-5.5"
CX="/Users/jan/.volta/bin/codex"
TPL="prompts/agy-vorlage.md"

PARTEIEN=(cdu spd gruene afd fdp linke bsw)
SLUGS=(landwirt handwerkerin pendler rentnerpaar polizist studentin_queer \
       alleinerziehende pflegekraft eingebuergerte mieterin_berlin industriearbeiter \
       energie_strukturwandel junge_familie_bau solo_kreative landaerztin soldat)

valide() {  # 0 = vorhanden, wohlgeformt, mit Metadaten
  node -e 'const fs=require("fs");try{const d=JSON.parse(fs.readFileSync(process.argv[1]));process.exit(Array.isArray(d.besonders_gut)&&Array.isArray(d.besonders_schlecht)&&d.gesamt&&d.modell_slug?0:1)}catch(e){process.exit(1)}' "$1"
}

erzeugt=0
for PARTEI in "${PARTEIEN[@]}"; do
  for P in "${SLUGS[@]}"; do
    F="ergebnisse/$P/$LAND/$PARTEI/${MODELL_SLUG}__2026-06-30__lauf1.json"
    if valide "$F"; then continue; fi
    PROMPT=$(sed -e "s|__LAND__|$LAND|g" -e "s|__PARTEI__|$PARTEI|g" -e "s|__PERSONA__|$P|g" \
                 -e "s|__MODELL_SLUG__|$MODELL_SLUG|g" -e "s|__MODELL__|gpt-5.5|g" "$TPL" \
             | sed "s|agy (gpt-5.5, ohne Gateway)|codex/gpt-5.5 (medium, ChatGPT-Login)|")
    echo ">>> $(date +%H:%M:%S)  $P x $PARTEI"
    OUT=$(timeout 600 "$CX" exec --dangerously-bypass-approvals-and-sandbox \
      -c model_reasoning_effort=medium -m gpt-5.5 "$PROMPT" 2>&1)
    [ $? -eq 124 ] && echo "    (timeout — Re-Run holt es)"
    # Codex druckt "tokens used\n<zahl>" → Gesamt-Tokens in metrik schreiben.
    TOK=$(printf '%s\n' "$OUT" | grep -iA1 "tokens used" | tail -1 | tr -dc '0-9')
    [ -n "$TOK" ] && [ -f "$F" ] && node scripts/patch-tokens.mjs "$F" "$TOK" >/dev/null 2>&1 && echo "    tokens=$TOK"
    erzeugt=$((erzeugt+1))
    sleep 1
  done
done
echo "=== CODEX-FILL FERTIG: $erzeugt Läufe um $(date +%H:%M:%S) ==="
