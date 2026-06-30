import { configFromSeed, renderAvatar, normalizeConfig } from "@retro-antlitz-kartei/generator";
import data from "./data.json";
import "./style.css";

/* ---------------- Typen ---------------- */
type Highlight = {
  titel_selbst: string; thema: string; programmpunkt: string;
  seite: number | null; zitat: string | null; bezug: string; resonanz: string;
  begruendung: string; begruendung_selbst: string; beleg_ok?: boolean | null;
};
type Erg = {
  persona: string; land: string; partei: string; modell: string; modell_slug: string;
  zeitpunkt?: string; programm_stand?: string | null; erzeugt_via?: string;
  gesamt: { zusammenfassung: string; score: number };
  besonders_gut: Highlight[]; besonders_schlecht: Highlight[];
};
type Persona = { slug: string; name: string; einzeiler: string; themen: string[]; profil: Record<string, any>; bevoelkerung: any | null };
type Modell = { slug: string; name: string; anzahl: number; avgScore: number; kritikQuote: number; avgHighlights: number; avgDivergenz: number; ausrufQuote: number; labels: { haltung: string; kritik: string; ton: string } };

const D = data as any;
const MODELLE: Modell[] = D.modelle;
const PERSONAS: Persona[] = D.personas;
const ERG: Erg[] = D.ergebnisse;
const DIVERGENZ: { persona: string; partei: string; land: string; scores: Record<string, number>; spanne: number }[] = D.divergenz;
const LAND = "sachsen-anhalt";

/* ---------------- Helfer ---------------- */
const el = (t: string, c?: string, txt?: string) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
const themaName = (id: string) => D.themen.find((t: any) => t.id === id)?.name ?? id;
const persona = (slug: string) => PERSONAS.find((p) => p.slug === slug);
const modell = (slug: string) => MODELLE.find((m) => m.slug === slug);
const MODELL_LABELS: Record<string, string> = {
  "claude-opus-4-8": "Claude Opus 4.8",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "gemini-3.1-pro": "Gemini 3.1 Pro",
  "gpt-5.5": "GPT 5.5",
};
const kurz = (slug: string) =>
  MODELL_LABELS[slug] ??
  (slug.replace(/-/g, " ").replace(/\b(\d) (\d)\b/g, "$1.$2").replace(/\b\w/g, (c) => c.toUpperCase()) || slug);
const parteiName = (p: string) => (p === "gruene" ? "Grüne" : p.toUpperCase());

const erg = (m: string, p: string, pa: string) => ERG.find((e) => e.modell_slug === m && e.persona === p && e.partei === pa);
const ergsMP = (m: string, p: string) => ERG.filter((e) => e.modell_slug === m && e.persona === p);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const ergsMPa = (m: string, pa: string) => ERG.filter((e) => e.modell_slug === m && e.partei === pa);
const parteienMit = (m: string) => [...new Set(ERG.filter((e) => e.modell_slug === m).map((e) => e.partei))]
  .sort((a, b) => D.parteien.indexOf(a) - D.parteien.indexOf(b));
const personenMit = (m: string) => [...new Set(ERG.filter((e) => e.modell_slug === m).map((e) => e.persona))];

/** Score (−2..+2) → Farbe rot↔grün. */
const scoreFarbe = (s: number) => `hsl(${((s + 2) / 4) * 125} 60% 45%)`;
const scoreTxt = (s: number) => { const r = Math.round(s * 10) / 10; return (r >= 0 ? "+" : "") + r; };

function avatar(p: Persona, klasse: string): HTMLCanvasElement {
  const cv = el("canvas", klasse) as HTMLCanvasElement;
  try { renderAvatar(cv, p.profil?.gesicht?.config ? normalizeConfig(p.profil.gesicht.config) : configFromSeed(p.slug)); } catch { /* */ }
  return cv;
}
const chip = (t: string, cls = "") => el("span", "chip " + cls, t);

/** KI-Act-Kennzeichnung für ein einzelnes KI-Urteil. */
function kiBadge(e: Erg): HTMLElement {
  const b = el("div", "ki-badge");
  b.append(el("span", "ki-dot", "● KI-generiert"));
  const datum = e.zeitpunkt ? new Date(e.zeitpunkt).toLocaleDateString("de-DE") : "";
  b.append(el("span", "", ` ${kurz(e.modell_slug)}${datum ? " · " + datum : ""} · kann Fehler/Bias enthalten`));
  return b;
}

