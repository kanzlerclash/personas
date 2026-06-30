#!/usr/bin/env bash
# Vervollständigt die GPT-5.5-Spalte, sobald das Codex-Kontingent wieder da ist.
# Health-Check → Codex-Fill (idempotent) → fix-agy → verify → build → commit → push.
set -u
cd /Users/jan/workspaces/personas || exit 1
echo "[finalize $(date '+%H:%M')] Start"

OK=$(timeout 90 /Users/jan/.volta/bin/codex exec -c model_reasoning_effort=low "Antworte nur mit OK" 2>&1 | tr -d '\r' | grep -ci "OK")
if [ "${OK:-0}" -lt 1 ]; then echo "[finalize] Codex antwortet nicht / weiterhin Limit — Abbruch, später erneut versuchen."; exit 3; fi
echo "[finalize] Codex ok → Fill"

bash scripts/codex-fill.sh

echo "[finalize] fix-agy + verify + build"
for P in cdu spd gruene afd fdp linke bsw; do node scripts/fix-agy.mjs "$P" sachsen-anhalt gpt-5.5; done
pnpm run verify --fix || true
pnpm run build || true

N=$(node -e 'const fs=require("fs");const S="landwirt handwerkerin pendler rentnerpaar polizist studentin_queer alleinerziehende pflegekraft eingebuergerte mieterin_berlin industriearbeiter energie_strukturwandel junge_familie_bau solo_kreative landaerztin soldat".split(" ");const P="cdu spd gruene afd fdp linke bsw".split(" ");let n=0;for(const pa of P)for(const sl of S){try{const d=JSON.parse(fs.readFileSync(`ergebnisse/${sl}/sachsen-anhalt/${pa}/gpt-5.5__2026-06-30__lauf1.json`));if(Array.isArray(d.besonders_gut)&&d.gesamt&&d.modell_slug)n++;}catch(e){}}console.log(n);')
echo "[finalize] GPT-5.5 valide: $N/112"

git add -A
git commit -q -m "GPT-5.5-Spalte vervollständigt (${N}/112) via Codex-Fill (geplanter Lauf)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" && git push origin main 2>&1 | tail -2 || echo "[finalize] nichts zu committen"
echo "[finalize $(date '+%H:%M')] Fertig"
