import { configFromSeed, renderAvatar, normalizeConfig } from "@retro-antlitz-kartei/generator";
import data from "./data.json";
import "./style.css";

type Highlight = {
  titel_selbst: string;
  thema: string;
  programmpunkt: string;
  seite: number | null;
  zitat: string | null;
  bezug: string;
  resonanz: string;
  begruendung: string;
  begruendung_selbst: string;
  beleg_ok?: boolean | null;
};
type Ergebnis = {
  persona: string;
  land: string;
  partei: string;
  modell: string;
  modell_slug: string;
  zeitpunkt: string;
  programm_stand: string | null;
  gesamt: { zusammenfassung: string; score: number };
  besonders_gut: Highlight[];
  besonders_schlecht: Highlight[];
};
type Persona = {
  slug: string;
  name: string;
  einzeiler: string;
  themen: string[];
  profil: Record<string, any>;
  bevoelkerung: any | null;
};

const D = data as any;
const personas: Persona[] = D.personas;
const ergebnisse: Ergebnis[] = D.ergebnisse;
const themaName = (id: string) => D.themen.find((t: any) => t.id === id)?.name ?? id;

const el = (tag: string, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const chip = (text: string) => el("span", "chip", text);

/** Modelle, für die diese Persona Auswertungen hat. */
const modelleFuer = (slug: string): string[] => [
  ...new Set(ergebnisse.filter((e) => e.persona === slug).map((e) => e.modell_slug)),
];
/** Hübsches Tab-Label aus dem Modell-Slug (claude-opus-4-8 → Opus 4.8). */
const modellLabel = (s: string) =>
  s.replace(/^(claude|anthropic|openai|google|gpt|gemini)[-/]?/i, "").replace(/-/g, " ").replace(/\b(\d) (\d)\b/g, "$1.$2").replace(/\b\w/g, (c) => c.toUpperCase()) || s;

function avatar(p: Persona, klasse: string): HTMLCanvasElement {
  const cv = el("canvas", klasse) as HTMLCanvasElement;
  try {
    const cfg = p.profil?.gesicht?.config ? normalizeConfig(p.profil.gesicht.config) : configFromSeed(p.slug);
    renderAvatar(cv, cfg);
  } catch {
    /* Avatar optional */
  }
  return cv;
}

// --- Übersicht ------------------------------------------------------------
function renderListe() {
  const raster = document.getElementById("personas")!;
  const detail = document.getElementById("detail")!;
  detail.hidden = true;
  raster.hidden = false;
  raster.innerHTML = "";
  for (const p of personas) {
    const karte = el("a", "karte") as HTMLAnchorElement;
    karte.href = `#/persona/${p.slug}`;
    karte.append(avatar(p, "avatar"));
    karte.append(el("h3", "", p.name));
    if (p.einzeiler) karte.append(el("p", "einzeiler", p.einzeiler));
    const themen = el("div", "themen");
    p.themen.forEach((t) => themen.append(chip(themaName(t))));
    karte.append(themen);
    if (p.bevoelkerung?.anteil) karte.append(el("p", "anteil", `≈ ${p.bevoelkerung.anteil}`));
    const n = modelleFuer(p.slug).length;
    karte.append(el("p", "meta", n ? `${n} Modell-Auswertung(en)` : "noch keine Auswertung"));
    raster.append(karte);
  }
  window.scrollTo(0, 0);
}

// --- Profil-Rendering -----------------------------------------------------
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
        const rest = v.haltung ?? Object.values(v)[1];
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

function badge(h: Highlight): HTMLElement {
  const ok = h.beleg_ok;
  const b = el("span", "beleg " + (ok === true ? "ok" : ok === false ? "fehler" : "offen"));
  b.title = ok === true ? "Zitat auf Seite verifiziert" : ok === false ? "Zitat nicht auf Seite gefunden" : "nicht geprüft";
  b.textContent = ok === true ? "✓ belegt" : ok === false ? "⚠ ungeprüft" : "•";
  return b;
}

function renderHighlight(h: Highlight): HTMLElement {
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
    const beleg = el("p", "belegzeile");
    beleg.append(badge(h));
    beleg.append(document.createTextNode(` S. ${h.seite ?? "?"}: „${h.zitat}"`));
    box.append(beleg);
  }
  return box;
}

