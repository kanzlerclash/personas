#!/usr/bin/env bash
# Vervollständigt die Gemini-3.1-Pro-Spalte via agy: Fill (idempotent) → fix-agy → verify → build → commit → push.
set -u
cd /Users/jan/workspaces/personas || exit 1
echo "[gemini-finalize $(date '+%H:%M')] Start"

bash scripts/agy-fill.sh

echo "[gemini-finalize] fix-agy + verify + build"
for P in cdu spd gruene afd fdp linke bsw; do node scripts/fix-agy.mjs "$P" sachsen-anhalt gemini-3.1-pro; done
pnpm run verify --fix || true
pnpm run build || true

N=$(node -e 'const fs=require("fs");const S="landwirt handwerkerin pendler rentnerpaar polizist studentin_queer alleinerziehende pflegekraft eingebuergerte mieterin_berlin industriearbeiter energie_strukturwandel junge_familie_bau solo_kreative landaerztin soldat".split(" ");const P="cdu spd gruene afd fdp linke bsw".split(" ");let n=0;for(const pa of P)for(const sl of S){try{const d=JSON.parse(fs.readFileSync(`ergebnisse/${sl}/sachsen-anhalt/${pa}/gemini-3.1-pro__2026-06-30__lauf1.json`));if(Array.isArray(d.besonders_gut)&&d.gesamt&&d.modell_slug)n++;}catch(e){}}console.log(n);')
echo "[gemini-finalize] Gemini valide: $N/112"

git add -A
git commit -q -m "Gemini-Spalte vervollständigt (${N}/112) via agy-Fill

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" && git push origin main 2>&1 | tail -2 || echo "[gemini-finalize] nichts zu committen"
echo "[gemini-finalize $(date '+%H:%M')] Fertig"
