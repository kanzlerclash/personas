/**
 * Static Site Generator: rendert echte HTML-Seiten (Ordner mit index.html) pro Route.
 * Keine Hash-Routen, kein großes JS-Bundle — jede Seite trägt nur ihre Daten.
 * Avatare werden serverseitig als PNG vorgerendert (node-canvas + OffscreenCanvas-Polyfill).
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, mkdirSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import {
  ladePersonas, ladeThemen, ladeWahlprogramme, BEVOELKERUNG_DIR, ERGEBNISSE_DIR, ROOT,
} from "../pipeline/util.ts";
import { readdirSync, statSync } from "node:fs";

const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require("canvas");
(globalThis as any).OffscreenCanvas = class { constructor(w: number, h: number) { return createCanvas(w, h); } };

const BASE = process.env.PAGES_BASE ?? "/personas/";
const OUT = join(ROOT, "dist");
// Relative Pfade (ohne führenden Slash); aufgelöst über <base href> im Head.
// So tragfähig sowohl unter /personas/ (Pages) als auch unter / (lokal).
const u = (p: string) => p.replace(/^\//, "") || "./";
const e = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- Daten laden ---------- */
const THEMEN = ladeThemen();
const WP = ladeWahlprogramme();
const PARTEIEN: string[] = WP.parteien;
const themaName = (id: string) => THEMEN.find((t) => t.id === id)?.name ?? id;
const parteiName = (p: string) => (p === "gruene" ? "Grüne" : p.toUpperCase());

const MODELL_LABELS: Record<string, string> = {
  "claude-opus-4-8": "Claude Opus 4.8", "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "gemini-3.1-pro": "Gemini 3.1 Pro", "gpt-5.5": "GPT 5.5",
};
const kurz = (s: string) => MODELL_LABELS[s] ?? s;

function ladeBev(slug: string): any | null {
  const f = join(BEVOELKERUNG_DIR, `${slug}.yaml`);
  if (!existsSync(f)) return null;
  try { return YAML.parse(readFileSync(f, "utf8")); }
  catch (err) { console.warn(`⚠ bevoelkerung/${slug}.yaml übersprungen: ${(err as Error).message.split("\n")[0]}`); return null; }
}
interface Persona { slug: string; name: string; themen: string[]; profil: Record<string, any>; bevoelkerung: any | null; einzeiler: string; }
const PERSONAS: Persona[] = ladePersonas().map((p) => ({
  slug: p.slug, name: p.name, themen: p.themen, profil: p.roh,
  einzeiler: (p.roh.einzeiler as string) ?? "",
  bevoelkerung: ladeBev(p.slug),
}));
const persona = (slug: string) => PERSONAS.find((p) => p.slug === slug)!;

function alleJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir)) { const p = join(dir, ent); statSync(p).isDirectory() ? out.push(...alleJson(p)) : ent.endsWith(".json") && out.push(p); }
  return out;
}
interface Erg { persona: string; land: string; partei: string; modell: string; modell_slug: string; zeitpunkt?: string; erzeugt_via?: string; gesamt: { score: number; zusammenfassung: string }; besonders_gut: any[]; besonders_schlecht: any[]; }
const ERG: Erg[] = alleJson(ERGEBNISSE_DIR).map((f) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; } })
  .filter((d): d is Erg => !!d && typeof d?.modell_slug === "string" && Array.isArray(d.besonders_gut) && Array.isArray(d.besonders_schlecht) && !!d.gesamt && typeof d.gesamt.score === "number");

const SLUGS = [...new Set(ERG.map((x) => x.modell_slug))].sort();
const erg = (m: string, p: string, pa: string) => ERG.find((x) => x.modell_slug === m && x.persona === p && x.partei === pa);
const ergsMP = (m: string, p: string) => ERG.filter((x) => x.modell_slug === m && x.persona === p);
const ergsMPa = (m: string, pa: string) => ERG.filter((x) => x.modell_slug === m && x.partei === pa);
const parteienMit = (m: string) => [...new Set(ERG.filter((x) => x.modell_slug === m).map((x) => x.partei))].sort((a, b) => PARTEIEN.indexOf(a) - PARTEIEN.indexOf(b));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;
const scoreTxt = (s: number) => (r1(s) >= 0 ? "+" : "") + r1(s);
const scoreFarbe = (s: number) => `hsl(${((s + 2) / 4) * 125} 60% 45%)`;

/* ---------- Modell-Signaturen ---------- */
const gruppen = new Map<string, Erg[]>();
for (const x of ERG) { const k = `${x.persona}|${x.land}|${x.partei}`; (gruppen.get(k) ?? gruppen.set(k, []).get(k)!).push(x); }
const mittel = new Map<string, number>();
for (const [k, arr] of gruppen) mittel.set(k, avg(arr.map((x) => x.gesamt.score)));
const ausruf = (h: any) => /[!?]\s*$/.test(h.titel_selbst ?? "");
const SIG = SLUGS.map((slug) => {
  const es = ERG.filter((x) => x.modell_slug === slug);
  const gut = es.reduce((s, x) => s + x.besonders_gut.length, 0), schlecht = es.reduce((s, x) => s + x.besonders_schlecht.length, 0);
  const hs = es.flatMap((x) => [...x.besonders_gut, ...x.besonders_schlecht]);
  const aScore = avg(es.map((x) => x.gesamt.score)), kQuote = gut + schlecht ? schlecht / (gut + schlecht) : 0;
  const ausrufQ = hs.length ? hs.filter(ausruf).length / hs.length : 0;
  return {
    slug, name: es[0]?.modell ?? slug, anzahl: es.length, avgScore: r1(aScore), kritikQuote: kQuote,
    avgHighlights: r1((gut + schlecht) / (es.length || 1)),
    labels: { kritik: kQuote > 0.5 ? "kritisch" : kQuote < 0.35 ? "nachsichtig" : "ausgewogen", ton: ausrufQ > 0.5 ? "zugespitzt" : ausrufQ < 0.2 ? "sachlich" : "gemischt" },
  };
});
const DIVERGENZ = [...gruppen.entries()].filter(([, a]) => a.length >= 2).map(([k, a]) => {
  const [p, land, pa] = k.split("|"); const scores: Record<string, number> = {}; a.forEach((x) => (scores[x.modell_slug] = x.gesamt.score));
  const v = a.map((x) => x.gesamt.score); return { persona: p, land, partei: pa, scores, spanne: Math.max(...v) - Math.min(...v) };
}).sort((a, b) => b.spanne - a.spanne);