function renderProfilTab(p: Persona): HTMLElement {
  const wrap = el("div", "tab-inhalt");
  if (p.bevoelkerung) {
    const bev = el("section", "bevoelkerung");
    bev.append(el("h3", "", "Anteil der Bevölkerung"));
    bev.append(el("p", "", `${p.bevoelkerung.anteil ?? "?"} — ${p.bevoelkerung.bezug ?? ""}`));
    if (!p.bevoelkerung.verifiziert) bev.append(el("p", "warn", "⚠ Entwurf, noch nicht gegen Primärquelle verifiziert"));
    const quellen = p.bevoelkerung.quellen ?? [];
    if (quellen.length) {
      const ul = el("ul");
      quellen.forEach((q: any) => {
        const li = el("li");
        const a = el("a", "", `${q.herausgeber ?? q.titel}: ${q.wert ?? ""}`) as HTMLAnchorElement;
        if (q.url) {
          a.href = q.url;
          a.target = "_blank";
          a.rel = "noopener";
        }
        li.append(a);
        ul.append(li);
      });
      bev.append(ul);
    }
    wrap.append(bev);
  }
  const profil = el("section", "profil");
  profil.append(el("h3", "", "Profil"));
  const dl = el("dl");
  const skip = new Set(["name", "einzeiler", "themen", "gesicht"]);
  Object.entries(p.profil).forEach(([k, v]) => {
    if (!skip.has(k)) dl.append(renderWert(k, v));
  });
  profil.append(dl);
  wrap.append(profil);
  return wrap;
}

function renderModellTab(p: Persona, modellSlug: string): HTMLElement {
  const wrap = el("div", "tab-inhalt");
  const eigene = ergebnisse
    .filter((e) => e.persona === p.slug && e.modell_slug === modellSlug)
    .sort((a, b) => a.land.localeCompare(b.land) || a.partei.localeCompare(b.partei));
  if (!eigene.length) {
    wrap.append(el("p", "meta", "Keine Auswertung für dieses Modell."));
    return wrap;
  }
  for (const e of eigene) {
    const block = el("article", "ergebnis");
    const h = el("div", "erg-kopf");
    h.append(el("strong", "", `${e.partei.toUpperCase()} · ${e.land}`));
    h.append(chip(`Score ${e.gesamt.score >= 0 ? "+" : ""}${e.gesamt.score}`));
    block.append(h);
    block.append(el("p", "zusammenfassung", e.gesamt.zusammenfassung));
    if (e.besonders_gut.length) {
      block.append(el("h4", "gut", "👍 Besonders gut"));
      e.besonders_gut.forEach((x) => block.append(renderHighlight(x)));
    }
    if (e.besonders_schlecht.length) {
      block.append(el("h4", "schlecht", "👎 Besonders schlecht"));
      e.besonders_schlecht.forEach((x) => block.append(renderHighlight(x)));
    }
    wrap.append(block);
  }
  return wrap;
}

function renderDetail(p: Persona, aktiverTab: string) {
  const raster = document.getElementById("personas")!;
  const detail = document.getElementById("detail")!;
  raster.hidden = true;
  detail.hidden = false;
  detail.innerHTML = "";

  const zurueck = el("a", "zurueck", "← Alle Personas") as HTMLAnchorElement;
  zurueck.href = "#/";
  detail.append(zurueck);

  const kopf = el("div", "detail-kopf");
  kopf.append(avatar(p, "avatar gross"));
  const titel = el("div");
  titel.append(el("h2", "", p.name));
  if (p.einzeiler) titel.append(el("p", "einzeiler", p.einzeiler));
  kopf.append(titel);
  detail.append(kopf);

  // Tab-Leiste: Profil + je Modell ein Tab
  const tabs = el("nav", "tabs");
  const mkTab = (label: string, href: string, aktiv: boolean) => {
    const a = el("a", "tab" + (aktiv ? " aktiv" : ""), label) as HTMLAnchorElement;
    a.href = href;
    return a;
  };
  tabs.append(mkTab("Profil", `#/persona/${p.slug}`, aktiverTab === "profil"));
  for (const m of modelleFuer(p.slug)) {
    tabs.append(mkTab(modellLabel(m), `#/persona/${p.slug}/llm/${m}`, aktiverTab === m));
  }
  detail.append(tabs);

  detail.append(aktiverTab === "profil" ? renderProfilTab(p) : renderModellTab(p, aktiverTab));
  window.scrollTo(0, 0);
}

// --- Routing (#/, #/persona/:slug, #/persona/:slug/llm/:modell) ----------
function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "persona" && parts[1]) {
    const p = personas.find((x) => x.slug === parts[1]);
    if (!p) return renderListe();
    const modelle = modelleFuer(p.slug);
    const tab = parts[2] === "llm" && parts[3] && modelle.includes(parts[3]) ? parts[3] : "profil";
    return renderDetail(p, tab);
  }
  renderListe();
}

document.getElementById("stand")!.textContent = `Stand: ${new Date(D.erzeugt).toLocaleString("de-DE")}`;
window.addEventListener("hashchange", route);
route();
