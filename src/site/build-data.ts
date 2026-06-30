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

const ergebnisse = alleJson(ERGEBNISSE_DIR).map((f) => JSON.parse(readFileSync(f, "utf8")));

const data = {
  erzeugt: new Date().toISOString(),
  themen: ladeThemen(),
  wahlen: ladeWahlprogramme().wahlen,
  parteien: ladeWahlprogramme().parteien,
  personas,
  ergebnisse,
};

const ziel = join(import.meta.dirname, "data.json");
writeFileSync(ziel, JSON.stringify(data, null, 2), "utf8");
console.log(
  `data.json: ${personas.length} Personas, ${ergebnisse.length} Auswertungen → ${ziel}`
);