/* ---------- HTML-Bausteine ---------- */
const avatarImg = (p: Persona, cls = "avatar") => `<img class="${cls}" src="${u(`assets/avatare/${p.slug}.png`)}" width="96" alt="Pixel-Avatar von ${e(p.name)} (fiktiv)" loading="lazy">`;
const chip = (t: string) => `<span class="chip">${e(t)}</span>`;
const scorePill = (s: number) => `<span class="scorepill" style="background:${scoreFarbe(s)}">${e(scoreTxt(s))}</span>`;
// Holistisches Modell-Urteil als Label (Skala −2…+2 → Wort); die Zahl bleibt intern für Δ/Ø.
const URTEIL_STUFEN = ["ablehnend", "eher ablehnend", "gemischt", "eher zustimmend", "zustimmend"];
const urteilLabel = (s: number) => URTEIL_STUFEN[Math.max(-2, Math.min(2, Math.round(s))) + 2];
const urteilPill = (s: number) => `<span class="urteilpill" style="background:${scoreFarbe(s)}" title="Gesamt-Urteil des Modells (Skala −2…+2: ${scoreTxt(s)})">${e(urteilLabel(s))}</span>`;
// Kleines (?) das zur passenden Zeile der Methodik-Legende springt.
const hilfe = (anker: string, tip: string) => `<a class="hilfe" href="${u("methodik/ki-modelle/")}#${anker}" title="${e(tip)}" aria-label="Erklärung: ${e(tip)}">?</a>`;
// Divergenz-Spanne (0…4) als Wort; die Zahl bleibt intern (Methodik erklärt sie).
const SPANNE_STUFEN = ["Konsens", "nahezu einig", "uneinig", "stark uneinig", "maximaler Gegensatz"];
const spanneLabel = (v: number) => SPANNE_STUFEN[Math.max(0, Math.min(4, Math.round(v)))];
// KI-Urteile-Saldo = Anzahl positiver (gut) vs. negativer (schlecht) Belege, roh.
const gsBalken = (g: number, s: number) => `<span class="gsbalken" title="KI-Urteile-Saldo: ${g} positive, ${s} negative Belege">${g ? `<span class="gs-gut" style="flex:${g}"></span>` : ""}${s ? `<span class="gs-schlecht" style="flex:${s}"></span>` : ""}<span class="gs-zahl">+${g}/−${s}</span></span>`;
const vsScores = (a: number, b: number) => {
  const d = !isNaN(a) && !isNaN(b) ? Math.round(Math.abs(a - b) * 10) / 10 : NaN;
  return `<span class="splitscore">${isNaN(a) ? '<span class="meta">—</span>' : urteilPill(a)}<span class="vs">vs</span>${isNaN(b) ? '<span class="meta">—</span>' : urteilPill(b)}${isNaN(d) ? "" : `<span class="delta${d >= 2 ? " hoch" : ""}" title="Δ Modell-Urteil (Skala −2…+2)">${d ? "Δ" + d : "="}</span>`}</span>`;
};
const fiktiv = (gross = false) => `<span class="fiktiv${gross ? " gross" : ""}">${gross ? "fiktive Persona – keine reale Person" : "fiktiv"}</span>`;

function krume(segs: { kat?: boolean; label: string; href?: string }[]): string {
  return `<nav class="brotkrume">${segs.map((s, i) => (i ? `<span class="bc-sep">›</span>` : "") + (s.href !== undefined ? `<a href="${u(s.href)}">${e(s.label)}</a>` : `<span class="${s.kat ? "bc-kat" : "bc-akt"}">${e(s.label)}</span>`)).join("")}</nav>`;
}

function layout(titel: string, beschreibung: string, body: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<base href="${e(BASE)}">
<meta name="referrer" content="no-referrer">
<title>${e(titel)}</title><meta name="description" content="${e(beschreibung)}">
<meta property="og:title" content="${e(titel)}"><meta property="og:description" content="${e(beschreibung)}">
<link rel="stylesheet" href="${u("assets/style.css")}"></head><body>
<header class="kopf"><a href="${u("")}" class="logo">Personas</a><span class="kopf-sub">ein KanzlerClash #LTW26 Projekt — KI-Urteile über Wahlprogramme (Sachsen-Anhalt)</span></header>
<div class="ai-act" role="note">⚠ <strong>KI-generierte Inhalte.</strong> Die Bewertungen stammen von KI-Modellen, beziehen sich auf <strong>fiktive Personas</strong> (keine realen Personen) und können Fehler und Verzerrungen (Bias) enthalten. <strong>Keine Wahlempfehlung</strong> — dient der politischen Bildung. Parteizitate dienen als Beleg (Urheberrecht der Parteien).</div>
<main>${body}</main>
<footer class="fuss">Stand: ${new Date().toLocaleDateString("de-DE")} · ${ERG.length} KI-Urteile · <a href="${u("methodik/")}">Methodik</a> · Daten unter CC-BY-SA · <a href="https://github.com/kanzlerclash/personas" target="_blank" rel="noopener noreferrer">Quellcode</a> · Transparenz gem. EU-KI-VO Art. 50</footer>
</body></html>`;
}

const sigZeile = (l: string, w: string, farbe?: string) => `<div class="sigzeile"><span class="sz-l">${e(l)}</span><span class="sz-w"${farbe ? ` style="color:${farbe}"` : ""}>${e(w)}</span></div>`;

/** Links zu denselben Ansicht bei den anderen Modellen (Modell-Vergleich/Wechsel). */
function modellWechsler(curr: string, slugs: string[], hrefFor: (s: string) => string): string {
  const others = slugs.filter((s) => s !== curr);
  if (!others.length) return "";
  return `<div class="vsbar"><span class="vslbl">Vergleichen mit:</span>${others.map((s) => `<a class="vsbtn" href="${u(hrefFor(s))}">${e(kurz(s))}</a>`).join("")}</div>`;
}

// Quell-Register: (land|partei) → Wahlprogramm-URL/Format/Stand (für Beleg-Links)
const WPMAP: Record<string, { url: string | null; format?: string; stand?: string | null }> = {};
for (const pr of WP.programme) WPMAP[`${pr.landtag}|${pr.partei}`] = { url: pr.url, format: (pr as any).format, stand: pr.stand };
function belegLink(land: string, partei: string, seite: number | null) {
  const wp = WPMAP[`${land}|${partei}`];
  const html = wp?.format === "html";
  const einheit = seite == null ? "" : html ? `Abschnitt ${seite}` : `S. ${seite}`;
  const prog = `${parteiName(partei)}-Wahlprogramm${wp?.stand ? ` (${wp.stand})` : ""}`;
  const href = wp?.url ? (html || seite == null ? wp.url : `${wp.url}#page=${seite}`) : null;
  return { href, einheit, prog, html };
}
function highlightHtml(h: any, land: string, partei: string): string {
  let beleg = "";
  if (h.zitat) {
    const bl = belegLink(land, partei, h.seite ?? null);
    const badge = `<span class="beleg ${h.beleg_ok === true ? "ok" : h.beleg_ok === false ? "fehler" : "offen"}">${h.beleg_ok === true ? "✓ belegt" : h.beleg_ok === false ? "⚠ ungeprüft" : "•"}</span>`;
    const kern = `${bl.einheit ? e(bl.einheit) + ": " : ""}„${e(h.zitat)}"`;
    const inner = bl.href
      ? `<a class="quelle-link" href="${e(bl.href)}" target="_blank" rel="nofollow noopener noreferrer" title="Zur Quelle öffnen: ${e(bl.prog)}${bl.html ? ` — HTML-Programm ohne Seiten, Abschnitt ${e(h.seite ?? "?")}` : ""}">${kern} <span class="q-src">— ${e(bl.prog)} ↗</span></a>`
      : kern;
    beleg = `<p class="belegzeile">${badge} ${inner}</p>`;
  }
  return `<div class="highlight"><div class="hl-kopf"><strong class="titel">„${e(h.titel_selbst)}"</strong>${chip(themaName(h.thema))}${chip(h.bezug === "betrifft_mich" ? "betrifft mich" : "Sicht auf andere")}${chip(h.resonanz === "bestaetigt" ? "bestätigt" : "konträr")}</div><p class="selbst">${e(h.begruendung_selbst)}</p><p class="analytisch">${e(h.begruendung)}</p>${beleg}</div>`;
}
function kiBadge(x: Erg): string {
  const datum = x.zeitpunkt ? new Date(x.zeitpunkt).toLocaleDateString("de-DE") : "";
  return `<div class="ki-badge"><span class="ki-dot">● KI-generiert</span> ${e(kurz(x.modell_slug))}${datum ? " · " + e(datum) : ""} · kann Fehler/Bias enthalten</div>`;
}
function renderWert(key: string, val: any): string {
  let inner = "";
  if (Array.isArray(val)) inner = `<ul>${val.map((v) => v && typeof v === "object" ? `<li><strong>${e(v.gruppe ?? Object.values(v)[0] ?? "")}</strong>${v.haltung ?? Object.values(v)[1] ? " — " + e(v.haltung ?? Object.values(v)[1]) : ""}</li>` : `<li>${e(v)}</li>`).join("")}</ul>`;
  else if (val && typeof val === "object") inner = `<dl class="unterliste">${Object.entries(val).map(([k, v]) => renderWert(k, v)).join("")}</dl>`;
  else inner = e(val);
  return `<div class="feld"><dt>${e(key.replace(/_/g, " "))}</dt><dd>${inner}</dd></div>`;
}
function profilBlock(p: Persona): string {
  let bev = "";
  if (p.bevoelkerung) {
    const q = (p.bevoelkerung.quellen ?? []).map((x: any) => `<li>${x.url ? `<a href="${e(x.url)}" target="_blank" rel="noopener noreferrer">${e((x.herausgeber ?? x.titel) + ": " + (x.wert ?? ""))}</a>` : e((x.herausgeber ?? x.titel) + ": " + (x.wert ?? ""))}</li>`).join("");
    bev = `<section class="bevoelkerung"><h3 class="abschnitt">Anteil der Bevölkerung</h3><p>${e(p.bevoelkerung.anteil ?? "?")} — ${e(p.bevoelkerung.bezug ?? "")}</p>${p.bevoelkerung.verifiziert ? "" : `<p class="warn">⚠ Entwurf, noch nicht gegen Primärquelle verifiziert</p>`}${q ? `<ul>${q}</ul>` : ""}</section>`;
  }
  const skip = new Set(["name", "einzeiler", "themen", "gesicht"]);
  const felder = Object.entries(p.profil).filter(([k]) => !skip.has(k)).map(([k, v]) => renderWert(k, v)).join("");
  return `${bev}<section class="profil"><h3 class="abschnitt">Profil</h3><dl>${felder}</dl></section>`;
}