/* ---------------- Steuerleiste / Split ---------------- */
function getQuery(): URLSearchParams { return new URLSearchParams(location.hash.split("?")[1] ?? ""); }
function setVs(slug: string | null) {
  const [pfad] = location.hash.split("?");
  const q = getQuery();
  if (slug) q.set("vs", slug); else q.delete("vs");
  const qs = q.toString();
  location.hash = pfad + (qs ? "?" + qs : "");
}
/** „Modell dazuschalten"-Auswahl (max 2). */
function vergleichLeiste(aktiv: string, vs: string | null): HTMLElement {
  const bar = el("div", "vsbar");
  bar.append(el("span", "vslbl", "Vergleichen mit:"));
  for (const m of MODELLE) {
    if (m.slug === aktiv) continue;
    const b = el("button", "vsbtn" + (vs === m.slug ? " an" : ""), kurz(m.slug));
    b.onclick = () => setVs(vs === m.slug ? null : m.slug);
    bar.append(b);
  }
  if (vs) { const x = el("button", "vsbtn aus", "Vergleich aus ✕"); x.onclick = () => setVs(null); bar.append(x); }
  return bar;
}

/* ---------------- Bausteine ---------------- */
function gutSchlechtBalken(gut: number, schlecht: number): HTMLElement {
  const w = el("span", "gsbalken");
  const g = el("span", "gs-gut"); g.style.flex = String(gut); g.title = gut + "× gut";
  const s = el("span", "gs-schlecht"); s.style.flex = String(schlecht); s.title = schlecht + "× schlecht";
  if (gut) w.append(g); if (schlecht) w.append(s);
  w.append(el("span", "gs-zahl", `+${gut}/−${schlecht}`));
  return w;
}
function scorePill(s: number): HTMLElement { const p = el("span", "scorepill", scoreTxt(s)); p.style.background = scoreFarbe(s); return p; }

/* ---------------- Ansicht: Landing ---------------- */
function landing(root: HTMLElement) {
  // Datenfluss-Hero
  const hero = el("section", "hero");
  const fluss = el("div", "fluss");
  const q = el("div", "fl-box"); q.innerHTML = `<strong>${PERSONAS.length} Lebenslagen</strong><span>fiktive Personas</span><strong>${D.parteien.length} Wahlprogramme</strong><span>Sachsen-Anhalt</span>`;
  const pfeil1 = el("div", "fl-pfeil", "→");
  const m = el("div", "fl-box"); m.innerHTML = `<strong>${MODELLE.length} KI-Modelle</strong><span>${MODELLE.map((x) => kurz(x.slug)).join(" · ")}</span>`;
  const pfeil2 = el("div", "fl-pfeil", "→");
  const r = el("div", "fl-box"); r.innerHTML = `<strong>${ERG.length} KI-Urteile</strong><span>je mit Seite + Zitat belegt</span>`;
  fluss.append(q, pfeil1, m, pfeil2, r);
  hero.append(el("h2", "", "Wie urteilen KI-Modelle über die Wahlprogramme?"), fluss);
  root.append(hero);

  // Bias-Erklärbox
  const ex = el("div", "infobox");
  ex.innerHTML = `<strong>Was ist Modell-Bias?</strong> Alle Modelle lesen dieselben Programme aus Sicht derselben fiktiven Personas — und urteilen trotzdem unterschiedlich streng und unterschiedlich kritisch. Dieses Urteil hängt vom <em>Modell</em> (und seiner Version) ab. Wähle ein Modell und sieh selbst — oder schalte zwei nebeneinander.`;
  root.append(ex);

  // Signatur-Karten
  root.append(el("h3", "abschnitt", "Die Modelle und ihr Bias"));
  const grid = el("div", "sig-grid");
  for (const mo of MODELLE) {
    const k = el("a", "sigkarte") as HTMLAnchorElement;
    k.href = `#/modell/${mo.slug}`;
    k.append(el("h4", "", kurz(mo.slug)));
    k.append(el("div", "sig-modell", mo.name));
    const z = el("div", "sig-zahlen");
    z.append(sigZeile("Ø-Urteil", scoreTxt(mo.avgScore), scoreFarbe(mo.avgScore)));
    z.append(sigZeile("Kritik-Quote", Math.round(mo.kritikQuote * 100) + " %", scoreFarbe(2 - mo.kritikQuote * 4)));
    z.append(sigZeile("Tonalität", mo.labels.ton));
    z.append(sigZeile("Ø Punkte/Urteil", String(mo.avgHighlights)));
    k.append(z);
    k.append(el("div", "sig-label", `${mo.labels.kritik}, ${mo.labels.ton} · ${mo.anzahl} Urteile`));
    k.append(el("span", "sig-cta", "→ Personas ansehen"));
    grid.append(k);
  }
  root.append(grid);

  const nav = el("div", "unternav");
  const v = el("a", "navbtn") as HTMLAnchorElement; v.href = "#/vergleich"; v.textContent = "⚖ Wo sind sich die Modelle uneinig?";
  const pl = el("a", "navbtn") as HTMLAnchorElement; pl.href = "#/personas"; pl.textContent = "👤 Nach Persona einsteigen";
  nav.append(v, pl);
  root.append(nav);
}
function sigZeile(label: string, wert: string, farbe?: string): HTMLElement {
  const z = el("div", "sigzeile"); z.append(el("span", "sz-l", label));
  const w = el("span", "sz-w", wert); if (farbe) w.style.color = farbe; z.append(w); return z;
}

