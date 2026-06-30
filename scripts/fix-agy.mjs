// Korrigiert die agy/gemini-Ergebnisse EINER Partei: Score auf [-2,2] clampen,
// Seitenzahl auf die Seite korrigieren, auf der das Zitat wörtlich steht.
// Aufruf: node scripts/fix-agy.mjs <partei> [land] [modell_slug]
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PARTEI = process.argv[2];
const LAND = process.argv[3] ?? "sachsen-anhalt";
const SLUG = process.argv[4] ?? "gemini-3.1-pro";
if (!PARTEI) { console.error("Partei fehlt"); process.exit(1); }

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9äöüß]/gi, "");
const seiten = JSON.parse(readFileSync(`cache/${LAND}/${PARTEI}/seiten.json`, "utf8")).seiten;
const txt = (n) => norm(seiten.find((s) => s.seite === n)?.text ?? "");

const MODELL_NAME = { "gemini-3.1-pro": "Gemini 3.1 Pro (High)", "gpt-5.5": "gpt-5.5" }[SLUG] ?? SLUG;
const ERZEUGT = SLUG === "gpt-5.5" ? "codex/gpt-5.5 (ChatGPT-Login, ohne Gateway)" : `agy (${SLUG}, ohne Gateway)`;

let dateien = 0, scoreFix = 0, seiteFix = 0, rest = 0, metaFix = 0;
for (const slug of readdirSync("ergebnisse")) {
  const f = join("ergebnisse", slug, LAND, PARTEI, `${SLUG}__2026-06-30__lauf1.json`);
  if (!existsSync(f)) continue;
  dateien++;
  const d = JSON.parse(readFileSync(f, "utf8"));

  // Fehlende Metadaten aus Pfad/Parametern nachtragen (frühe CLI-Läufe ließen Felder aus).
  let m = false;
  const setze = (k, v) => { if (d[k] == null) { d[k] = v; m = true; } };
  setze("persona", slug); setze("land", LAND); setze("partei", PARTEI);
  setze("modell_slug", SLUG); setze("modell", MODELL_NAME);
  setze("zeitpunkt", "2026-06-30T00:00:00Z"); setze("temperatur", 0); setze("lauf", 1);
  setze("programm_stand", null); setze("prompt_version", "vergleich.v1"); setze("erzeugt_via", ERZEUGT);
  setze("metrik", { input_tokens: null, output_tokens: null, cached_tokens: null, total_tokens: null, dauer_ms: null, usd: null });
  if (m) metaFix++;

  if (typeof d.gesamt?.score === "number" && (d.gesamt.score < -2 || d.gesamt.score > 2)) {
    d.gesamt.score = Math.max(-2, Math.min(2, d.gesamt.score > 2 ? 2 : -2 > d.gesamt.score ? -2 : d.gesamt.score));
    scoreFix++;
  }
  for (const liste of [d.besonders_gut ?? [], d.besonders_schlecht ?? []]) {
    for (const h of liste) {
      if (h.zitat == null || h.seite == null) continue;
      const n = norm(h.zitat);
      if (n.length < 8 || txt(h.seite).includes(n)) continue;
      let ziel = null;
      for (const dd of [-1, 1]) if (txt(h.seite + dd).includes(n)) ziel = h.seite + dd;
      if (ziel == null) { const any = seiten.find((s) => norm(s.text).includes(n)); ziel = any?.seite ?? null; }
      if (ziel != null) { h.seite = ziel; seiteFix++; } else rest++;
    }
  }
  writeFileSync(f, JSON.stringify(d, null, 2), "utf8");
}
console.log(`${PARTEI}: ${dateien} Dateien · ${metaFix} Metadaten ergänzt · ${scoreFix} Score · ${seiteFix} Seiten · ${rest} Zitate ungeprüft`);