/* ---------- Seiten ---------- */
const seiten: { pfad: string; titel: string; beschr: string; body: string }[] = [];
const add = (pfad: string, titel: string, beschr: string, body: string) => seiten.push({ pfad, titel, beschr, body });

// Landing
{
  const OPUS = SLUGS.includes("claude-opus-4-8") ? "claude-opus-4-8" : SIG[0].slug;
  const flBox = (href: string, tip: string, stark: string, unter: string) =>
    `<a class="fl-box" href="${u(href)}" title="Methodik: ${e(tip)}"><span class="fl-q" aria-hidden="true">?</span><strong>${stark}</strong><span>${unter}</span></a>`;
  const fluss = `<div class="fluss">` +
    flBox("methodik/personas/", "Personas", `${PERSONAS.length} Personas`, "fiktive Lebenslagen") +
    flBox("methodik/wahlprogramme/", "Wahlprogramme", `${PARTEIEN.length} Wahlprogramme`, "Sachsen-Anhalt · Volltext, zitiert") +
    `<div class="fl-pfeil">→</div>` +
    flBox("methodik/ki-modelle/", "KI-Modelle", `${SIG.length} KI-Modelle`, e(SIG.map((m) => kurz(m.slug)).join(" · "))) +
    `<div class="fl-pfeil">→</div>` +
    flBox("methodik/ki-modelle/", "KI-Urteile & Belege", `${ERG.length} KI-Urteile`, "je mit Seite + Zitat belegt") +
    `</div>`;
  const karten = SIG.map((m) => `<a class="sigkarte" href="${u(`modell/${m.slug}/`)}"><h4>${e(kurz(m.slug))}</h4><div class="sig-modell">${e(m.name)}</div><div class="sig-zahlen">${sigZeile("Ø-Urteil", `${urteilLabel(m.avgScore)} (${scoreTxt(m.avgScore)})`, scoreFarbe(m.avgScore))}${sigZeile("Kritik-Quote", Math.round(m.kritikQuote * 100) + " %", scoreFarbe(2 - m.kritikQuote * 4))}${sigZeile("Tonalität", m.labels.ton)}${sigZeile("Ø Punkte/Urteil", String(m.avgHighlights))}</div><div class="sig-label">${e(m.labels.kritik + ", " + m.labels.ton)} · ${m.anzahl} Urteile</div><span class="sig-cta">→ Personas ansehen</span></a>`).join("");
  const persChips = PERSONAS.map((p) => `<a href="${u(`persona/${p.slug}/`)}">${avatarImg(p, "avatar mini")}<span>${e(p.name)}</span></a>`).join("");
  const parteiChips = parteienMit(OPUS).map((pa) => `<a href="${u(`modell/${OPUS}/partei/${pa}/`)}">${e(parteiName(pa))}</a>`).join("");
  const body = `<section class="hero"><h2>Wie urteilen KI-Modelle über die Wahlprogramme?</h2>${fluss}</section>
<div class="infobox"><strong>Was ist Modell-Bias?</strong> Alle Modelle lesen dieselben Programme aus Sicht derselben fiktiven Personas — und urteilen trotzdem unterschiedlich streng und kritisch. Dieses Urteil hängt vom <em>Modell</em> (und seiner Version) ab. Wähle ein Modell und sieh selbst.</div>
<h3 class="abschnitt">Die Modelle und ihr Bias</h3><div class="sig-grid">${karten}</div>
<h3 class="abschnitt">Die ${PERSONAS.length} Personas</h3><div class="persliste">${persChips}</div>
<h3 class="abschnitt">Die Parteien · Sachsen-Anhalt</h3><p class="mini">Urteile standardmäßig aus Sicht von ${e(kurz(OPUS))} — auf der Partei-Seite ist das Modell wechselbar.</p><div class="persliste text">${parteiChips}</div>
<div class="unternav"><a class="navbtn" href="${u("vergleich/")}">⚖ Wo sind sich die Modelle uneinig?</a><a class="navbtn" href="${u("personas/")}">👤 Nach Persona einsteigen</a></div>`;
  add("", "Personas — ein KanzlerClash #LTW26 Projekt", "Wie urteilen verschiedene KI-Modelle über die Wahlprogramme zur Landtagswahl 2026 (Sachsen-Anhalt)? Modell-Vergleich, Bias-Signaturen, belegte Quellen. Keine Wahlempfehlung.", body);
}

