import { z } from "zod";

/**
 * Das LLM liefert die Punkte aus dem Wahlprogramm, die der Persona BESONDERS GUT
 * oder BESONDERS SCHLECHT gefallen — jeweils mit Beleg (Seite + wörtliches
 * Kurzzitat), getrennt nach zwei Achsen:
 *   bezug:    betrifft die Persona SELBST  vs.  ihre SICHT AUF ANDERE Gruppen
 *   resonanz: BESTÄTIGT ihre Sicht        vs.  steht KONTRÄR dazu
 * Metadaten (Persona, Land, Partei, Modell, Zeitpunkt, Kosten) hängt die Pipeline an.
 */

export const BEZUG = ["betrifft_mich", "meine_sicht_auf_andere"] as const;
export const RESONANZ = ["bestaetigt", "kontaer"] as const;

export const highlightSchema = z.object({
  titel_selbst: z
    .string()
    .describe(
      "Sehr kurzer, zugespitzter O-Ton-Slogan der Persona (max. ~6 Wörter), z. B. 'Klimaschutz ist praxisfern!' — wird durch begruendung_selbst untermauert"
    ),
  thema: z.string().describe("Themen-ID aus der 16-Themen-Taxonomie (z. B. 'landwirtschaft')"),
  programmpunkt: z
    .string()
    .describe("Die konkrete Position der Partei, in eigenen Worten paraphrasiert (kein Copy-Paste)"),
  seite: z
    .number()
    .int()
    .nullable()
    .describe("Seitenzahl im Wahlprogramm laut Seiten-Markierung (===== Seite N =====); sonst null"),
  zitat: z
    .string()
    .nullable()
    .describe("Wörtliches Kurzzitat aus genau dieser Seite, UNTER 15 Wörter; sonst null"),
  bezug: z
    .enum(BEZUG)
    .describe("Betrifft der Punkt die Lage der Persona selbst, oder ihre Sicht auf andere Gruppen?"),
  resonanz: z
    .enum(RESONANZ)
    .describe("Bestätigt der Punkt die Sicht/Interessen der Persona, oder steht er konträr dazu?"),
  begruendung: z
    .string()
    .describe("Analytisch in DRITTER Person: warum gefällt/missfällt es dieser Persona — aus ihrer Lage/Haltung (1–3 Sätze)"),
  begruendung_selbst: z
    .string()
    .describe("O-Ton der Persona in ICH-Form: wie sie selbst sagen würde, warum sie es gut/schlecht findet (1–2 Sätze, ihre Sprache)"),
});

export type Highlight = z.infer<typeof highlightSchema>;

export const ergebnisLLMSchema = z.object({
  besonders_gut: z
    .array(highlightSchema)
    .describe("Punkte, die der Persona besonders gut gefallen (mit Beleg). Leer, wenn es keine gibt."),
  besonders_schlecht: z
    .array(highlightSchema)
    .describe("Punkte, die der Persona besonders schlecht gefallen (mit Beleg). Leer, wenn es keine gibt."),
  gesamt: z.object({
    zusammenfassung: z.string().describe("Wie steht die Persona insgesamt zu diesem Programm? (2–4 Sätze)"),
    score: z
      .number()
      .int()
      .min(-2)
      .max(2)
      .describe("-2 = lehnt das Programm aus ihrer Lage klar ab ... +2 = findet es klar gut"),
  }),
});

export type ErgebnisLLM = z.infer<typeof ergebnisLLMSchema>;

/** Pro Highlight gesetzt vom Beleg-Prüfer (verify-belege.ts): Zitat auf der Seite gefunden? */
export interface BelegPruefung {
  beleg_ok: boolean | null; // null = nicht prüfbar (kein Zitat/keine Seite)
  beleg_hinweis?: string;
}

/** Vollständiger, auf Platte geschriebener Ergebnis-Datensatz (CC-BY-SA). */
export interface ErgebnisDatensatz extends ErgebnisLLM {
  persona: string;
  land: string;
  partei: string;
  modell: string;
  modell_slug: string;
  zeitpunkt: string;
  temperatur: number;
  lauf: number;
  programm_stand: string | null;
  prompt_version: string;
  metrik: {
    input_tokens: number | null;
    output_tokens: number | null;
    cached_tokens: number | null;
    total_tokens: number | null;
    dauer_ms: number | null;
    usd: number | null;
  };
}

/** Bevölkerungsanteil-Recherche (LLM schlägt Quellen vor; Mensch verifiziert). */
export const bevoelkerungSchema = z.object({
  anteil: z.string().describe("Grober Anteil, z. B. 'ca. 1,2 % der Erwerbstätigen'"),
  bezug: z.string().describe("Worauf sich der Anteil bezieht (Grundgesamtheit, Region)"),
  quellen: z
    .array(
      z.object({
        titel: z.string(),
        herausgeber: z.string(),
        jahr: z.number().int().nullable(),
        wert: z.string().describe("Die konkrete Zahl/Angabe aus der Quelle"),
        url: z.string(),
      })
    )
    .describe("Zitierbare amtliche Quellen (Destatis, Zensus 2022, Statistische Landesämter)"),
  unsicherheit: z.string().describe("Was unsicher ist / wie grob die Schätzung ist"),
});

export type BevoelkerungLLM = z.infer<typeof bevoelkerungSchema>;
