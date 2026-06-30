#!/usr/bin/env bash
# Erzeugt mit agy (Gemini) für EINE Partei alle 16 Persona-Auswertungen — ein Lauf je Persona.
# Aufruf: bash scripts/agy-lauf.sh <partei>   (z. B. cdu)
set -u
cd /Users/jan/workspaces/personas || exit 1

LAND="sachsen-anhalt"
PARTEI="${1:?Partei als Argument, z. B. cdu}"
MODELL="Gemini 3.1 Pro (High)"
MODELL_SLUG="gemini-3.1-pro"
AGY="/Users/jan/.local/bin/agy"
TPL="prompts/agy-vorlage.md"

SLUGS=(landwirt handwerkerin pendler rentnerpaar polizist studentin_queer \
       alleinerziehende pflegekraft eingebuergerte mieterin_berlin industriearbeiter \
       energie_strukturwandel junge_familie_bau solo_kreative landaerztin soldat)

for P in "${SLUGS[@]}"; do
  PROMPT=$(sed -e "s|__LAND__|$LAND|g" -e "s|__PARTEI__|$PARTEI|g" -e "s|__PERSONA__|$P|g" \
               -e "s|__MODELL_SLUG__|$MODELL_SLUG|g" -e "s|__MODELL__|$MODELL|g" "$TPL")
  echo ">>> $(date +%H:%M:%S)  $P x $PARTEI"
  "$AGY" --dangerously-skip-permissions --model "$MODELL" --print-timeout 10m -p "$PROMPT" 2>&1 | tail -2
done
echo "=== FERTIG $PARTEI um $(date +%H:%M:%S) ==="
