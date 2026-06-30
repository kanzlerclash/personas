import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import {
  ladeEnv,
  ladePersonas,
  ladeModelle,
  ensureDir,
  parseArgs,
  BEVOELKERUNG_DIR,
  type Persona,
} from "./util.ts";
import { bevoelkerungSchema } from "./schema.ts";
import { erzeugeObjekt } from "./gateway.ts";

ladeEnv();

const SYSTEM = [
  "Du recherchierst, welcher Anteil der Bevölkerung in einer Lebenslage wie der beschriebenen Persona steckt.",
  "Stütze dich ausschließlich auf amtliche, zitierbare Quellen: Statistisches Bundesamt (Destatis), Zensus 2022, Statistische Landesämter (Sachsen-Anhalt, Mecklenburg-Vorpommern, Berlin).",
  "Gib einen GROBEN Anteil und benenne die Grundgesamtheit/Region klar.",
  "Erfinde keine Zahlen und keine URLs. Bist du unsicher, sag es im Feld 'unsicherheit' deutlich.",
  "WICHTIG: Dein Output ist ein ENTWURF, der von einem Menschen gegen die Primärquelle geprüft wird.",
].join(" ");

async function eineRecherche(p: Persona, modellId: string, force: boolean): Promise<void> {
  const datei = join(BEVOELKERUNG_DIR, `${p.slug}.yaml`);
  if (existsSync(datei) && !force) {
    console.log(`⏭  ${p.slug}: existiert bereits (--force zum Überschreiben)`);
    return;
  }
  try {
    const { objekt } = await erzeugeObjekt({
      modellId,
      schema: bevoelkerungSchema,
      system: SYSTEM,
      prompt: `Profil der Persona (YAML):\n${p.profil}`,
      temperatur: 0,
    });

    ensureDir(BEVOELKERUNG_DIR);
    const inhalt =
      `# ENTWURF — vom LLM (${modellId}) vorgeschlagen, NICHT verifiziert.\n` +
      `# Vor Nutzung jede Zahl gegen die genannte Primärquelle prüfen, dann verifiziert: true setzen.\n` +
      YAML.stringify({ verifiziert: false, ...objekt });
    writeFileSync(datei, inhalt, "utf8");
    console.log(`✓  ${p.slug}: Entwurf mit ${objekt.quellen.length} Quelle(n) → ${datei}`);
  } catch (e) {
    console.error(`✗  ${p.slug}: ${(e as Error).message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const force = args.force === "true";
  const modellId = ladeModelle().find((m) => !args.modell || m.slug === args.modell)?.id;
  if (!modellId) throw new Error("Kein Modell gefunden.");

  const personas = ladePersonas().filter((p) => !args.persona || p.slug === args.persona);
  for (const p of personas) await eineRecherche(p, modellId, force);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
