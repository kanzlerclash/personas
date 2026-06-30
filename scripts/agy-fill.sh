#!/usr/bin/env bash
# Selbstheilend & sequenziell: erzeugt mit agy nur die FEHLENDEN oder KAPUTTEN
# (Partei × Persona)-Auswertungen. Idempotent — vorhandene valide Dateien bleiben.
# Aufruf: bash scripts/agy-fill.sh
set -u
cd /Users/jan/workspaces/personas || exit 1

LAND="sachsen-anhalt"
MODELL="Gemini 3.1 Pro (High)"
MODELL_SLUG="gemini-3.1-pro"
AGY="/Users/jan/.local/bin/agy"
TPL="prompts/agy-vorlage.md"

PARTEIEN=(cdu spd gruene afd fdp linke bsw)
SLUGS=(landwirt handwerkerin pendler rentnerpaar polizist studentin_queer \
       alleinerziehende pflegekraft eingebuergerte mieterin_berlin industriearbeiter \
       energie_strukturwandel junge_familie_bau solo_kreative landaerztin soldat)

valide() {  # 0 = vorhanden & wohlgeformt
  node -e 'const fs=require("fs");try{const d=JSON.parse(fs.readFileSync(process.argv[1]));process.exit(Array.isArray(d.besonders_gut)&&Array.isArray(d.besonders_schlecht)&&d.gesamt?0:1)}catch(e){process.exit(1)}' "$1"
}

erzeugt=0
for PARTEI in "${PARTEIEN[@]}"; do
  for P in "${SLUGS[@]}"; do
    F="ergebnisse/$P/$LAND/$PARTEI/${MODELL_SLUG}__2026-06-30__lauf1.json"
    if valide "$F"; then continue; fi
    PROMPT=$(sed -e "s|__LAND__|$LAND|g" -e "s|__PARTEI__|$PARTEI|g" -e "s|__PERSONA__|$P|g" \
                 -e "s|__MODELL_SLUG__|$MODELL_SLUG|g" -e "s|__MODELL__|$MODELL|g" "$TPL")
    echo ">>> $(date +%H:%M:%S)  $P x $PARTEI"
    timeout 420 "$AGY" --dangerously-skip-permissions --model "$MODELL" --print-timeout 6m -p "$PROMPT" 2>&1 | tail -1
    [ "${PIPESTATUS[0]}" -eq 124 ] && echo "    (timeout — übersprungen, Re-Run holt es)"
    erzeugt=$((erzeugt+1))
    sleep 2
  done
done
echo "=== FILL FERTIG: $erzeugt Dateien erzeugt um $(date +%H:%M:%S) ==="
