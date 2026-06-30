/**
 * Static Site Generator: rendert echte HTML-Seiten (Ordner mit index.html) pro Route.
 * Keine Hash-Routen, kein großes JS-Bundle — jede Seite trägt nur ihre Daten.
 * Avatare werden serverseitig als PNG vorgerendert (node-canvas + OffscreenCanvas-Polyfill).
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
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
const u = (p: string) => BASE + p.replace(/^\//, "");
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

interface Persona { slug: string; name: string; themen: string[]; profil: Record<string, any>; bevoelkerung: any | null; einzeiler: string; }
const PERSONAS: Persona[] = ladePersonas().map((p) => ({
  slug: p.slug, name: p.name, themen: p.themen, profil: p.roh,
  einzeiler: (p.roh.einzeiler as string) ?? "",
  bevoelkerung: existsSync(join(BEVOELKERUNG_DIR, `${p.slug}.yaml`)) ? YAML.parse(readFileSync(join(BEVOELKERUNG_DIR, `${p.slug}.yaml`), "utf8")) : null,
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
const gsBalken = (g: number, s: number) => `<span class="gsbalken">${g ? `<span class="gs-gut" style="flex:${g}"></span>` : ""}${s ? `<span class="gs-schlecht" style="flex:${s}"></span>` : ""}<span class="gs-zahl">+${g}/−${s}</span></span>`;
const fiktiv = (gross = false) => `<span class="fiktiv${gross ? " gross" : ""}">${gross ? "fiktive Persona – keine reale Person" : "fiktiv"}</span>`;

function krume(segs: { kat?: boolean; label: string; href?: string }[]): string {
  return `<nav class="brotkrume">${segs.map((s, i) => (i ? `<span class="bc-sep">›</span>` : "") + (s.href ? `<a href="${u(s.href)}">${e(s.label)}</a>` : `<span class="${s.kat ? "bc-kat" : "bc-akt"}">${e(s.label)}</span>`)).join("")}</nav>`;
}

function layout(titel: string, beschreibung: string, body: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(titel)}</title><meta name="description" content="${e(beschreibung)}">
<meta property="og:title" content="${e(titel)}"><meta property="og:description" content="${e(beschreibung)}">
<link rel="stylesheet" href="${u("assets/style.css")}"></head><body>
<header class="kopf"><a href="${u("")}" class="logo">Personas</a><span class="kopf-sub">ein KanzlerClash #LTW26 Projekt — KI-Urteile über Wahlprogramme (Sachsen-Anhalt)</span></header>
<div class="ai-act" role="note">⚠ <strong>KI-generierte Inhalte.</strong> Die Bewertungen stammen von KI-Modellen, beziehen sich auf <strong>fiktive Personas</strong> (keine realen Personen) und können Fehler und Verzerrungen (Bias) enthalten. <strong>Keine Wahlempfehlung</strong> — dient der politischen Bildung. Parteizitate dienen als Beleg (Urheberrecht der Parteien).</div>
<main>${body}</main>
<footer class="fuss">Stand: ${new Date().toLocaleDateString("de-DE")} · ${ERG.length} KI-Urteile · Daten unter CC-BY-SA · <a href="https://github.com/kanzlerclash/personas">Quellcode &amp; Methodik</a> · Transparenz gem. EU-KI-VO Art. 50</footer>
</body></html>`;
}

const sigZeile = (l: string, w: string, farbe?: string) => `<div class="sigzeile"><span class="sz-l">${e(l)}</span><span class="sz-w"${farbe ? ` style="color:${farbe}"` : ""}>${e(w)}</span></div>`;

function highlightHtml(h: any): string {
  const beleg = h.zitat ? `<p class="belegzeile"><span class="beleg ${h.beleg_ok === true ? "ok" : h.beleg_ok === false ? "fehler" : "offen"}">${h.beleg_ok === true ? "✓ belegt" : h.beleg_ok === false ? "⚠ ungeprüft" : "•"}</span> S. ${e(h.seite ?? "?")}: „${e(h.zitat)}"</p>` : "";
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
    const q = (p.bevoelkerung.quellen ?? []).map((x: any) => `<li>${x.url ? `<a href="${e(x.url)}" target="_blank" rel="noopener">${e((x.herausgeber ?? x.titel) + ": " + (x.wert ?? ""))}</a>` : e((x.herausgeber ?? x.titel) + ": " + (x.wert ?? ""))}</li>`).join("");
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
  const fluss = `<div class="fluss"><div class="fl-box"><strong>${PERSONAS.length} Lebenslagen</strong><span>fiktive Personas</span><strong>${PARTEIEN.length} Wahlprogramme</strong><span>Sachsen-Anhalt</span></div><div class="fl-pfeil">→</div><div class="fl-box"><strong>${SIG.length} KI-Modelle</strong><span>${e(SIG.map((m) => kurz(m.slug)).join(" · "))}</span></div><div class="fl-pfeil">→</div><div class="fl-box"><strong>${ERG.length} KI-Urteile</strong><span>je mit Seite + Zitat belegt</span></div></div>`;
  const karten = SIG.map((m) => `<a class="sigkarte" href="${u(`modell/${m.slug}/`)}"><h4>${e(kurz(m.slug))}</h4><div class="sig-modell">${e(m.name)}</div><div class="sig-zahlen">${sigZeile("Ø-Urteil", scoreTxt(m.avgScore), scoreFarbe(m.avgScore))}${sigZeile("Kritik-Quote", Math.round(m.kritikQuote * 100) + " %", scoreFarbe(2 - m.kritikQuote * 4))}${sigZeile("Tonalität", m.labels.ton)}${sigZeile("Ø Punkte/Urteil", String(m.avgHighlights))}</div><div class="sig-label">${e(m.labels.kritik + ", " + m.labels.ton)} · ${m.anzahl} Urteile</div><span class="sig-cta">→ Personas ansehen</span></a>`).join("");
  const body = `<section class="hero"><h2>Wie urteilen KI-Modelle über die Wahlprogramme?</h2>${fluss}</section>
<div class="infobox"><strong>Was ist Modell-Bias?</strong> Alle Modelle lesen dieselben Programme aus Sicht derselben fiktiven Personas — und urteilen trotzdem unterschiedlich streng und kritisch. Dieses Urteil hängt vom <em>Modell</em> (und seiner Version) ab. Wähle ein Modell und sieh selbst.</div>
<h3 class="abschnitt">Die Modelle und ihr Bias</h3><div class="sig-grid">${karten}</div>
<div class="unternav"><a class="navbtn" href="${u("vergleich/")}">⚖ Wo sind sich die Modelle uneinig?</a><a class="navbtn" href="${u("personas/")}">👤 Nach Persona einsteigen</a></div>`;
  add("", "Personas — ein KanzlerClash #LTW26 Projekt", "Wie urteilen verschiedene KI-Modelle über die Wahlprogramme zur Landtagswahl 2026 (Sachsen-Anhalt)? Modell-Vergleich, Bias-Signaturen, belegte Quellen. Keine Wahlempfehlung.", body);
}

// Personas-Liste
{
  const grid = PERSONAS.map((p) => `<a class="karte" href="${u(`persona/${p.slug}/`)}">${avatarImg(p)}<h3>${e(p.name)}</h3>${p.einzeiler ? `<p class="einzeiler">${e(p.einzeiler)}</p>` : ""}<div class="themen">${p.themen.map((t) => chip(themaName(t))).join("")}</div>${fiktiv()}</a>`).join("");
  add("personas/", "Alle Personas · Personas #LTW26", "Die 16 fiktiven Lebenslagen im Überblick.", `${krume([{ label: "Start", href: "" }, { label: "Alle Personas" }])}<h2>Nach Persona einsteigen</h2><p class="infozeile">Wähle eine Lebenslage — auf ihrer Profilseite findest du Details und die Einschätzungen der Modelle.</p><div class="raster">${grid}</div>`);
}

// Persona-Profil
for (const p of PERSONAS) {
  const modelle = SIG.filter((m) => ergsMP(m.slug, p.slug).length);
  const karten = modelle.map((m) => { const es = ergsMP(m.slug, p.slug); const sc = avg(es.map((x) => x.gesamt.score)); return `<a class="sigkarte" href="${u(`modell/${m.slug}/persona/${p.slug}/`)}"><h4>${e(kurz(m.slug))}</h4><div class="sig-modell">${es.length} Parteien bewertet</div><div class="sig-zahlen">${sigZeile("Ø-Urteil", scoreTxt(sc), scoreFarbe(sc))}${sigZeile("Punkte +/−", `+${es.reduce((s, x) => s + x.besonders_gut.length, 0)} / −${es.reduce((s, x) => s + x.besonders_schlecht.length, 0)}`)}</div><span class="sig-cta">→ Einschätzung ansehen</span></a>`; }).join("");
  const body = `${krume([{ label: "Start", href: "" }, { kat: true, label: "Persona" }, { label: p.name }])}
<div class="detail-kopf">${avatarImg(p, "avatar gross")}<div><h2>${e(p.name)}</h2>${fiktiv(true)}${p.einzeiler ? `<p class="einzeiler">${e(p.einzeiler)}</p>` : ""}<div class="themen">${p.themen.map((t) => chip(themaName(t))).join("")}</div></div></div>
${modelle.length ? `<h3 class="abschnitt">Wie die Modelle diese Persona einordnen</h3><div class="sig-grid">${karten}</div>` : ""}
${profilBlock(p)}`;
  add(`persona/${p.slug}/`, `${p.name} · Profil · Personas #LTW26`, `Profil der fiktiven Persona ${p.name} und wie KI-Modelle sie zu den Wahlprogrammen einordnen.`, body);
}

// Modell → Personas & Modell → Parteien & tiefer
for (const m of SIG) {
  const sigBanner = `<div class="sigbanner"><span>Ø-Urteil </span>${scorePill(m.avgScore)}<span class="sb-sep">· Kritik-Quote ${Math.round(m.kritikQuote * 100)} % · ${e(m.labels.kritik)}, ${e(m.labels.ton)}</span></div>`;
  const toggle = (akt: "persona" | "partei") => `<div class="ebtoggle"><span class="ebt-l">Querschnitt:</span><a class="ebt${akt === "persona" ? " an" : ""}" href="${u(`modell/${m.slug}/`)}">nach Persona</a><a class="ebt${akt === "partei" ? " an" : ""}" href="${u(`modell/${m.slug}/parteien/`)}">nach Partei</a></div>`;

  // Personas-Querschnitt
  {
    const rows = PERSONAS.map((p) => { const es = ergsMP(m.slug, p.slug); if (!es.length) return ""; const sc = avg(es.map((x) => x.gesamt.score)); return `<a class="qrow" href="${u(`modell/${m.slug}/persona/${p.slug}/`)}">${avatarImg(p, "avatar mini")}<div class="qname"><strong>${e(p.name)}</strong>${fiktiv()}</div>${scorePill(sc)}${gsBalken(es.reduce((s, x) => s + x.besonders_gut.length, 0), es.reduce((s, x) => s + x.besonders_schlecht.length, 0))}</a>`; }).join("");
    add(`modell/${m.slug}/`, `${kurz(m.slug)}: Sicht auf die Lebenslagen · #LTW26`, `Wie ${kurz(m.slug)} die 16 fiktiven Lebenslagen zu den Wahlprogrammen einordnet.`, `${krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug) }])}<h2>${e(kurz(m.slug))}: Sicht auf die ${PERSONAS.length} Lebenslagen</h2>${sigBanner}${toggle("persona")}<div class="qtab">${rows}</div>`);
  }
  // Parteien-Querschnitt
  {
    const rows = parteienMit(m.slug).map((pa) => { const es = ergsMPa(m.slug, pa); return `<a class="qrow" href="${u(`modell/${m.slug}/partei/${pa}/`)}"><strong class="qpartei">${e(parteiName(pa))}</strong>${scorePill(avg(es.map((x) => x.gesamt.score)))}${gsBalken(es.reduce((s, x) => s + x.besonders_gut.length, 0), es.reduce((s, x) => s + x.besonders_schlecht.length, 0))}</a>`; }).join("");
    add(`modell/${m.slug}/parteien/`, `${kurz(m.slug)}: Sicht auf die Parteien · #LTW26`, `Wie ${kurz(m.slug)} die Parteien über alle Lebenslagen einordnet.`, `${krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug), href: `modell/${m.slug}/` }, { label: "Partei" }])}<h2>${e(kurz(m.slug))}: Sicht auf die Parteien</h2>${sigBanner}${toggle("partei")}<div class="qtab">${rows}</div>`);
  }
  // Modell × Persona → Parteien
  for (const p of PERSONAS) {
    const es = ergsMP(m.slug, p.slug); if (!es.length) continue;
    const rows = parteienMit(m.slug).map((pa) => { const a = erg(m.slug, p.slug, pa); if (!a) return ""; return `<a class="qrow" href="${u(`modell/${m.slug}/persona/${p.slug}/partei/${pa}/`)}"><strong class="qpartei">${e(parteiName(pa))}</strong>${scorePill(a.gesamt.score)}${gsBalken(a.besonders_gut.length, a.besonders_schlecht.length)}</a>`; }).join("");
    add(`modell/${m.slug}/persona/${p.slug}/`, `${p.name} × ${kurz(m.slug)} · #LTW26`, `Wie ${kurz(m.slug)} die Persona ${p.name} zu den Parteien einordnet.`, `${krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug), href: `modell/${m.slug}/` }, { kat: true, label: "Persona" }, { label: p.name }])}
<div class="detail-kopf">${avatarImg(p, "avatar gross")}<div><h2>${e(p.name)} × ${e(kurz(m.slug))}</h2>${fiktiv(true)}</div></div>
<a class="navbtn profil-link" href="${u(`persona/${p.slug}/`)}">📋 Vollständiges Profil von ${e(p.name)} →</a>
<h3 class="abschnitt">Einordnung zu den Parteien</h3><div class="qtab">${rows}</div>`);
  }
  // Modell × Partei → Personas
  for (const pa of parteienMit(m.slug)) {
    const rows = PERSONAS.map((p) => { const a = erg(m.slug, p.slug, pa); if (!a) return ""; return `<a class="qrow" href="${u(`modell/${m.slug}/persona/${p.slug}/partei/${pa}/`)}">${avatarImg(p, "avatar mini")}<div class="qname"><strong>${e(p.name)}</strong>${fiktiv()}</div>${scorePill(a.gesamt.score)}${gsBalken(a.besonders_gut.length, a.besonders_schlecht.length)}</a>`; }).join("");
    add(`modell/${m.slug}/partei/${pa}/`, `${parteiName(pa)} × ${kurz(m.slug)} · #LTW26`, `Wie ${kurz(m.slug)} die Lebenslagen zur ${parteiName(pa)} einordnet.`, `${krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug), href: `modell/${m.slug}/` }, { kat: true, label: "Partei" }, { label: parteiName(pa) }])}<h2>${e(kurz(m.slug))}: ${e(parteiName(pa))} aus Sicht der Lebenslagen</h2><div class="qtab">${rows}</div>`);
  }
  // Blatt
  for (const p of PERSONAS) for (const pa of parteienMit(m.slug)) {
    const a = erg(m.slug, p.slug, pa); if (!a) continue;
    const liste = (arr: any[], cls: string, label: string) => arr.length ? `<h4 class="${cls}">${label}</h4>${arr.map(highlightHtml).join("")}` : "";
    add(`modell/${m.slug}/persona/${p.slug}/partei/${pa}/`, `${p.name} × ${parteiName(pa)} × ${kurz(m.slug)} · #LTW26`, `KI-Urteil (${kurz(m.slug)}): Wie die Persona ${p.name} das ${parteiName(pa)}-Wahlprogramm sieht — belegt mit Seite und Zitat.`, `${krume([{ label: "Start", href: "" }, { kat: true, label: "Modell" }, { label: kurz(m.slug), href: `modell/${m.slug}/` }, { kat: true, label: "Persona" }, { label: p.name, href: `modell/${m.slug}/persona/${p.slug}/` }, { kat: true, label: "Partei" }, { label: parteiName(pa) }])}
<div class="detail-kopf">${avatarImg(p, "avatar gross")}<div><h2>${e(p.name)} × ${e(parteiName(pa))}</h2>${fiktiv(true)}</div></div>
<div class="bs-kopf"><strong>${e(kurz(m.slug))}</strong>${scorePill(a.gesamt.score)}</div>${kiBadge(a)}
<p class="zusammenfassung">${e(a.gesamt.zusammenfassung)}</p>
${liste(a.besonders_gut, "gut", "👍 Besonders gut")}${liste(a.besonders_schlecht, "schlecht", "👎 Besonders schlecht")}
<p><a class="navbtn" href="${u(`vergleich/${p.slug}/${pa}/`)}">⚖ Alle Modelle für ${e(p.name)} × ${e(parteiName(pa))} vergleichen →</a></p>`);
  }
}

// Divergenz-Übersicht
{
  const rows = DIVERGENZ.slice(0, 80).map((d) => { const p = persona(d.persona); const sc = SIG.filter((m) => d.scores[m.slug] !== undefined).map((m) => `<span class="divscore" style="border-color:${scoreFarbe(d.scores[m.slug])}">${e(kurz(m.slug))} ${e(scoreTxt(d.scores[m.slug]))}</span>`).join(""); return `<a class="qrow" href="${u(`vergleich/${d.persona}/${d.partei}/`)}"><strong class="qname">${e(p?.name ?? d.persona)} × ${e(parteiName(d.partei))}</strong><span class="divscores">${sc}</span><span class="spanne">${d.spanne === 0 ? "Konsens" : "Δ" + d.spanne}</span></a>`; }).join("");
  add("vergleich/", "Wo sich die Modelle uneinig sind · #LTW26", "Wo hängt das KI-Urteil am stärksten vom gewählten Modell ab? Divergenz der Modelle über alle Personas und Parteien.", `${krume([{ label: "Start", href: "" }, { label: "Modell-Vergleich" }])}<h2>Wo sind sich die Modelle uneinig?</h2><p class="infozeile">Je größer die Spannweite der Urteile über die Modelle, desto stärker hängt die Bewertung vom gewählten Modell ab — hier wird der Modell-Bias am deutlichsten.</p><div class="qtab">${rows}</div>`);
}

// Alle-Modelle-Vergleich je Persona × Partei (statischer „Split")
for (const [k, arr] of gruppen) {
  const [pslug, , pa] = k.split("|"); const p = persona(pslug);
  const spalten = arr.sort((a, b) => SLUGS.indexOf(a.modell_slug) - SLUGS.indexOf(b.modell_slug)).map((x) => {
    const liste = (a: any[], cls: string, lab: string) => a.length ? `<h4 class="${cls}">${lab}</h4>${a.map(highlightHtml).join("")}` : "";
    return `<div class="blattspalte"><div class="bs-kopf"><strong>${e(kurz(x.modell_slug))}</strong>${scorePill(x.gesamt.score)}</div>${kiBadge(x)}<p class="zusammenfassung">${e(x.gesamt.zusammenfassung)}</p>${liste(x.besonders_gut, "gut", "👍 Besonders gut")}${liste(x.besonders_schlecht, "schlecht", "👎 Besonders schlecht")}</div>`;
  }).join("");
  add(`vergleich/${pslug}/${pa}/`, `${p.name} × ${parteiName(pa)}: Modelle im Vergleich · #LTW26`, `Alle KI-Modelle nebeneinander: Wie sehen sie ${p.name} × ${parteiName(pa)}? Modell-Bias direkt vergleichbar.`, `${krume([{ label: "Start", href: "" }, { label: "Modell-Vergleich", href: "vergleich/" }, { label: `${p.name} × ${parteiName(pa)}` }])}
<div class="detail-kopf">${avatarImg(p, "avatar gross")}<div><h2>${e(p.name)} × ${e(parteiName(pa))}</h2>${fiktiv(true)}<p class="einzeiler">Alle Modelle im direkten Vergleich</p></div></div>
<div class="vergleich-grid" style="grid-template-columns:repeat(${arr.length},1fr)">${spalten}</div>`);
}

/* ---------- Avatare als PNG ---------- */
async function avatare() {
  const gen = await import("@retro-antlitz-kartei/generator");
  const dir = join(OUT, "assets", "avatare"); mkdirSync(dir, { recursive: true });
  for (const p of PERSONAS) {
    const cfg = p.profil?.gesicht?.config ? gen.normalizeConfig(p.profil.gesicht.config) : gen.configFromSeed(p.slug);
    const small = createCanvas(32, 40); gen.renderAvatar(small, cfg);
    const big = createCanvas(128, 160); const ctx = big.getContext("2d"); (ctx as any).imageSmoothingEnabled = false;
    const img = await loadImage(small.toBuffer("image/png")); ctx.drawImage(img, 0, 0, 128, 160);
    writeFileSync(join(dir, `${p.slug}.png`), big.toBuffer("image/png"));
  }
}

/* ---------- Schreiben ---------- */
async function main() {
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