/* ---------------- Ansicht: Modell → Personas ---------------- */
function modellAnsicht(root: HTMLElement, mSlug: string, vs: string | null) {
  const mo = modell(mSlug); if (!mo) return landing(root);
  root.append(brotkrume([bcStart(), bcKat("Modell"), bcCur(kurz(mSlug))]));
  root.append(el("h2", "", `${kurz(mSlug)}: Sicht auf die ${PERSONAS.length} Lebenslagen`));
  root.append(signaturBanner(mo));
  root.append(ebenenToggle(mSlug, "persona", vs));
  root.append(vergleichLeiste(mSlug, vs));

  const tabelle = el("div", "qtab");
  for (const p of PERSONAS) {
    const aErg = ergsMP(mSlug, p.slug);
    const aScore = avg(aErg.map((e) => e.gesamt.score));
    const aGut = aErg.reduce((s, e) => s + e.besonders_gut.length, 0);
    const aSchlecht = aErg.reduce((s, e) => s + e.besonders_schlecht.length, 0);
    const row = el("a", "qrow") as HTMLAnchorElement;
    row.href = `#/modell/${mSlug}/persona/${p.slug}` + (vs ? `?vs=${vs}` : "");
    row.append(avatar(p, "avatar mini"));
    const name = el("div", "qname"); name.append(el("strong", "", p.name)); name.append(el("span", "fiktiv", "fiktiv"));
    row.append(name);
    if (!vs) { row.append(scorePill(aScore)); row.append(gutSchlechtBalken(aGut, aSchlecht)); }
    else {
      const bErg = ergsMP(vs, p.slug); const bScore = avg(bErg.map((e) => e.gesamt.score));
      row.append(splitScores(aScore, bScore));
    }
    tabelle.append(row);
  }
  root.append(tabelle);
}

/** Umschalter „nach Persona / nach Partei" auf der Modell-Ebene. */
function ebenenToggle(mSlug: string, aktiv: "persona" | "partei", vs: string | null): HTMLElement {
  const t = el("div", "ebtoggle");
  const q = vs ? `?vs=${vs}` : "";
  const a = el("a", "ebt" + (aktiv === "persona" ? " an" : ""), "nach Persona") as HTMLAnchorElement;
  a.href = `#/modell/${mSlug}${q}`;
  const b = el("a", "ebt" + (aktiv === "partei" ? " an" : ""), "nach Partei") as HTMLAnchorElement;
  b.href = `#/modell/${mSlug}/parteien${q}`;
  t.append(el("span", "ebt-l", "Querschnitt:"), a, b);
  return t;
}

