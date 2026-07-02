import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ladeEnv, cachePfad, ERGEBNISSE_DIR, parseArgs } from "./util.ts";
import type { ErgebnisDatensatz, Highlight, BelegPruefung } from "./schema.ts";

ladeEnv();

/** Normalisiert Text auf nackte Alphanumerik (robust gegen PDF-Spacing/Zeichen). */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/gi, "");

interface Seiten {
  seiten: { seite: number; text: string }[];
}

const seitenCache = new Map<string, Seiten | null>();

function ladeSeiten(land: string, partei: string): Seiten | null {
  const key = `${land}/${partei}`;
  if (seitenCache.has(key)) return seitenCache.get(key)!;
  const pfad = join(cachePfad(land, partei), "seiten.json");
  const val = existsSync(pfad) ? (JSON.parse(readFileSync(pfad, "utf8")) as Seiten) : null;
  seitenCache.set(key, val);
  return val;
}

function pruefeHighlight(h: Highlight, seiten: Seiten | null): BelegPruefung & { gefunden_auf?: number } {
  if (!h.zitat || h.seite == null) return { beleg_ok: null, beleg_hinweis: "kein Zitat/keine Seite" };
  if (!seiten) return { beleg_ok: null, beleg_hinweis: "kein seiten.json im Cache" };
  const nadel = norm(h.zitat);
  if (nadel.length < 8) return { beleg_ok: null, beleg_hinweis: "Zitat zu kurz für Prüfung" };

  const seiteText = (n: number) => norm(seiten.seiten.find((s) => s.seite === n)?.text ?? "");
  if (seiteText(h.seite).includes(nadel)) return { beleg_ok: true };
  // Toleranz: ±1 Seite (Seitenzählung PDF vs. Layout weicht oft um 1 ab).
  for (const d of [-1, 1]) {
    if (seiteText(h.seite + d).includes(nadel))
      return { beleg_ok: false, beleg_hinweis: `Zitat nur auf Seite ${h.seite + d} gefunden`, gefunden_auf: h.seite + d };
  }
  // Irgendwo im Dokument?
  const irgendwo = seiten.seiten.find((s) => norm(s.text).includes(nadel));
  return {
    beleg_ok: false,
    beleg_hinweis: irgendwo
      ? `Zitat auf Seite ${irgendwo.seite} statt ${h.seite}`
      : "Zitat im Dokument nicht gefunden",
    ...(irgendwo ? { gefunden_auf: irgendwo.seite } : {}),
  };
}

function alleErgebnisDateien(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...alleErgebnisDateien(p));
    else if (e.endsWith(".json")) out.push(p);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const fix = args.fix === "true";
  const dateien = alleErgebnisDateien(ERGEBNISSE_DIR);
  if (!dateien.length) {
    console.log("Keine Ergebnis-Dateien gefunden (erst 'pnpm run vergleich').");
    return;
  }
  let ok = 0,
    fehler = 0,
    unpruefbar = 0,
    korrigiert = 0;

  for (const datei of dateien) {
    const d = JSON.parse(readFileSync(datei, "utf8")) as ErgebnisDatensatz & {
      besonders_gut: (Highlight & BelegPruefung)[];
      besonders_schlecht: (Highlight & BelegPruefung)[];
    };
    if (args.land && d.land !== args.land) continue;
    if (args.partei && d.partei !== args.partei) continue;
    const seiten = ladeSeiten(d.land, d.partei);

    const lokal: string[] = [];
    for (const liste of [d.besonders_gut, d.besonders_schlecht]) {
      for (const h of liste) {
        let r = pruefeHighlight(h, seiten);
        // --fix: Seitenzahl korrigieren, wenn das Zitat wörtlich auf einer anderen Seite steht.
        if (fix && r.beleg_ok === false && r.gefunden_auf != null) {
          const alt = h.seite;
          h.seite = r.gefunden_auf;
          h.beleg_hinweis = `Seite von ${alt} auf ${r.gefunden_auf} korrigiert`;
          h.beleg_ok = true;
          korrigiert++;
          r = { beleg_ok: true };
        } else {
          h.beleg_ok = r.beleg_ok;
          if (r.beleg_hinweis) h.beleg_hinweis = r.beleg_hinweis;
          else delete h.beleg_hinweis;
        }
        if (r.beleg_ok === true) ok++;
        else if (r.beleg_ok === false) {
          fehler++;
          lokal.push(`    ✗ S.${h.seite} "${(h.zitat ?? "").slice(0, 50)}…" — ${r.beleg_hinweis}`);
        } else unpruefbar++;
      }
    }
    writeFileSync(datei, JSON.stringify(d, null, 2), "utf8");
    if (lokal.length) {
      console.log(`${d.persona} × ${d.land}/${d.partei} × ${d.modell_slug}:`);
      console.log(lokal.join("\n"));
    }
  }
  console.log(
    `\nBeleg-Prüfung: ${ok} ok · ${fehler} fehlerhaft · ${unpruefbar} nicht prüfbar${fix ? ` · ${korrigiert} Seite(n) korrigiert` : ""}`
  );
  if (fehler > 0) process.exitCode = 2;
}

main();