// ---------- Methodik-Seiten ----------
{
  const readP = (p: string) => { try { return readFileSync(join(ROOT, p), "utf8").replace(/^<!--[\s\S]*?-->\s*/, "").trim(); } catch { return "(Datei nicht gefunden)"; } };
  const promptVergleich = readP("prompts/vergleich.v1.md");
  const promptVorlage = readP("prompts/llm-cli-vorlage.md");
  const SEITEN: Record<string, number> = { cdu: 91, spd: 37, gruene: 100, afd: 20, fdp: 76, linke: 150, bsw: 90 };
  const AUSF: Record<string, string> = {
    "claude-opus-4-8": "Claude-Code-Subagenten (lokal, ohne Gateway)",
    "claude-sonnet-4-6": "Claude-Code-Subagenten (lokal, ohne Gateway)",
    "gemini-3.1-pro": "agy-CLI / Gemini (lokal, ohne Gateway)",
    "gpt-5.5": "Codex-CLI / ChatGPT-Login (lokal, ohne Gateway)",
  };
  const mk = (label: string) => krume([{ label: "Start", href: "" }, { kat: true, label: "Methodik", href: "methodik/" }, { label }]);

  // Hub
  {
    const karte = (href: string, t: string, d: string) => `<a class="sigkarte" href="${u(href)}"><h4>${e(t)}</h4><div class="sig-modell">${e(d)}</div><span class="sig-cta">→ ansehen</span></a>`;
    const body = `${krume([{ label: "Start", href: "" }, { label: "Methodik" }])}<h2>Methodik — wie die Daten entstanden sind</h2>
<p class="infozeile">Vier Bausteine, transparent nachvollziehbar. Alle generierten Daten stehen unter CC-BY-SA. Keine Wahlempfehlung; die KI-Läufe liefen <strong>lokal ohne API-Gateway</strong>.</p>
<div class="sig-grid">
${karte("methodik/personas/", "Personas", "Wie die 16 fiktiven Lebenslagen + Avatare entstanden")}
${karte("methodik/wahlprogramme/", "Wahlprogramme", "Wie die 7 Programme eingelesen und zitiert werden")}
${karte("methodik/ki-modelle/", "KI-Modelle", "Wie Persona × Programm × Modell zum Urteil wird")}
${karte("methodik/prompts/", "Prompts", "Die verwendeten Prompts im Wortlaut")}
</div>`;
    add("methodik/", "Methodik · Personas #LTW26", "Wie die Daten entstanden sind: Personas, Wahlprogramme, KI-Modelle, Prompts — transparent, CC-BY-SA.", body);
  }

  // Personas
  {
    const body = `${mk("Personas")}<h2>Methodik: Personas</h2>
<div class="infobox"><strong>Fiktive Archetypen, keine realen Personen.</strong> Die 16 Lebenslagen bilden bewusst ein ausgewogenes Spektrum ab (Roster). Jede Persona ist aus ihrer Lage heraus einseitig — neutral wird das Bild erst über die Summe aller.</div>
<p>Die ausführlichen Profile <em>und</em> die Avatar-Konfigurationen wurden <strong>redaktionell im Dialog von Claude Opus 4.8</strong> formuliert — nicht über die API-Pipeline. Es gibt dafür bewusst <strong>keinen</strong> reproduzierbaren API-Prompt mit Temperatur/Seed; die Artefakte sind menschlich reviewbar und im Git-Verlauf nachvollziehbar.</p>
<p><strong>Detailtiefe nach Forschungslage:</strong> mittel-detailliert und <em>aufgabenrelevant</em> — Forschung zeigt, dass irrelevante Deko-Details (Name, Lieblingsfarbe) die Modellleistung senken und Stereotype verstärken können. Daher viel relevante Lage/Haltung, keine Trivia, würdevolle Formulierung.</p>
<p><strong>Avatare:</strong> 8-Bit über <a href="https://dracoblue.github.io/retro-antlitz-kartei/" target="_blank" rel="nofollow noopener noreferrer">retro-antlitz-kartei</a> (MIT); Teile/Farben je Persona von Hand aus dem echten Profil abgeleitet.</p>
<p>Volle Herkunfts-Doku: <a href="https://github.com/kanzlerclash/personas/blob/main/prompts/herkunft-personas-und-avatare.md" target="_blank" rel="nofollow noopener noreferrer">herkunft-personas-und-avatare.md</a> · <a href="https://github.com/kanzlerclash/personas/blob/main/prompts/herkunft-roster.md" target="_blank" rel="nofollow noopener noreferrer">herkunft-roster.md</a></p>
<h3 class="abschnitt">Die ${PERSONAS.length} Personas</h3>
<div class="persliste">${PERSONAS.map((p) => `<a href="${u(`persona/${p.slug}/`)}">${avatarImg(p, "avatar mini")}<span>${e(p.name)}</span></a>`).join("")}</div>
<div class="unternav"><a class="navbtn" href="${u("personas/")}">👤 Alle Personas ansehen</a></div>`;
    add("methodik/personas/", "Methodik: Personas · #LTW26", "Wie die 16 fiktiven Personas und ihre Avatare entstanden sind — redaktionell, spektrum-balanciert, würdevoll.", body);
  }

  // Wahlprogramme
  {
    const rows = WP.programme.filter((p) => p.landtag === "sachsen-anhalt" && p.url).map((p) => {
      const html = (p as any).format === "html";
      const umfang = SEITEN[p.partei] ? `${SEITEN[p.partei]} ${html ? "Abschnitte" : "Seiten"}` : "—";
      return `<tr><td><strong>${e(parteiName(p.partei))}</strong></td><td>${e(p.stand || "—")}</td><td>${html ? "HTML" : "PDF"}</td><td>${umfang}</td><td><a href="${e(p.url!)}" target="_blank" rel="nofollow noopener noreferrer">Quelle ↗</a></td></tr>`;
    }).join("");
    const body = `${mk("Wahlprogramme")}<h2>Methodik: Wahlprogramme</h2>
<div class="infobox"><strong>Nicht von KI verarbeitet.</strong> Die Programme werden <strong>nicht</strong> zusammengefasst oder umgeschrieben — sie werden im <strong>Volltext eingelesen</strong> (PDF/HTML → Text, seitenindiziert) und ausschließlich <strong>wörtlich zitiert</strong> (Kurzzitate unter 15 Wörter als Beleg).</div>
<p><strong>Ablauf:</strong> Quell-URL → Download → Textextraktion mit Seitenmarkierung (<code>===== Seite N =====</code>; bei HTML: Abschnitte) → SHA-256 + Stand vermerkt. Jedes KI-Zitat wird später automatisch gegen die angegebene Seite geprüft.</p>
<p class="mini"><strong>Zur Spalte „Stand":</strong> Angegeben ist das von der Partei genannte Beschluss- bzw. Stand-Datum. Zur Plausibilität haben wir es gegen das Erstellungsdatum in den PDF-Metadaten (<code>CreationDate</code>) gehalten — die PDFs wurden am oder nach dem Beschluss erzeugt (teils spätere Satz-/Layoutfassungen). Die AfD-Fassung liegt nur als HTML vor (kein PDF-Metadatum zur Gegenprüfung); das Beschlussdatum stammt von der Partei.</p>
<p><strong>Urheberrecht:</strong> Die Programme gehören den Parteien und werden <strong>nicht</strong> in diesem Projekt veröffentlicht — nur lokal gecacht (git-ignoriert) und über das Quell-Register reproduzierbar nachgeladen. Verlinkung als Quelle.</p>
<table class="mtab"><thead><tr><th>Partei</th><th>Stand</th><th>Format</th><th>Umfang</th><th>Quelle</th></tr></thead><tbody>${rows}</tbody></table>`;
    add("methodik/wahlprogramme/", "Methodik: Wahlprogramme · #LTW26", "Wie die 7 Wahlprogramme eingelesen und zitiert werden — Volltext, nicht KI-verarbeitet, mit Quell-Deeplinks.", body);
  }

  // KI-Modelle
  {
    const mrows = SIG.map((m) => `<tr><td><strong>${e(kurz(m.slug))}</strong></td><td>${e(m.name)}</td><td>${e(AUSF[m.slug] || "lokal, ohne Gateway")}</td><td>${m.anzahl}</td></tr>`).join("");
    // Echte Beispiele für die „Was die Zahlen bedeuten"-Karten: divergentester Fall + ein Modell.
    const _bsp = DIVERGENZ[0];
    const _bName = persona(_bsp.persona)?.name ?? _bsp.persona, _bPartei = parteiName(_bsp.partei);
    const _bMs = SIG.filter((x) => _bsp.scores[x.slug] !== undefined).sort((a, b) => _bsp.scores[a.slug] - _bsp.scores[b.slug]);
    const _bLo = _bMs[0], _bHi = _bMs[_bMs.length - 1];
    const _bLab = (m: typeof _bLo) => urteilLabel(_bsp.scores[m.slug]);
    const _bE = erg(_bHi.slug, _bsp.persona, _bsp.partei);
    const _bG = _bE ? _bE.besonders_gut.length : 0, _bS = _bE ? _bE.besonders_schlecht.length : 0;
    const _bD = Math.round(Math.abs(_bsp.scores[_bHi.slug] - _bsp.scores[_bLo.slug]) * 10) / 10;
    const _m = SIG[0];
    const body = `${mk("KI-Modelle")}<h2>Methodik: KI-Modelle</h2>
<div class="infobox"><strong>Persona × Programm × Modell → Urteil.</strong> Jedes Modell versetzt sich in eine Persona, liest das Programm und nennt, was ihr <strong>besonders gut</strong> oder <strong>schlecht</strong> gefällt — jeder Punkt mit <strong>Seite + wörtlichem Zitat</strong> belegt und automatisch gegen die Seite geprüft.</div>
<p><strong>Ausführung — lokal ohne API-Gateway:</strong></p>
<table class="mtab"><thead><tr><th>Modell</th><th>Kennung</th><th>Ausführung</th><th>Urteile</th></tr></thead><tbody>${mrows}</tbody></table>
<p>Jede Auswertung trägt ein <code>erzeugt_via</code>-Feld; Token-/Kostenmetriken nur, soweit die CLI sie meldet. Temperatur 0. Anti-Bias-Regel: markt-/wirtschaftsliberale und konservative Positionen mit gleichen Maßstäben wie progressive; Würde gerade bei marginalisierten Lebenslagen.</p>
<p><strong>Beleg-Prüfung:</strong> Jedes Zitat wird (fuzzy, ±1 Seite) gegen die Programm-Seite geprüft; nicht auffindbare Zitate sind als „⚠ ungeprüft" markiert.</p>
<h3 class="abschnitt">Was die Zahlen bedeuten</h3>
<p class="mini">Pro Persona × Partei zeigen wir <strong>zwei</strong> Dinge: das holistische <strong>Modell-Urteil</strong> und den <strong>KI-Urteile-Saldo</strong>. Sie können abweichen — das ist gewollt (siehe unten).</p>
<div class="zahlgrid">
<div class="zahlkarte" id="modell-urteil"><h4>Modell-Urteil</h4><div class="zk-skala">ablehnend · eher ablehnend · gemischt · eher zustimmend · zustimmend <span class="zk-form">(intern −2…+2)</span></div><p>Holistische Gesamteinschätzung, wie die Persona das Programm insgesamt aufnimmt. Vom Modell <em>selbst</em> vergeben (<code>gesamt.score</code>) — <strong>nicht</strong> aus den Belegen gerechnet; bezieht die Tragweite einzelner Punkte mit ein.</p><p class="bsp"><strong>Beispiel:</strong> ${e(_bName)} × ${e(_bPartei)}: ${e(kurz(_bHi.slug))} urteilt „${e(_bLab(_bHi))}".</p></div>
<div class="zahlkarte" id="ki-urteile-saldo"><h4>KI-Urteile-Saldo</h4><div class="zk-skala">+gut / −schlecht <span class="zk-form">(zwei Zähler)</span></div><p>Anzahl der belegten Punkte, die dem Programm aus Sicht der Persona positiv bzw. negativ angerechnet werden. Rein zählend, ohne Gewichtung der Wichtigkeit — kann daher vom Modell-Urteil abweichen (wenige, aber existenzielle Minuspunkte).</p><p class="bsp"><strong>Beispiel:</strong> ${e(kurz(_bHi.slug))} für ${e(_bName)} × ${e(_bPartei)}: +${_bG} / −${_bS}.</p></div>
<div class="zahlkarte" id="delta"><h4>Δ Modell-Urteil</h4><div class="zk-skala"><span class="zk-form">0 … 4 (Stufen)</span></div><p>Differenz der Modell-Urteile <em>zweier</em> Modelle für denselben Fall (auf den A-vs-B-Seiten). Zeigt, wie stark das Urteil vom gewählten Modell abhängt.</p><p class="bsp"><strong>Beispiel:</strong> ${e(_bName)} × ${e(_bPartei)}: ${e(kurz(_bLo.slug))} „${e(_bLab(_bLo))}" vs ${e(kurz(_bHi.slug))} „${e(_bLab(_bHi))}" → Δ ${_bD}.</p></div>
<div class="zahlkarte" id="o-urteil"><h4>Ø-Urteil</h4><div class="zk-skala"><span class="zk-form">Mittelwert der −2…+2 (Label + Zahl)</span></div><p>Durchschnitt der Modell-Urteile eines Modells über <em>alle</em> bewerteten Fälle — Kennzahl für die generelle Tendenz („Bias") des Modells.</p><p class="bsp"><strong>Beispiel:</strong> ${e(kurz(_m.slug))} im Schnitt „${e(urteilLabel(_m.avgScore))}" (${e(scoreTxt(_m.avgScore))}) über ${_m.anzahl} Urteile.</p></div>
<div class="zahlkarte" id="kritik-quote"><h4>Kritik-Quote</h4><div class="zk-skala"><span class="zk-form">schlecht / (gut + schlecht)</span></div><p>Anteil der „besonders schlecht"-Belege an allen Belegen des Modells. Daraus das Label: <em>nachsichtig</em> (&lt; 35 %), <em>ausgewogen</em> (35–50 %), <em>kritisch</em> (&gt; 50 %).</p><p class="bsp"><strong>Beispiel:</strong> ${e(kurz(_m.slug))}: ${Math.round(_m.kritikQuote * 100)} % → ${e(_m.labels.kritik)}.</p></div>
<div class="zahlkarte" id="punkte"><h4>Ø Punkte/Urteil</h4><div class="zk-skala"><span class="zk-form">(gut + schlecht) / Auswertungen</span></div><p>Durchschnittliche Zahl belegter Punkte je Auswertung — wie viel ein Modell pro Programm anmerkt.</p><p class="bsp"><strong>Beispiel:</strong> ${e(kurz(_m.slug))}: ${_m.avgHighlights} Punkte je Auswertung.</p></div>
<div class="zahlkarte" id="tonalitaet"><h4>Tonalität</h4><div class="zk-skala">sachlich · gemischt · zugespitzt</div><p>Sprachlicher Ton, aus dem Anteil zugespitzter Kurz-Titel (mit ! oder ?): unter 20 % sachlich, über 50 % zugespitzt.</p><p class="bsp"><strong>Beispiel:</strong> ${e(kurz(_m.slug))}: ${e(_m.labels.ton)}.</p></div>
<div class="zahlkarte" id="spanne"><h4>Spanne (Divergenz)</h4><div class="zk-skala">Konsens · nahezu einig · uneinig · stark uneinig · maximaler Gegensatz <span class="zk-form">(intern 0…4)</span></div><p>Differenz zwischen höchstem und niedrigstem Modell-Urteil <em>aller</em> Modelle für denselben Fall — extern als Wort. Intern die Stufe 0 (alle gleich) bis 4 (ein Modell „ablehnend", ein anderes „zustimmend").</p><p class="bsp"><strong>Beispiel:</strong> ${e(_bName)} × ${e(_bPartei)}: von „${e(_bLab(_bLo))}" (${e(kurz(_bLo.slug))}) bis „${e(_bLab(_bHi))}" (${e(kurz(_bHi.slug))}) → ${e(spanneLabel(_bsp.spanne))} (Stufe ${_bsp.spanne}).</p></div>
</div>
<div class="unternav"><a class="navbtn" href="${u("methodik/prompts/")}">📝 Prompt im Wortlaut</a><a class="navbtn" href="${u("vergleich/")}">⚖ Modell-Divergenz</a></div>`;
    add("methodik/ki-modelle/", "Methodik: KI-Modelle · #LTW26", "Wie aus Persona, Wahlprogramm und KI-Modell ein belegtes Urteil wird — lokal ohne Gateway, mit Prompt.", body);
  }

  // Prompts
  {
    const body = `${mk("Prompts")}<h2>Methodik: Prompts im Wortlaut</h2>
<p class="infozeile">Alle Prompts sind mit-committet und versioniert. Persona-Profile und Avatare entstanden dagegen redaktionell (kein einzelner API-Prompt) — siehe <a href="${u("methodik/personas/")}">Methodik: Personas</a>.</p>
<h3 class="abschnitt">1) Persona × Programm-Vergleich — System-Prompt (<code>vergleich.v1</code>)</h3>
<p class="mini">Der Kern-Prompt: Regeln, wie ein Modell aus Sicht der Persona die guten/schlechten Punkte belegt. Die konkreten Daten (Profil, Themen, Programmtext) hängt die Pipeline als User-Nachricht an.</p>
<pre class="prompt">${e(promptVergleich)}</pre>
<h3 class="abschnitt">2) CLI-Vorlage (Platzhalter) — <code>llm-cli-vorlage.md</code></h3>
<p class="mini">Dieselbe tool-neutrale Vorlage wurde für <strong>Gemini (agy)</strong> <em>und</em> <strong>GPT-5.5 (Codex)</strong> genutzt — nur der Modell-Slug unterscheidet sich (Platzhalter <code>__LAND__</code>/<code>__PARTEI__</code>/<code>__PERSONA__</code>/<code>__MODELL__</code>). Die <strong>Claude Opus/Sonnet</strong>-Läufe (Claude-Code-Subagenten) nutzten einen inhaltlich gleichwertigen Prompt direkt im Subagenten (nicht diese Datei). Alle beruhen auf denselben Regeln aus <code>vergleich.v1</code> (oben).</p>
<pre class="prompt">${e(promptVorlage)}</pre>
<p>Bevölkerungsanteile: recherchiert aus amtlichen Quellen (kein KI-Schätzprompt als Fakt); Details je Persona auf der jeweiligen Profilseite. Quellcode &amp; alle Prompts: <a href="https://github.com/kanzlerclash/personas/tree/main/prompts" target="_blank" rel="nofollow noopener noreferrer">prompts/ auf GitHub</a>.</p>`;
    add("methodik/prompts/", "Methodik: Prompts · #LTW26", "Die verwendeten Prompts im Wortlaut: der Persona×Programm-System-Prompt und die CLI-Vorlage.", body);
  }
}

