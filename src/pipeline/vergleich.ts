import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ladeEnv,
  ladePersonas,
  ladeThemen,
  ladeWahlprogramme,
  ladeModelle,
  cachePfad,
  ensureDir,
  parseArgs,
  ERGEBNISSE_DIR,
  PROMPTS_DIR,
  type Persona,
  type Modell,
  type ProgrammQuelle,
} from "./util.ts";
import { ergebnisLLMSchema, type ErgebnisDatensatz } from "./schema.ts";
import { erzeugeObjekt } from "./gateway.ts";

ladeEnv();

const PROMPT_VERSION = "vergleich.v1";

function systemPrompt(): string {
  // Kommentar-Block (<!-- ... -->) am Anfang entfernen, Rest ist der System-Prompt.
  const basis = readFileSync(join(PROMPTS_DIR, `${PROMPT_VERSION}.md`), "utf8")
    .replace(/^<!--[\s\S]*?-->\s*/, "")
    .trim();
  // Manche Provider (z. B. Alibaba/Qwen) füllen nur zuverlässig, wenn das EXAKTE JSON-Beispiel
  // im Prompt steht (Schema allein reicht nicht) — außerdem verlangt Qwen das Wort „json".
  // Für alle Modelle unschädlich.
  const jsonBeispiel = `Antworte AUSSCHLIESSLICH als ein einziges valides JSON-Objekt in exakt dieser Struktur (keine weiteren Felder, kein Markdown, kein Codeblock):
{
  "besonders_gut": [
    {
      "titel_selbst": "<kurzer O-Ton-Slogan der Persona, max ~6 Wörter>",
      "thema": "<themen-id aus der Taxonomie>",
      "programmpunkt": "<Parteiposition in eigenen Worten paraphrasiert>",
      "seite": 12,
      "zitat": "<WÖRTLICHES Kurzzitat von genau dieser Seite, unter 15 Wörter>",
      "bezug": "betrifft_mich",
      "resonanz": "bestaetigt",
      "begruendung": "<analytisch, dritte Person, 1-3 Sätze>",
      "begruendung_selbst": "<O-Ton der Persona in Ich-Form, untermauert titel_selbst>"
    }
  ],
  "besonders_schlecht": [ { "titel_selbst": "…", "thema": "…", "programmpunkt": "…", "seite": 5, "zitat": "…", "bezug": "meine_sicht_auf_andere", "resonanz": "kontaer", "begruendung": "…", "begruendung_selbst": "…" } ],
  "gesamt": { "zusammenfassung": "<2-4 Sätze, dritte Person>", "score": -1 }
}
Regeln: "bezug" ∈ {"betrifft_mich","meine_sicht_auf_andere"}. "resonanz" ∈ {"bestaetigt","kontaer"}. "seite" ist eine ganze Zahl (oder null), "zitat" ein String (oder null), "score" eine ganze Zahl von -2 bis 2. "besonders_gut" und "besonders_schlecht" sind Arrays und dürfen leer sein ([]).`;
  return `${basis}\n\n${jsonBeispiel}`;
}

/**
 * Stabiler Block: über ALLE Personas identisch (Themen + Wahlprogramm) → cachebarer Präfix.
 * Hängt NICHT von der Persona ab, damit der Prompt-Cache der Provider greift.
 */
function stabilerBlock(q: ProgrammQuelle, programmText: string): string {
  const themen = ladeThemen()
    .map((t) => `- ${t.id}: ${t.name} — ${t.beschreibung}`)
    .join("\n");
  return [
    `## Themen-Taxonomie (gültige IDs für das Feld "thema")`,
    themen,
    ``,
    `## Wahlprogramm`,
    `Partei: ${q.partei.toUpperCase()} · Landtagswahl: ${q.landtag} · Stand: ${q.stand ?? "unbekannt"}`,
    ``,
    `--- BEGINN PROGRAMMTEXT ---`,
    programmText,
    `--- ENDE PROGRAMMTEXT ---`,
    ``,
    `## Gründlichkeit`,
    `Gehe die Themen-Stakes und die Haltung der Persona SYSTEMATISCH durch und durchsuche das`,
    `Programm nach ALLEN Stellen, die ihre Lage berühren — direkt (betrifft_mich) wie auch ihre`,
    `Sicht auf andere Gruppen (meine_sicht_auf_andere). Ziel: typischerweise 3–8 Einträge JE Liste`,
    `(besonders_gut UND besonders_schlecht), wenn das Programm die Lage an so vielen Stellen`,
    `berührt — sei nicht knapp. ABER: nichts erfinden; nur belegbare, wirklich berührende Punkte.`,
    `Eine leere Liste ist erlaubt, wenn es ehrlich keine passenden Stellen gibt.`,
  ].join("\n");
}