/* ---------------- Ansicht: Modell → Parteien (Querschnitt) ---------------- */
function modellParteienAnsicht(root: HTMLElement, mSlug: string, vs: string | null) {
  const mo = modell(mSlug); if (!mo) return landing(root);
  root.append(brotkrume([bcStart(), bcKat("Modell"), bcLink(kurz(mSlug), `#/modell/${mSlug}`), bcCur("Partei")]));
  root.append(el("h2", "", `${kurz(mSlug)}: Sicht auf die Parteien`));
  root.append(signaturBanner(mo));
  root.append(ebenenToggle(mSlug, "partei", vs));
  root.append(vergleichLeiste(mSlug, vs));

  const tab = el("div", "qtab");
  for (const pa of parteienMit(mSlug)) {
    const aErg = ergsMPa(mSlug, pa);
    const row = el("a", "qrow") as HTMLAnchorElement;
    row.href = `#/modell/${mSlug}/partei/${pa}` + (vs ? `?vs=${vs}` : "");
    row.append(el("strong", "qpartei", parteiName(pa)));
    if (!vs) { row.append(scorePill(avg(aErg.map((e) => e.gesamt.score)))); row.append(gutSchlechtBalken(aErg.reduce((s, e) => s + e.besonders_gut.length, 0), aErg.reduce((s, e) => s + e.besonders_schlecht.length, 0))); }
    else { row.append(splitScores(avg(aErg.map((e) => e.gesamt.score)), avg(ergsMPa(vs, pa).map((e) => e.gesamt.score)))); }
    tab.append(row);
  }
  root.append(tab);
}

/* ---------------- Ansicht: Modell × Partei → Personas ---------------- */
function parteiAnsicht(root: HTMLElement, mSlug: string, pa: string, vs: string | null) {
  const mo = modell(mSlug); if (!mo) return landing(root);
  root.append(brotkrume([bcStart(), bcKat("Modell"), bcLink(kurz(mSlug), `#/modell/${mSlug}`), bcKat("Partei"), bcCur(parteiName(pa))]));
  root.append(el("h2", "", `${kurz(mSlug)}: ${parteiName(pa)} aus Sicht der ${PERSONAS.length} Lebenslagen`));
  root.append(vergleichLeiste(mSlug, vs));
  const tab = el("div", "qtab");
  for (const p of PERSONAS) {
    const a = erg(mSlug, p.slug, pa); if (!a) continue;
    const row = el("a", "qrow") as HTMLAnchorElement;
    row.href = `#/modell/${mSlug}/partei/${pa}/persona/${p.slug}` + (vs ? `?vs=${vs}` : "");
    row.append(avatar(p, "avatar mini"));
    const name = el("div", "qname"); name.append(el("strong", "", p.name)); name.append(el("span", "fiktiv", "fiktiv")); row.append(name);
    if (!vs) { row.append(scorePill(a.gesamt.score)); row.append(gutSchlechtBalken(a.besonders_gut.length, a.besonders_schlecht.length)); }
    else { const b = erg(vs, p.slug, pa); row.append(splitScores(a.gesamt.score, b ? b.gesamt.score : NaN)); }
    tab.append(row);
  }
  root.append(tab);
}

/* ---------------- Ansicht: Modell × Persona → Parteien ---------------- */
function personaAnsicht(root: HTMLElement, mSlug: string, pSlug: string, vs: string | null) {
  const mo = modell(mSlug); const p = persona(pSlug); if (!mo || !p) return landing(root);
  root.append(brotkrume([bcStart(), bcKat("Modell"), bcLink(kurz(mSlug), `#/modell/${mSlug}`), bcKat("Persona"), bcCur(p.name)]));
  const kopf = el("div", "detail-kopf"); kopf.append(avatar(p, "avatar gross"));
  const ti = el("div"); ti.append(el("h2", "", p.name)); ti.append(el("span", "fiktiv gross", "fiktive Persona – keine reale Person"));
  if (p.einzeiler) ti.append(el("p", "einzeiler", p.einzeiler));
  kopf.append(ti); root.append(kopf);
  root.append(profilLink(p));
  root.append(vergleichLeiste(mSlug, vs));
  root.append(el("h3", "abschnitt", `Wie ${kurz(mSlug)} diese Persona zu den Parteien einordnet`));

  const tab = el("div", "qtab");
  for (const pa of parteienMit(mSlug)) {
    const a = erg(mSlug, pSlug, pa); if (!a) continue;
    const row = el("a", "qrow") as HTMLAnchorElement;
    row.href = `#/modell/${mSlug}/persona/${pSlug}/partei/${pa}` + (vs ? `?vs=${vs}` : "");
    row.append(el("strong", "qpartei", parteiName(pa)));
    if (!vs) { row.append(scorePill(a.gesamt.score)); row.append(gutSchlechtBalken(a.besonders_gut.length, a.besonders_schlecht.length)); }
    else { const b = erg(vs, pSlug, pa); row.append(splitScores(a.gesamt.score, b ? b.gesamt.score : NaN)); }
    tab.append(row);
  }
  root.append(tab);
}