// Personas-Liste
{
  const grid = PERSONAS.map((p) => `<a class="karte" href="${u(`persona/${p.slug}/`)}">${avatarImg(p)}<h3>${e(p.name)}</h3>${p.einzeiler ? `<p class="einzeiler">${e(p.einzeiler)}</p>` : ""}<div class="themen">${p.themen.map((t) => chip(themaName(t))).join("")}</div>${fiktiv()}</a>`).join("");
  add("personas/", "Alle Personas · Personas #LTW26", "Die 16 fiktiven Lebenslagen im Überblick.", `${krume([{ label: "Start", href: "" }, { label: "Alle Personas" }])}<h2>Nach Persona einsteigen</h2><p class="infozeile">Wähle eine Lebenslage — auf ihrer Profilseite findest du Details und die Einschätzungen der Modelle.</p><div class="raster">${grid}</div>`);
}

// Persona-Profil
for (const p of PERSONAS) {
  const modelle = SIG.filter((m) => ergsMP(m.slug, p.slug).length);
  const karten = modelle.map((m) => { const es = ergsMP(m.slug, p.slug); const sc = avg(es.map((x) => x.gesamt.score)); return `<a class="sigkarte" href="${u(`modell/${m.slug}/persona/${p.slug}/`)}"><h4>${e(kurz(m.slug))}</h4><div class="sig-modell">${es.length} Parteien bewertet</div><div class="sig-zahlen">${sigZeile("Ø-Urteil", `${urteilLabel(sc)} (${scoreTxt(sc)})`, scoreFarbe(sc))}${sigZeile("KI-Urteile-Saldo", `+${es.reduce((s, x) => s + x.besonders_gut.length, 0)} / −${es.reduce((s, x) => s + x.besonders_schlecht.length, 0)}`)}</div><span class="sig-cta">→ Einschätzung ansehen</span></a>`; }).join("");
  const body = `${krume([{ label: "Start", href: "" }, { kat: true, label: "Persona" }, { label: p.name }])}
<div class="detail-kopf">${avatarImg(p, "avatar gross")}<div><h2>${e(p.name)}</h2>${fiktiv(true)}${p.einzeiler ? `<p class="einzeiler">${e(p.einzeiler)}</p>` : ""}<div class="themen">${p.themen.map((t) => chip(themaName(t))).join("")}</div></div></div>
${modelle.length ? `<h3 class="abschnitt">Wie die Modelle diese Persona einordnen</h3><div class="sig-grid">${karten}</div>` : ""}
${profilBlock(p)}`;
  add(`persona/${p.slug}/`, `${p.name} · Profil · Personas #LTW26`, `Profil der fiktiven Persona ${p.name} und wie KI-Modelle sie zu den Wahlprogrammen einordnen.`, body);
}

