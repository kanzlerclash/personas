import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import {
  ladePersonas,
  ladeThemen,
  ladeWahlprogramme,
  BEVOELKERUNG_DIR,
  ERGEBNISSE_DIR,
} from "../pipeline/util.ts";

/** Aggregiert alle Daten in eine data.json, die die statische Seite konsumiert. */

function alleJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...alleJson(p));
    else if (e.endsWith(".json")) out.push(p);
  }
  return out;
}

function ladeBevoelkerung(slug: string): unknown | null {
  const p = join(BEVOELKERUNG_DIR, `${slug}.yaml`);
  return existsSync(p) ? YAML.parse(readFileSync(p, "utf8")) : null;
}

const personas = ladePersonas().map((p) => ({
  slug: p.slug,
  name: p.name,
  einzeiler: (p.roh.einzeiler as string) ?? "",
  themen: p.themen,
  profil: p.roh,
  bevoelkerung: ladeBevoelkerung(p.slug),
}));

interface Erg {
  persona: string;
  land: string;
  partei: string;
  modell: string;
  modell_slug: string;
  gesamt: { score: number; zusammenfassung: string };
  besonders_gut: { titel_selbst?: string }[];
  besonders_schlecht: { titel_selbst?: string }[];
  [k: string]: unknown;
}

// Nur wohlgeformte Auswertungen aufnehmen (robust gegen unfertige/abweichende Dateien).
const ergebnisse: Erg[] = alleJson(ERGEBNISSE_DIR)
  .map((f) => {
    try {
      return JSON.parse(readFileSync(f, "utf8"));
    } catch {
      return null;
    }
  })
  .filter(
    (d): d is Erg =>
      !!d &&
      typeof d.modell_slug === "string" &&
      Array.isArray(d.besonders_gut) &&
      Array.isArray(d.besonders_schlecht) &&
      !!d.gesamt &&
      typeof d.gesamt.score === "number"
  );

const key = (e: Erg) => `${e.persona}|${e.land}|${e.partei}`;
const ausruf = (h: { titel_selbst?: string }) => /[!?]\s*$/.test(h.titel_selbst ?? "");

// Mittelwert der Scores je (Persona×Land×Partei) über alle Modelle — Basis für Divergenz.
const gruppen = new Map<string, Erg[]>();
for (const e of ergebnisse) {
  const arr = gruppen.get(key(e)) ?? [];
  arr.push(e);
  gruppen.set(key(e), arr);
}
const mittelScore = new Map<string, number>();
for (const [k, arr] of gruppen) mittelScore.set(k, arr.reduce((s, e) => s + e.gesamt.score, 0) / arr.length);

// --- Modell-Signaturen (Bias explizit) ---
const slugs = [...new Set(ergebnisse.map((e) => e.modell_slug))];
const modelle = slugs.map((slug) => {
  const es = ergebnisse.filter((e) => e.modell_slug === slug);
  const gut = es.reduce((s, e) => s + e.besonders_gut.length, 0);
  const schlecht = es.reduce((s, e) => s + e.besonders_schlecht.length, 0);
  const alleH = es.flatMap((e) => [...e.besonders_gut, ...e.besonders_schlecht]);
  const avgScore = es.reduce((s, e) => s + e.gesamt.score, 0) / (es.length || 1);
  const kritikQuote = gut + schlecht ? schlecht / (gut + schlecht) : 0;
  const avgHighlights = (gut + schlecht) / (es.length || 1);
  const avgDivergenz =
    es.reduce((s, e) => s + Math.abs(e.gesamt.score - (mittelScore.get(key(e)) ?? e.gesamt.score)), 0) /
    (es.length || 1);
  const ausrufQuote = alleH.length ? alleH.filter(ausruf).length / alleH.length : 0;

  const haltung = avgScore > 0.5 ? "eher wohlwollend" : avgScore < -0.5 ? "eher streng" : "neutral";
  const kritik = kritikQuote > 0.5 ? "kritisch" : kritikQuote < 0.35 ? "nachsichtig" : "ausgewogen";
  const ton = ausrufQuote > 0.5 ? "zugespitzt" : ausrufQuote < 0.2 ? "sachlich" : "gemischt";

  return {
    slug,
    name: es[0]?.modell ?? slug,
    anzahl: es.length,
    avgScore: +avgScore.toFixed(2),
    kritikQuote: +kritikQuote.toFixed(2),
    avgHighlights: +avgHighlights.toFixed(1),
    avgDivergenz: +avgDivergenz.toFixed(2),
    ausrufQuote: +ausrufQuote.toFixed(2),
    labels: { haltung, kritik, ton },
  };
});

// --- Divergenz je (Persona×Land×Partei): Score-Spannweite über Modelle ---
const divergenz = [...gruppen.entries()]
  .filter(([, arr]) => arr.length >= 2)
  .map(([k, arr]) => {
    const [persona, land, partei] = k.split("|");
    const scores: Record<string, number> = {};
    for (const e of arr) scores[e.modell_slug] = e.gesamt.score;
    const vals = arr.map((e) => e.gesamt.score);
    return { persona, land, partei, scores, spanne: Math.max(...vals) - Math.min(...vals) };
  })
  .sort((a, b) => b.spanne - a.spanne);

const data = {
  erzeugt: new Date().toISOString(),
  themen: ladeThemen(),
  wahlen: ladeWahlprogramme().wahlen,
  parteien: ladeWahlprogramme().parteien,
  modelle,
  personas,
  ergebnisse,
  divergenz,
};

const ziel = join(import.meta.dirname, "data.json");
writeFileSync(ziel, JSON.stringify(data, null, 2), "utf8");
console.log(
  `data.json: ${personas.length} Personas · ${ergebnisse.length} Auswertungen · ${modelle.length} Modelle · ${divergenz.length} Divergenz-Punkte`
);
console.log("Signaturen:", modelle.map((m) => `${m.slug}(Ø${m.avgScore}, krit ${Math.round(m.kritikQuote * 100)}%)`).join("  "));
