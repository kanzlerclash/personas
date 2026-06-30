import { existsSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import YAML from "yaml";

/** Repo-Wurzel: die Pipeline wird aus dem Repo-Root via pnpm-Skripten gestartet. */
export const ROOT = process.cwd();
export const PERSONAS_DIR = join(ROOT, "personas");
export const BEVOELKERUNG_DIR = join(ROOT, "bevoelkerung");
export const CACHE_DIR = join(ROOT, "cache");
export const ERGEBNISSE_DIR = join(ROOT, "ergebnisse");
export const PROMPTS_DIR = join(ROOT, "prompts");

/** Lädt .env (Node >= 20.12) — best effort, ohne harten Fehler. */
export function ladeEnv(): void {
  try {
    if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));
  } catch {
    /* .env optional */
  }
}

export interface Persona {
  slug: string;
  name: string;
  themen: string[];
  gesicht?: { seed?: string; config?: Record<string, string> };
  /** Komplettes Profil als YAML-Text — wird unverändert in den Prompt eingebettet. */
  profil: string;
  /** Geparstes Roh-Objekt (für Seite/Tooling). */
  roh: Record<string, unknown>;
}

export interface Thema {
  id: string;
  name: string;
  beschreibung: string;
}

export interface ProgrammQuelle {
  partei: string;
  landtag: string;
  url: string | null;
  stand: string | null;
  /** "pdf" (Default) oder "html". Bei HTML gibt es keine echten Seiten → Abschnitts-Index. */
  format?: "pdf" | "html";
}

export interface Wahlprogramme {
  wahlen: { landtag: string; datum: string }[];
  parteien: string[];
  programme: ProgrammQuelle[];
}

export interface Modell {
  slug: string;
  id: string;
  temperatur: number;
}

const slugAusDatei = (datei: string) => basename(datei, ".yaml");

export function ladePersonas(): Persona[] {
  return readdirSync(PERSONAS_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => {
      const profil = readFileSync(join(PERSONAS_DIR, f), "utf8");
      const roh = (YAML.parse(profil) ?? {}) as Record<string, unknown>;
      return {
        slug: slugAusDatei(f),
        name: String(roh.name ?? ""),
        themen: Array.isArray(roh.themen) ? (roh.themen as unknown[]).map(String) : [],
        gesicht: roh.gesicht as Persona["gesicht"],
        profil: profil.trim(),
        roh,
      };
    });
}

export function ladePersona(slug: string): Persona {
  const p = ladePersonas().find((x) => x.slug === slug);
  if (!p) throw new Error(`Persona nicht gefunden: ${slug}`);
  return p;
}

export function ladeThemen(): Thema[] {
  return JSON.parse(readFileSync(join(ROOT, "daten", "themen.json"), "utf8"));
}

export function ladeWahlprogramme(): Wahlprogramme {
  return JSON.parse(readFileSync(join(ROOT, "daten", "wahlprogramme.json"), "utf8"));
}

export function ladeModelle(): Modell[] {
  return JSON.parse(readFileSync(join(ROOT, "daten", "modelle.json"), "utf8"));
}

/** Pfad des Cache-Verzeichnisses für ein Programm (gitignored). */
export function cachePfad(landtag: string, partei: string): string {
  return join(CACHE_DIR, landtag, partei);
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/** Minimaler CLI-Flag-Parser: --persona landwirt --land sachsen-anhalt --partei cdu */
export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a?.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith("--")) {
        out[key] = val;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}