// Modell → Personas & Modell → Parteien & tiefer
for (const m of SIG) {
  const sigBanner = `<div class="sigbanner"><span>Ø-Urteil </span>${urteilPill(m.avgScore)}${hilfe("o-urteil", "Ø-Urteil: Durchschnitt der Modell-Urteile über alle Fälle")}<span class="sb-sep">· Kritik-Quote ${Math.round(m.kritikQuote * 100)} %</span>${hilfe("kritik-quote", "Kritik-Quote & Label (nachsichtig/ausgewogen/kritisch)")}<span class="sb-sep">· ${e(m.labels.kritik)}, ${e(m.labels.ton)}</span>${hilfe("tonalitaet", "Tonalität: sachlich/gemischt/zugespitzt")}</div>`;
  // Modell-Übersicht: Parteien + Personas auf einer Seite
  {
    const wechsel = modellWechsler(m.slug, SIG.map((x) => x.slug), (s) => `modell/${m.slug}/vs/${s}/`);
    const pRows = parteienMit(m.slug).map((pa) => { const es = ergsMPa(m.slug, pa); return `<a class="qrow" href="${u(`modell/${m.slug}/partei/${pa}/`)}"><strong class="qpartei">${e(parteiName(pa))}</strong>${urteilPill(avg(es.map((x) => x.gesamt.score)))}${gsBalken(es.reduce((s, x) => s + x.besonders_gut.length, 0), es.reduce((s, x) => s + x.besonders_schlecht.length, 0))}</a>`; }).join("");
    const persRows = PERSONAS.map((p) => { const es = ergsMP(m.slug, p.slug); if (!es.length) return ""; const sc = avg(es.map((x) => x.gesamt.score)); return `<a class="qrow" href="${u(`modell/${m.slug}/persona/${p.slug}/`)}">${avatarImg(p, "avatar mini")}<div class="qname"><strong>${e(p.name)}</strong>${fiktiv()}</div>${urteilPill(sc)}${gsBalken(es.reduce((s, x) => s + x.besonders_gut.length, 0), es.reduce((s, x) => s + x.besonders_schlecht.length, 0))}</a>`; }).join("");
    add(`modell/${m.slug}/`, `${kurz(m.slug)}: Sicht auf Parteien & Lebenslagen · #LTW26`, `Wie ${kurz(m.slug)} die Parteien und die 16 fiktiven Lebenslagen zu den Wahlprogrammen einordnet.`, `${krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug) }])}<h2>${e(kurz(m.slug))}: Sicht auf Parteien &amp; Lebenslagen</h2>${sigBanner}${wechsel}<h3 class="sektion">Parteien</h3><div class="qtab">${pRows}</div><h3 class="sektion">Personas</h3><div class="qtab">${persRows}</div>`);
  }
  // Modell × Persona → Parteien
  for (const p of PERSONAS) {
    const es = ergsMP(m.slug, p.slug); if (!es.length) continue;
    const wechsel = modellWechsler(m.slug, SIG.filter((x) => ergsMP(x.slug, p.slug).length).map((x) => x.slug), (s) => `modell/${m.slug}/vs/${s}/persona/${p.slug}/`);
    const rows = parteienMit(m.slug).map((pa) => { const a = erg(m.slug, p.slug, pa); if (!a) return ""; return `<a class="qrow" href="${u(`modell/${m.slug}/persona/${p.slug}/partei/${pa}/`)}"><strong class="qpartei">${e(parteiName(pa))}</strong>${urteilPill(a.gesamt.score)}${gsBalken(a.besonders_gut.length, a.besonders_schlecht.length)}</a>`; }).join("");
    add(`modell/${m.slug}/persona/${p.slug}/`, `${p.name} × ${kurz(m.slug)} · #LTW26`, `Wie ${kurz(m.slug)} die Persona ${p.name} zu den Parteien einordnet.`, `${krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug), href: `modell/${m.slug}/` }, { kat: true, label: "Persona" }, { label: p.name }])}
<div class="detail-kopf">${avatarImg(p, "avatar gross")}<div><h2>${e(p.name)} × ${e(kurz(m.slug))}</h2>${fiktiv(true)}</div></div>
<a class="navbtn profil-link" href="${u(`persona/${p.slug}/`)}">📋 Vollständiges Profil von ${e(p.name)} →</a>
${wechsel}
<h3 class="abschnitt">Einordnung zu den Parteien</h3><div class="qtab">${rows}</div>`);
  }
  // Modell × Partei → Personas
  for (const pa of parteienMit(m.slug)) {
    const wechsel = modellWechsler(m.slug, SIG.filter((x) => ergsMPa(x.slug, pa).length).map((x) => x.slug), (s) => `modell/${m.slug}/vs/${s}/partei/${pa}/`);
    const rows = PERSONAS.map((p) => { const a = erg(m.slug, p.slug, pa); if (!a) return ""; return `<a class="qrow" href="${u(`modell/${m.slug}/persona/${p.slug}/partei/${pa}/`)}">${avatarImg(p, "avatar mini")}<div class="qname"><strong>${e(p.name)}</strong>${fiktiv()}</div>${urteilPill(a.gesamt.score)}${gsBalken(a.besonders_gut.length, a.besonders_schlecht.length)}</a>`; }).join("");
    add(`modell/${m.slug}/partei/${pa}/`, `${parteiName(pa)} × ${kurz(m.slug)} · #LTW26`, `Wie ${kurz(m.slug)} die Lebenslagen zur ${parteiName(pa)} einordnet.`, `${krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug), href: `modell/${m.slug}/` }, { kat: true, label: "Partei" }, { label: parteiName(pa) }])}<h2>${e(kurz(m.slug))}: ${e(parteiName(pa))} aus Sicht der Lebenslagen</h2>${wechsel}<div class="qtab">${rows}</div>`);
  }
  // Paarweise Modell-Vergleiche (Split A vs B)
  for (const o of SIG) {
    if (o.slug === m.slug) continue;
    const wechselVs = modellWechsler(o.slug, SIG.map((x) => x.slug).filter((s) => s !== m.slug), (s) => `modell/${m.slug}/vs/${s}/`);
    const kopfVs = (unter: string) => `<h2>${e(kurz(m.slug))} <span class="vsx">vs</span> ${e(kurz(o.slug))}${unter}</h2><p class="infozeile">Zwei Modelle direkt nebeneinander — Δ zeigt, wie stark das Urteil vom Modell abhängt.</p>`;
    const bcVs = (last: { kat?: boolean; label: string; href?: string }[]) => krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug), href: `modell/${m.slug}/` }, { kat: true, label: "Vergleich" }, { label: `${kurz(m.slug)} vs ${kurz(o.slug)}`, href: `modell/${m.slug}/vs/${o.slug}/` }, ...last]);
    // Personas-Querschnitt A vs B
    {
      const rows = PERSONAS.map((p) => {
        const a = ergsMP(m.slug, p.slug), b = ergsMP(o.slug, p.slug);
        if (!a.length && !b.length) return "";
        return `<a class="qrow" href="${u(`modell/${m.slug}/vs/${o.slug}/persona/${p.slug}/`)}">${avatarImg(p, "avatar mini")}<div class="qname"><strong>${e(p.name)}</strong>${fiktiv()}</div>${vsScores(a.length ? avg(a.map((x) => x.gesamt.score)) : NaN, b.length ? avg(b.map((x) => x.gesamt.score)) : NaN)}</a>`;
      }).join("");
      add(`modell/${m.slug}/vs/${o.slug}/`, `${kurz(m.slug)} vs ${kurz(o.slug)} · #LTW26`, `Modellvergleich ${kurz(m.slug)} gegen ${kurz(o.slug)}: Urteile über die Lebenslagen im direkten Δ-Vergleich.`, `${krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug), href: `modell/${m.slug}/` }, { kat: true, label: "Vergleich" }, { label: `${kurz(m.slug)} vs ${kurz(o.slug)}` }])}${kopfVs("")}${wechselVs}<h3 class="sektion">Personas (Ø über Parteien)</h3><div class="qtab">${rows}</div>`);
    }
    // A vs B je Persona → Parteien (Zeile → paarweises Blatt)
    for (const p of PERSONAS) {
      if (!ergsMP(m.slug, p.slug).length && !ergsMP(o.slug, p.slug).length) continue;
      const rows = parteienMit(m.slug).map((pa) => { const a = erg(m.slug, p.slug, pa), b = erg(o.slug, p.slug, pa); return `<a class="qrow" href="${u(`modell/${m.slug}/vs/${o.slug}/persona/${p.slug}/partei/${pa}/`)}"><strong class="qpartei">${e(parteiName(pa))}</strong>${vsScores(a ? a.gesamt.score : NaN, b ? b.gesamt.score : NaN)}</a>`; }).join("");
      add(`modell/${m.slug}/vs/${o.slug}/persona/${p.slug}/`, `${p.name}: ${kurz(m.slug)} vs ${kurz(o.slug)} · #LTW26`, `${p.name} im Modellvergleich ${kurz(m.slug)} gegen ${kurz(o.slug)} über die Parteien.`, `${bcVs([{ kat: true, label: "Persona" }, { label: p.name }])}<div class="detail-kopf">${avatarImg(p, "avatar gross")}<div>${kopfVs(` — ${e(p.name)}`)}${fiktiv(true)}</div></div><a class="navbtn profil-link" href="${u(`persona/${p.slug}/`)}">📋 Vollständiges Profil von ${e(p.name)} →</a><p class="mini">Klick auf eine Zeile → beide Modelle für diese Persona × Partei im Detail.</p><div class="qtab">${rows}</div>`);
    }
    // A vs B je Partei → Personas (Zeile → paarweises Blatt)
    for (const pa of parteienMit(m.slug)) {
      const rows = PERSONAS.map((p) => { const a = erg(m.slug, p.slug, pa), b = erg(o.slug, p.slug, pa); if (!a && !b) return ""; return `<a class="qrow" href="${u(`modell/${m.slug}/vs/${o.slug}/persona/${p.slug}/partei/${pa}/`)}">${avatarImg(p, "avatar mini")}<div class="qname"><strong>${e(p.name)}</strong>${fiktiv()}</div>${vsScores(a ? a.gesamt.score : NaN, b ? b.gesamt.score : NaN)}</a>`; }).join("");
      add(`modell/${m.slug}/vs/${o.slug}/partei/${pa}/`, `${parteiName(pa)}: ${kurz(m.slug)} vs ${kurz(o.slug)} · #LTW26`, `${parteiName(pa)} im Modellvergleich ${kurz(m.slug)} gegen ${kurz(o.slug)} über die Lebenslagen.`, `${bcVs([{ kat: true, label: "Partei" }, { label: parteiName(pa) }])}${kopfVs(` — ${e(parteiName(pa))}`)}<div class="qtab">${rows}</div>`);
    }
    // Paarweises Blatt A vs B (Persona × Partei, zwei Spalten mit Belegen)
    for (const p of PERSONAS) for (const pa of parteienMit(m.slug)) {
      const a = erg(m.slug, p.slug, pa), b = erg(o.slug, p.slug, pa);
      if (!a && !b) continue;
      const liste = (arr: any[], cls: string, lab: string) => arr.length ? `<h4 class="${cls}">${lab}</h4>${arr.map((h) => highlightHtml(h, "sachsen-anhalt", pa)).join("")}` : "";
      const spalte = (x: Erg | undefined, name: string) => x ? `<div class="blattspalte"><div class="bs-kopf"><strong>${e(name)}</strong>${urteilPill(x.gesamt.score)}${gsBalken(x.besonders_gut.length, x.besonders_schlecht.length)}</div>${kiBadge(x)}<p class="zusammenfassung">${e(x.gesamt.zusammenfassung)}</p>${liste(x.besonders_gut, "gut", "👍 Besonders gut")}${liste(x.besonders_schlecht, "schlecht", "👎 Besonders schlecht")}</div>` : `<div class="blattspalte"><div class="bs-kopf"><strong>${e(name)}</strong></div><p class="meta">Keine Auswertung.</p></div>`;
      const dScore = a && b ? Math.abs(a.gesamt.score - b.gesamt.score) : NaN;
      add(`modell/${m.slug}/vs/${o.slug}/persona/${p.slug}/partei/${pa}/`, `${p.name} × ${parteiName(pa)}: ${kurz(m.slug)} vs ${kurz(o.slug)} · #LTW26`, `${p.name} × ${parteiName(pa)} im direkten Modellvergleich ${kurz(m.slug)} gegen ${kurz(o.slug)} — belegte Urteile nebeneinander.`, `${bcVs([{ kat: true, label: "Persona" }, { label: p.name, href: `modell/${m.slug}/vs/${o.slug}/persona/${p.slug}/` }, { kat: true, label: "Partei" }, { label: parteiName(pa) }])}
<div class="detail-kopf">${avatarImg(p, "avatar gross")}<div>${kopfVs(` — ${e(p.name)} × ${e(parteiName(pa))}`)}${fiktiv(true)}${isNaN(dScore) ? "" : `<p class="einzeiler">Δ Modell-Urteil: ${dScore} (Skala −2…+2)</p>`}</div></div>
<a class="navbtn profil-link" href="${u(`persona/${p.slug}/`)}">📋 Vollständiges Profil von ${e(p.name)} →</a>
<div class="vergleich-grid" style="grid-template-columns:1fr 1fr">${spalte(a, kurz(m.slug))}${spalte(b, kurz(o.slug))}</div>`);
    }
  }
  // Blatt
  for (const p of PERSONAS) for (const pa of parteienMit(m.slug)) {
    const a = erg(m.slug, p.slug, pa); if (!a) continue;
    const liste = (arr: any[], cls: string, label: string) => arr.length ? `<h4 class="${cls}">${label}</h4>${arr.map((h) => highlightHtml(h, "sachsen-anhalt", pa)).join("")}` : "";
    add(`modell/${m.slug}/persona/${p.slug}/partei/${pa}/`, `${p.name} × ${parteiName(pa)} × ${kurz(m.slug)} · #LTW26`, `KI-Urteil (${kurz(m.slug)}): Wie die Persona ${p.name} das ${parteiName(pa)}-Wahlprogramm sieht — belegt mit Seite und Zitat.`, `${krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug), href: `modell/${m.slug}/` }, { kat: true, label: "Persona" }, { label: p.name, href: `modell/${m.slug}/persona/${p.slug}/` }, { kat: true, label: "Partei" }, { label: parteiName(pa) }])}
<div class="detail-kopf">${avatarImg(p, "avatar gross")}<div><h2>${e(p.name)} × ${e(parteiName(pa))}</h2>${fiktiv(true)}</div></div>
<a class="navbtn profil-link" href="${u(`persona/${p.slug}/`)}">📋 Vollständiges Profil von ${e(p.name)} →</a>
${modellWechsler(m.slug, SIG.filter((x) => erg(x.slug, p.slug, pa)).map((x) => x.slug), (s) => `modell/${m.slug}/vs/${s}/persona/${p.slug}/partei/${pa}/`)}
<div class="bs-kopf"><strong>${e(kurz(m.slug))}</strong><span class="uk-lab">Modell-Urteil</span>${urteilPill(a.gesamt.score)}${hilfe("modell-urteil", "Modell-Urteil: holistische Gesamteinschätzung des Modells")}<span class="uk-lab">KI-Urteile-Saldo</span>${gsBalken(a.besonders_gut.length, a.besonders_schlecht.length)}${hilfe("ki-urteile-saldo", "KI-Urteile-Saldo: Anzahl positiver/negativer belegter Punkte")}</div>${kiBadge(a)}
<p class="mini">Das <strong>Modell-Urteil</strong> ist die holistische Gesamteinschätzung des Modells; der <strong>KI-Urteile-Saldo</strong> zählt die belegten Plus-/Minuspunkte. <a href="${u("methodik/ki-modelle/")}">Was die Zahlen bedeuten</a></p>
<p class="zusammenfassung">${e(a.gesamt.zusammenfassung)}</p>
${liste(a.besonders_gut, "gut", "👍 Besonders gut")}${liste(a.besonders_schlecht, "schlecht", "👎 Besonders schlecht")}`);
  }
}

