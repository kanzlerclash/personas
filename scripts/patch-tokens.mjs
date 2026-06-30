// Schreibt die von einer CLI gemeldete Gesamt-Tokenzahl in metrik.total_tokens.
// CLIs (Codex/agy) liefern nur eine Summe, keinen Input/Output-Split.
// Aufruf: node scripts/patch-tokens.mjs <datei> <tokenzahl>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const [, , file, tok] = process.argv;
if (!file || !existsSync(file)) process.exit(0);
const n = Number(String(tok ?? "").replace(/\D/g, "")) || null;
if (n == null) process.exit(0);
try {
  const d = JSON.parse(readFileSync(file, "utf8"));
  d.metrik = d.metrik ?? { input_tokens: null, output_tokens: null, cached_tokens: null, total_tokens: null, dauer_ms: null, usd: null };
  d.metrik.total_tokens = n;
  d.metrik.hinweis = "Gesamt-Tokens laut CLI (kein Input/Output-Split)";
  writeFileSync(file, JSON.stringify(d, null, 2), "utf8");
  console.log(`tokens=${n}`);
} catch { /* defekte Datei ignorieren */ }
