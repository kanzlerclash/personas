import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ladeEnv,
  ladeWahlprogramme,
  cachePfad,
  ensureDir,
  parseArgs,
  type ProgrammQuelle,
} from "./util.ts";

ladeEnv();

interface SeitenInhalt {
  seite: number;
  text: string;
}

/** Extrahiert Text aus einem PDF-Buffer via pdfjs-dist (legacy build, kein Worker). */
async function pdfZuText(
  buf: Buffer
): Promise<{ text: string; seiten: SeitenInhalt[]; anzahl: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;
  const seiten: SeitenInhalt[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const txt = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    seiten.push({ seite: i, text: txt });
  }
  const text = seiten.map((s) => `\n\n===== Seite ${s.seite} =====\n${s.text}`).join("").trim();
  return { text, seiten, anzahl: doc.numPages };
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " ",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
  ndash: "–", mdash: "—", bdquo: "„", ldquo: "“", rdquo: "”", quot2: '"',
};

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-zA-Z#0-9]+);/g, (m, e) => ENTITIES[e] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Zerlegt eine HTML-Seite in Abschnitte (nach Überschriften h1–h3). Kein echtes Seiten-, sondern Abschnitts-Raster. */
function htmlZuText(html: string): { text: string; seiten: SeitenInhalt[]; anzahl: number } {
  const bereinigt = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|header|footer|form)[\s\S]*?<\/\1>/gi, " ");
  const teile = bereinigt.split(/(?=<h[1-3][\s>])/i).filter((t) => t.trim());
  const seiten: SeitenInhalt[] = [];
  for (const teil of teile) {
    const h = teil.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    const ueberschrift = h?.[1] ? stripTags(h[1]) : "";
    const text = stripTags(teil);
    if (text.length < 20) continue;
    seiten.push({ seite: seiten.length + 1, text: ueberschrift ? `${ueberschrift}\n${text}` : text });
  }
  if (!seiten.length) seiten.push({ seite: 1, text: stripTags(bereinigt) });
  const text = seiten.map((s) => `\n\n===== Seite ${s.seite} =====\n${s.text}`).join("").trim();
  return { text, seiten, anzahl: seiten.length };
}

async function cacheEintrag(p: ProgrammQuelle): Promise<void> {
  const label = `${p.landtag}/${p.partei}`;
  if (!p.url) {
    console.log(`⏭  ${label}: keine URL (ausstehend)`);
    return;
  }
  console.log(`⬇  ${label}: lade ${p.url}`);
  const resp = await fetch(p.url);
  if (!resp.ok) {
    console.error(`✗  ${label}: HTTP ${resp.status}`);
    return;
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const format = p.format ?? "pdf";

  const dir = cachePfad(p.landtag, p.partei);
  ensureDir(dir);
  writeFileSync(join(dir, format === "html" ? "original.html" : "original.pdf"), buf);

  let seiten: number | null = null;
  let textOk = false;
  const einheit = format === "html" ? "Abschnitte" : "Seiten";
  try {
    const { text, seiten: seitenInhalt, anzahl } =
      format === "html" ? htmlZuText(buf.toString("utf8")) : await pdfZuText(buf);
    writeFileSync(join(dir, "text.txt"), text, "utf8");
    // Seiten-/Abschnitts-indiziert für die Beleg-Prüfung (Zitat ↔ Seite leicht nachweisbar).
    writeFileSync(
      join(dir, "seiten.json"),
      JSON.stringify({ partei: p.partei, landtag: p.landtag, format, anzahl, seiten: seitenInhalt }, null, 2),
      "utf8"
    );
    seiten = anzahl;
    textOk = true;
  } catch (e) {
    console.error(`⚠  ${label}: Textextraktion fehlgeschlagen — ${(e as Error).message}`);
  }

  writeFileSync(
    join(dir, "meta.json"),
    JSON.stringify(
      {
        partei: p.partei,
        landtag: p.landtag,
        url: p.url,
        format,
        stand: p.stand,
        abgerufen: new Date().toISOString(),
        bytes: buf.byteLength,
        sha256,
        seiten,
        text_extrahiert: textOk,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`✓  ${label}: ${buf.byteLength} B, ${seiten ?? "?"} ${einheit}, sha256 ${sha256.slice(0, 12)}…`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { programme } = ladeWahlprogramme();
  const gefiltert = programme.filter(
    (p) =>
      (!args.land || p.landtag === args.land) &&
      (!args.partei || p.partei === args.partei)
  );
  console.log(`Cache: ${gefiltert.length} Einträge (${gefiltert.filter((p) => p.url).length} mit URL)\n`);
  for (const p of gefiltert) await cacheEintrag(p);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