/** Variabler Teil: kommt GANZ ANS ENDE, damit der stabile Präfix davor gecacht werden kann. */
function variablerBlock(p: Persona): string {
  return [
    ``,
    `## Persona-Profil (Slug: ${p.slug})`,
    `Versetze dich in diese Persona und bewerte das obige Wahlprogramm aus ihrer Sicht.`,
    ``,
    p.profil,
  ].join("\n");
}

interface CacheTreffer {
  text: string;
  stand: string | null;
}

function ladeCacheText(q: ProgrammQuelle): CacheTreffer | null {
  const dir = cachePfad(q.landtag, q.partei);
  const textPfad = join(dir, "text.txt");
  if (!existsSync(textPfad)) return null;
  let stand = q.stand;
  const metaPfad = join(dir, "meta.json");
  if (existsSync(metaPfad)) {
    try {
      stand = JSON.parse(readFileSync(metaPfad, "utf8")).stand ?? q.stand;
    } catch {
      /* ignore */
    }
  }
  return { text: readFileSync(textPfad, "utf8"), stand };
}

async function einVergleich(
  p: Persona,
  q: ProgrammQuelle,
  cache: CacheTreffer,
  m: Modell,
  lauf: number
): Promise<void> {
  const datum = new Date().toISOString().slice(0, 10);
  const dir = join(ERGEBNISSE_DIR, p.slug, q.landtag, q.partei);
  const datei = join(dir, `${m.slug}__${datum}__lauf${lauf}.json`);
  const label = `${p.slug} × ${q.landtag}/${q.partei} × ${m.slug} (Lauf ${lauf})`;

  try {
    const { objekt, metrik } = await erzeugeObjekt({
      modellId: m.id,
      schema: ergebnisLLMSchema,
      system: systemPrompt(),
      stabil: stabilerBlock(q, cache.text),
      variabel: variablerBlock(p),
      temperatur: m.temperatur,
    });

    const datensatz: ErgebnisDatensatz = {
      persona: p.slug,
      land: q.landtag,
      partei: q.partei,
      modell: m.id,
      modell_slug: m.slug,
      zeitpunkt: new Date().toISOString(),
      temperatur: m.temperatur,
      lauf,
      programm_stand: cache.stand,
      prompt_version: PROMPT_VERSION,
      erzeugt_via: `ai-gateway (${m.id})`,
      metrik,
      ...objekt,
    };

    ensureDir(dir);
    writeFileSync(datei, JSON.stringify(datensatz, null, 2), "utf8");
    const usd = metrik.usd != null ? `$${metrik.usd.toFixed(4)}` : "$?";
    const sek = metrik.dauer_ms != null ? `${(metrik.dauer_ms / 1000).toFixed(1)}s` : "?s";
    console.log(
      `✓  ${label}: +${objekt.besonders_gut.length} / -${objekt.besonders_schlecht.length}, Score ${objekt.gesamt.score}, ${metrik.input_tokens ?? "?"}→${metrik.output_tokens ?? "?"} Tok (${metrik.cached_tokens ?? 0} cached), ${sek}, ${usd}`
    );
  } catch (e) {
    console.error(`✗  ${label}: ${(e as Error).message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const laeufe = Math.max(1, Number(process.env.LAEUFE ?? args.laeufe ?? 1));

  const personas = ladePersonas().filter((p) => !args.persona || p.slug === args.persona);
  const { programme } = ladeWahlprogramme();
  const modelle = ladeModelle().filter((m) => !args.modell || m.slug === args.modell);

  const quellen = programme.filter(
    (q) =>
      q.url &&
      (!args.land || q.landtag === args.land) &&
      (!args.partei || q.partei === args.partei)
  );

  let geplant = 0;
  // Reihenfolge Programm → Modell → Persona: Für ein festes (Programm, Modell) laufen alle
  // Personas direkt hintereinander. So bleibt der stabile Präfix (Themen + Programmtext, VOR
  // der Persona) über aufeinanderfolgende Calls identisch → Prompt-Cache der Provider greift.
  for (const q of quellen) {
    const cache = ladeCacheText(q);
    if (!cache) {
      console.log(`⏭  ${q.landtag}/${q.partei}: kein Cache-Text (erst 'pnpm run cache')`);
      continue;
    }
    for (const m of modelle) {
      for (const p of personas) {
        for (let lauf = 1; lauf <= laeufe; lauf++) {
          geplant++;
          await einVergleich(p, q, cache, m, lauf);
        }
      }
    }
  }
  console.log(`\nFertig: ${geplant} Vergleich(e) verarbeitet.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