/* ---------------- Ansicht: Blatt (Modell × Persona × Partei) ---------------- */
function highlightKarte(h: Highlight): HTMLElement {
  const box = el("div", "highlight");
  const kopf = el("div", "hl-kopf");
  kopf.append(el("strong", "titel", `„${h.titel_selbst}"`));
  kopf.append(chip(themaName(h.thema)));
  kopf.append(chip(h.bezug === "betrifft_mich" ? "betrifft mich" : "Sicht auf andere"));
  kopf.append(chip(h.resonanz === "bestaetigt" ? "bestätigt" : "konträr"));
  box.append(kopf);
  box.append(el("p", "selbst", h.begruendung_selbst));
  box.append(el("p", "analytisch", h.begruendung));
  if (h.zitat) {
    const b = el("p", "belegzeile");
    const ok = h.beleg_ok; b.append(el("span", "beleg " + (ok === true ? "ok" : ok === false ? "fehler" : "offen"), ok === true ? "✓ belegt" : ok === false ? "⚠ ungeprüft" : "•"));
    b.append(document.createTextNode(` S. ${h.seite ?? "?"}: „${h.zitat}"`));
    box.append(b);
  }
  return box;
}
function blattSpalte(e: Erg | undefined, titel: string): HTMLElement {
  const sp = el("div", "blattspalte");
  const h = el("div", "bs-kopf"); h.append(el("strong", "", titel));
  if (e) { h.append(scorePill(e.gesamt.score)); }
  sp.append(h);
  if (!e) { sp.append(el("p", "meta", "Keine Auswertung.")); return sp; }
  sp.append(kiBadge(e));
  sp.append(el("p", "zusammenfassung", e.gesamt.zusammenfassung));
  if (e.besonders_gut.length) { sp.append(el("h4", "gut", "👍 Besonders gut")); e.besonders_gut.forEach((x) => sp.append(highlightKarte(x))); }
  if (e.besonders_schlecht.length) { sp.append(el("h4", "schlecht", "👎 Besonders schlecht")); e.besonders_schlecht.forEach((x) => sp.append(highlightKarte(x))); }
  return sp;
}
function blattAnsicht(root: HTMLElement, mSlug: string, pSlug: string, pa: string, vs: string | null, via: "persona" | "partei" = "persona") {
  const p = persona(pSlug); if (!p) return landing(root);
  const q = vs ? `?vs=${vs}` : "";
  const krume: Seg[] = via === "partei"
    ? [bcStart(), bcKat("Modell"), bcLink(kurz(mSlug), `#/modell/${mSlug}`), bcKat("Partei"), bcLink(parteiName(pa), `#/modell/${mSlug}/partei/${pa}${q}`), bcKat("Persona"), bcCur(p.name)]
    : [bcStart(), bcKat("Modell"), bcLink(kurz(mSlug), `#/modell/${mSlug}`), bcKat("Persona"), bcLink(p.name, `#/modell/${mSlug}/persona/${pSlug}${q}`), bcKat("Partei"), bcCur(parteiName(pa))];
  root.append(brotkrume(krume));
  const kopf = el("div", "detail-kopf"); kopf.append(avatar(p, "avatar gross"));
  const ti = el("div"); ti.append(el("h2", "", `${p.name} × ${parteiName(pa)}`)); ti.append(el("span", "fiktiv gross", "fiktive Persona – keine reale Person"));
  kopf.append(ti); root.append(kopf);
  root.append(vergleichLeiste(mSlug, vs));

  const a = erg(mSlug, pSlug, pa);
  if (!vs) { const wrap = el("div", "blatt-einzel"); wrap.append(blattSpalte(a, kurz(mSlug))); root.append(wrap); return; }
  // Split + Diff
  const b = erg(vs, pSlug, pa);
  root.append(diffUebersicht(a, b, mSlug, vs));
  const split = el("div", "blatt-split"); split.append(blattSpalte(a, kurz(mSlug))); split.append(blattSpalte(b, kurz(vs))); root.append(split);
}