// Divergenz-Übersicht
{
  const rows = DIVERGENZ.slice(0, 80).map((d) => { const p = persona(d.persona); const sc = SIG.filter((m) => d.scores[m.slug] !== undefined).map((m) => `<a class="divscore" href="${u(`modell/${m.slug}/persona/${d.persona}/partei/${d.partei}/`)}" style="border-color:${scoreFarbe(d.scores[m.slug])}" title="${e(kurz(m.slug))} für ${e(p?.name ?? d.persona)} × ${e(parteiName(d.partei))} ansehen (Urteil ${scoreTxt(d.scores[m.slug])})">${e(kurz(m.slug))}: ${e(urteilLabel(d.scores[m.slug]))}</a>`).join(""); return `<div class="qrow static"><strong class="qname">${e(p?.name ?? d.persona)} × ${e(parteiName(d.partei))}</strong><span class="divscores">${sc}</span><span class="spanne" title="Spanne (Divergenz) ${d.spanne} von 0–4">${e(spanneLabel(d.spanne))}</span></div>`; }).join("");
  add("vergleich/", "Wo sich die Modelle uneinig sind · #LTW26", "Wo hängt das KI-Urteil am stärksten vom gewählten Modell ab? Divergenz der Modelle über alle Personas und Parteien.", `${krume([{ label: "Start", href: "" }, { label: "Modell-Vergleich" }])}<h2>Wo sind sich die Modelle uneinig?</h2><p class="infozeile">Je größer die Spannweite der Urteile über die Modelle, desto stärker hängt die Bewertung vom gewählten Modell ab — hier wird der Modell-Bias am deutlichsten.</p><div class="qtab">${rows}</div>`);
}