/** Match-Heuristik: gleiches Thema + nahe Seite (±2). */
function diffUebersicht(a: Erg | undefined, b: Erg | undefined, mA: string, mB: string): HTMLElement {
  const box = el("div", "diffbox");
  if (!a || !b) { box.append(el("p", "meta", "Vergleich nur möglich, wenn beide Modelle eine Auswertung haben.")); return box; }
  const ha = [...a.besonders_gut, ...a.besonders_schlecht], hb = [...b.besonders_gut, ...b.besonders_schlecht];
  const match = (x: Highlight, y: Highlight) => x.thema === y.thema && x.seite != null && y.seite != null && Math.abs((x.seite ?? 0) - (y.seite ?? 0)) <= 2;
  const beide = ha.filter((x) => hb.some((y) => match(x, y))).length;
  const nurA = ha.length - beide, nurB = hb.filter((y) => !ha.some((x) => match(x, y))).length;
  box.append(el("strong", "", "Vergleich der Begründungen "));
  box.append(el("span", "diffstat", `Δ Score ${Math.abs((a.gesamt.score) - (b.gesamt.score))} · gemeinsam ${beide} · nur ${kurz(mA)} ${nurA} · nur ${kurz(mB)} ${nurB}`));
  box.append(el("p", "mini", "„Gemeinsam“ = beide Modelle nennen einen Punkt zum selben Thema auf naher Seite (±2, approximativ)."));
  return box;
}

/* ---------------- Ansicht: Vergleich/Divergenz ---------------- */
function vergleichAnsicht(root: HTMLElement) {
  root.append(brotkrume([bcStart(), bcCur("Modell-Vergleich")]));
  root.append(el("h2", "", "Wo sind sich die Modelle uneinig?"));
  root.append(infoZeile("Je größer die Spannweite der Urteile über die Modelle, desto stärker hängt die Bewertung vom gewählten Modell ab — der Modell-Bias wird hier am deutlichsten."));
  const liste = el("div", "qtab");
  for (const d of DIVERGENZ.slice(0, 60)) {
    const p = persona(d.persona);
    const row = el("a", "qrow") as HTMLAnchorElement;
    const erstes = MODELLE[0]?.slug ?? "";
    row.href = `#/modell/${erstes}/persona/${d.persona}/partei/${d.partei}`;
    row.append(el("strong", "qname", `${p?.name ?? d.persona} × ${parteiName(d.partei)}`));
    const sc = el("span", "divscores");
    for (const m of MODELLE) { if (d.scores[m.slug] === undefined) continue; const t = el("span", "divscore", `${kurz(m.slug)} ${scoreTxt(d.scores[m.slug])}`); t.style.borderColor = scoreFarbe(d.scores[m.slug]); sc.append(t); }
    row.append(sc);
    row.append(el("span", "spanne", d.spanne === 0 ? "Konsens" : "Δ" + d.spanne));
    liste.append(row);
  }
  root.append(liste);
}

/* ---------------- Profil-Rendering ---------------- */
function renderWert(key: string, val: any): HTMLElement {
  const box = el("div", "feld");
  box.append(el("dt", "", key.replace(/_/g, " ")));
  const dd = el("dd");
  if (Array.isArray(val)) {
    const ul = el("ul");
    val.forEach((v) => {
      if (v && typeof v === "object") {
        const li = el("li");
        li.append(el("strong", "", String(v.gruppe ?? Object.values(v)[0] ?? "")));
        const rest = (v as any).haltung ?? Object.values(v)[1];
        if (rest) li.append(document.createTextNode(` — ${rest}`));
        ul.append(li);
      } else ul.append(el("li", "", String(v)));
    });
    dd.append(ul);
  } else if (val && typeof val === "object") {
    const dl = el("dl", "unterliste");
    Object.entries(val).forEach(([k, v]) => dl.append(renderWert(k, v)));
    dd.append(dl);
  } else {
    dd.textContent = String(val);
  }
  box.append(dd);
  return box;
}
function renderProfilTab(p: Persona): HTMLElement {
  const wrap = el("div", "tab-inhalt");
  if (p.bevoelkerung) {
    const bev = el("section", "bevoelkerung");
    bev.append(el("h3", "abschnitt", "Anteil der Bevölkerung"));
    bev.append(el("p", "", `${p.bevoelkerung.anteil ?? "?"} — ${p.bevoelkerung.bezug ?? ""}`));
    if (!p.bevoelkerung.verifiziert) bev.append(el("p", "warn", "⚠ Entwurf, noch nicht gegen Primärquelle verifiziert"));
    const quellen = p.bevoelkerung.quellen ?? [];
    if (quellen.length) {
      const ul = el("ul");
      quellen.forEach((q: any) => {
        const li = el("li");
        const a = el("a", "", `${q.herausgeber ?? q.titel}: ${q.wert ?? ""}`) as HTMLAnchorElement;
        if (q.url) { a.href = q.url; a.target = "_blank"; a.rel = "noopener"; }
        li.append(a); ul.append(li);
      });
      bev.append(ul);
    }
    wrap.append(bev);
  }
  const profil = el("section", "profil");
  profil.append(el("h3", "abschnitt", "Profil"));
  const dl = el("dl");
  const skip = new Set(["name", "einzeiler", "themen", "gesicht"]);
  Object.entries(p.profil).forEach(([k, v]) => { if (!skip.has(k)) dl.append(renderWert(k, v)); });
  profil.append(dl);
  wrap.append(profil);
  return wrap;
}

/* ---------------- Ansicht: Persona-Profil (modellunabhängig) ---------------- */
function profilLink(p: Persona): HTMLElement {
  const a = el("a", "navbtn profil-link", `📋 Vollständiges Profil von ${p.name} →`) as HTMLAnchorElement;
  a.href = `#/persona/${p.slug}`;
  return a;
}
function profilAnsicht(root: HTMLElement, pSlug: string) {
  const p = persona(pSlug); if (!p) return landing(root);
  root.append(brotkrume([bcStart(), bcKat("Persona"), bcCur(p.name)]));
  const kopf = el("div", "detail-kopf"); kopf.append(avatar(p, "avatar gross"));
  const ti = el("div");
  ti.append(el("h2", "", p.name));
  ti.append(el("span", "fiktiv gross", "fiktive Persona – keine reale Person"));
  if (p.einzeiler) ti.append(el("p", "einzeiler", p.einzeiler));
  const th = el("div", "themen"); p.themen.forEach((t) => th.append(chip(themaName(t)))); ti.append(th);
  kopf.append(ti); root.append(kopf);

  // Einschätzungen der Modelle als Karten (wie die Modell-Auswahl auf der Startseite),
  // jede ein Deeplink in #/modell/<m>/persona/<slug>.
  const modelleMit = MODELLE.filter((m) => ergsMP(m.slug, pSlug).length);
  if (modelleMit.length) {
    root.append(el("h3", "abschnitt", "Wie die Modelle diese Persona einordnen"));
    const grid = el("div", "sig-grid");
    for (const m of modelleMit) {
      const es = ergsMP(m.slug, pSlug);
      const score = avg(es.map((e) => e.gesamt.score));
      const k = el("a", "sigkarte") as HTMLAnchorElement;
      k.href = `#/modell/${m.slug}/persona/${pSlug}`;
      k.append(el("h4", "", kurz(m.slug)));
      k.append(el("div", "sig-modell", `${es.length} Parteien bewertet`));
      const z = el("div", "sig-zahlen");
      z.append(sigZeile("Ø-Urteil", scoreTxt(score), scoreFarbe(score)));
      z.append(sigZeile("Punkte +/−", `+${es.reduce((s, e) => s + e.besonders_gut.length, 0)} / −${es.reduce((s, e) => s + e.besonders_schlecht.length, 0)}`));
      k.append(z);
      k.append(el("span", "sig-cta", "→ Einschätzung ansehen"));
      grid.append(k);
    }
    root.append(grid);
  }

  root.append(renderProfilTab(p)); // enthält Bevölkerung + Profilfelder (inkl. eigener Überschriften)
}