// (Die frühere „alle Modelle nebeneinander"-Seite wurde entfernt — Vergleiche laufen
//  paarweise A vs B innerhalb der Modell-Struktur, siehe modell/A/vs/B/… )

/* ---------- Avatare als PNG ---------- */
async function avatare() {
  const gen = await import("@retro-antlitz-kartei/generator");
  const dir = join(OUT, "assets", "avatare"); mkdirSync(dir, { recursive: true });
  const S = 4;
  for (const p of PERSONAS) {
    const cfg = p.profil?.gesicht?.config ? gen.normalizeConfig(p.profil.gesicht.config) : gen.configFromSeed(p.slug);
    const small = createCanvas(32, 40); gen.renderAvatar(small, cfg);
    // Figur vertikal zentrieren: Bounding-Box gegen die Hintergrundfarbe bestimmen.
    const { data } = small.getContext("2d").getImageData(0, 0, 32, 40);
    const bg = [data[0], data[1], data[2]];
    const isBg = (x: number, y: number) => { const i = (y * 32 + x) * 4; return Math.abs(data[i] - bg[0]) < 8 && Math.abs(data[i + 1] - bg[1]) < 8 && Math.abs(data[i + 2] - bg[2]) < 8; };
    let minY = 40, maxY = -1;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) if (!isBg(x, y)) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const shift = maxY >= 0 ? Math.round(20 - (minY + maxY) / 2) : 0;
    const big = createCanvas(32 * S, 40 * S); const ctx = big.getContext("2d"); (ctx as any).imageSmoothingEnabled = false;
    ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`; ctx.fillRect(0, 0, 32 * S, 40 * S);
    const img = await loadImage(small.toBuffer("image/png"));
    ctx.drawImage(img, 0, 0, 32, 40, 0, shift * S, 32 * S, 40 * S);
    writeFileSync(join(dir, `${p.slug}.png`), big.toBuffer("image/png"));
  }
}

/* ---------- Schreiben ---------- */
async function main() {
  rmSync(OUT, { recursive: true, force: true }); // alte Seiten entfernen (keine Karteileichen)
  mkdirSync(OUT, { recursive: true });
  for (const s of seiten) {
    const dir = join(OUT, s.pfad); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), layout(s.titel, s.beschr, s.body), "utf8");
  }
  mkdirSync(join(OUT, "assets"), { recursive: true });
  cpSync(join(ROOT, "src", "site", "style.css"), join(OUT, "assets", "style.css"));
  try { await avatare(); } catch (err) { console.warn("⚠ Avatar-Rendering übersprungen:", (err as Error).message); }
  // .nojekyll, damit GitHub Pages Ordner mit _ nicht ignoriert
  writeFileSync(join(OUT, ".nojekyll"), "");
  console.log(`SSG: ${seiten.length} Seiten + ${PERSONAS.length} Avatare → ${OUT}  (Base ${BASE})`);
}
main();