/* ---------------- Ansicht: Personas (Zweit-Einstieg) ---------------- */
function personenliste(root: HTMLElement) {
  root.append(brotkrume([bcStart(), bcCur("Alle Personas")]));
  root.append(el("h2", "", "Nach Persona einsteigen"));
  root.append(infoZeile("Wähle eine Lebenslage — du landest auf ihrer Profilseite und kannst von dort die Einschätzungen der Modelle öffnen."));
  const grid = el("div", "raster");
  for (const p of PERSONAS) {
    const k = el("a", "karte") as HTMLAnchorElement; k.href = `#/persona/${p.slug}`;
    k.append(avatar(p, "avatar")); k.append(el("h3", "", p.name));
    if (p.einzeiler) k.append(el("p", "einzeiler", p.einzeiler));
    const th = el("div", "themen"); p.themen.forEach((t) => th.append(chip(themaName(t)))); k.append(th);
    k.append(el("span", "fiktiv", "fiktiv"));
    grid.append(k);
  }
  root.append(grid);
}

/* ---------------- gemeinsame Bausteine ---------------- */
type Seg = { k: "link" | "kat" | "cur"; label: string; href?: string };
const bcStart = (): Seg => ({ k: "link", label: "Start", href: "#/" });
const bcKat = (label: string): Seg => ({ k: "kat", label });
const bcLink = (label: string, href: string): Seg => ({ k: "link", label, href });
const bcCur = (label: string): Seg => ({ k: "cur", label });
function brotkrume(segs: Seg[]): HTMLElement {
  const bc = el("nav", "brotkrume");
  segs.forEach((s, i) => {
    if (i) bc.append(el("span", "bc-sep", "›"));
    if (s.href) { const a = el("a", "", s.label) as HTMLAnchorElement; a.href = s.href; bc.append(a); }
    else bc.append(el("span", s.k === "kat" ? "bc-kat" : "bc-akt", s.label));
  });
  return bc;
}
function signaturBanner(mo: Modell): HTMLElement {
  const b = el("div", "sigbanner");
  b.append(el("span", "", `Ø-Urteil `)); b.append(scorePill(mo.avgScore));
  b.append(el("span", "sb-sep", `· Kritik-Quote ${Math.round(mo.kritikQuote * 100)} % · ${mo.labels.kritik}, ${mo.labels.ton}`));
  return b;
}
function splitScores(a: number, b: number): HTMLElement {
  const w = el("span", "splitscore");
  w.append(scorePill(a));
  w.append(el("span", "vs", "vs"));
  w.append(isNaN(b) ? el("span", "meta", "—") : scorePill(b));
  if (!isNaN(b)) { const d = Math.round(Math.abs(a - b) * 10) / 10; const dd = el("span", "delta", d ? "Δ" + d : "="); if (d >= 2) dd.classList.add("hoch"); w.append(dd); }
  return w;
}
function infoZeile(t: string): HTMLElement { return el("p", "infozeile", t); }

/* ---------------- Router ---------------- */
function route() {
  const root = document.getElementById("app")!;
  root.innerHTML = "";
  const [pfad] = location.hash.replace(/^#\/?/, "").split("?");
  const teile = pfad.split("/").filter(Boolean);
  const vs = getQuery().get("vs");
  // teile: [] | [modell,M] | [modell,M,persona,P] | [modell,M,persona,P,partei,PA] | [vergleich] | [personas]
  if (teile[0] === "vergleich") vergleichAnsicht(root);
  else if (teile[0] === "personas") personenliste(root);
  else if (teile[0] === "persona" && teile[1]) profilAnsicht(root, teile[1]);
  else if (teile[0] === "modell" && teile[1]) {
    const M = teile[1];
    if (teile[2] === "persona" && teile[3] && teile[4] === "partei" && teile[5]) blattAnsicht(root, M, teile[3], teile[5], vs, "persona");
    else if (teile[2] === "partei" && teile[3] && teile[4] === "persona" && teile[5]) blattAnsicht(root, M, teile[5], teile[3], vs, "partei");
    else if (teile[2] === "persona" && teile[3]) personaAnsicht(root, M, teile[3], vs);
    else if (teile[2] === "partei" && teile[3]) parteiAnsicht(root, M, teile[3], vs);
    else if (teile[2] === "parteien") modellParteienAnsicht(root, M, vs);
    else modellAnsicht(root, M, vs);
  } else landing(root);
  window.scrollTo(0, 0);
}

document.getElementById("stand")!.textContent = `Stand: ${new Date(D.erzeugt).toLocaleString("de-DE")} · ${ERG.length} KI-Urteile`;
window.addEventListener("hashchange", route);
route();
