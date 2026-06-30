# Herkunft der `roster.md` (Start-Besetzung der 16 Personas)

Dieses Dokument hält transparent fest, **wie** die Besetzung der 16 Lebenslagen
(`roster.md`) entstanden ist — das Design-Gerüst, aus dem später die Persona-Profile
(`personas/*.yaml`) erzeugt wurden. Es ist das Gegenstück zu
[`herkunft-personas-und-avatare.md`](herkunft-personas-und-avatare.md), eine Ebene weiter oben.

## Wichtig: kein reproduzierbarer API-Prompt

Die `roster.md` ist ein **redaktionelles Artefakt**, entstanden im **interaktiven Beratungs-
dialog** — nicht über ein Skript oder die API-Pipeline. Es gibt **keinen einzelnen Prompt mit
Temperatur/Seed** und keine Token-Metrik. Die folgenden Angaben dokumentieren den realen
Entstehungsweg, damit Dritte die *Methode* nachvollziehen können.

## Modell & Kontext

- **Modell:** Claude Opus 4.8.
- **Oberfläche:** claude.ai-Chat (Web/App) in einer **Produkt-/Game-Design-Beratungsrolle**
  (rotierende Senior-Perspektiven: Game Design, Politikpsychologie, UX, Brand/Neutralität,
  Growth). **Nicht** Claude Code, **nicht** die Vercel-AI-Gateway-Pipeline.
- **Web-Recherche:** über das integrierte Such-Tool der Oberfläche (siehe Leitlinien unten).
- **Steuerung (Human-in-the-Loop):** Die projektführende Person setzte die Leitplanken und
  Vorgaben; das Modell schlug Besetzung und Balance-Logik vor; jede Zeile ist menschlich
  reviewbar und im Git-Verlauf nachvollziehbar.
- **Reihenfolge:** `roster.md` entstand **zuerst** (in diesem Dialog); die `personas/*.yaml`
  wurden **daraus später** abgeleitet (siehe Schwester-Dokument).

## Das tragende Prinzip: Neutralität ist eine **Roster-Eigenschaft**

Die zentrale Design-Entscheidung hinter der Besetzung: Jede einzelne Persona ist **per se
schief** — ihre Lebenslage trifft die „fernen" Parteien hart und die „nahen" kaum. Neutral
wird das Bild **nur über die Summe** der 16 Personas, und nur, wenn deren Lagen das politische
Spektrum ausgewogen abdecken.

Dieses Prinzip wurde im Dialog **an zwei durchgerechneten Beispielen** gegen echte
Sachsen-Anhalt-Wahlprogramme 2026 getestet — einem konventionellen Landwirt (hart gegenüber
Grüne/Linke) und einer queeren, klimaaktiven Studierenden (hart gegenüber AfD/CDU). Beide sind
exakte Spiegelbilder. Daraus folgte: Der Cast muss **bewusst spektrum-balanciert kuratiert**
werden, sonst ist das Spiel parteiisch, egal wie sauber jede Einzelzeile ist.

## Konstruktionslogik (die de-facto „Anweisungen")

1. **Vorgaben der projektführenden Person:** 16 feste, **fraktionslose** NPCs; **kritisch zu
   allen** Parteien aus ihrer Lage; Empathie-Linse statt Selbstverortung; Abdeckung der
   16-Themen-Taxonomie; relevant über alle drei Wahlen (Sachsen-Anhalt, Mecklenburg-Vorpommern,
   Berlin) — also ländlich-ostdeutsche **und** urbane Lebenswelten.
2. **Balance-Achsen, bewusst gesetzt:**
   - *Politische Schlagseite* — welche Partei die jeweilige Lage am härtesten/kaum trifft.
   - *Demografie* — Alter, Stadt/Land, Einkommen, Familienform, Migrationsgeschichte, Geschlecht,
     Ost-Biografie.
3. **Kuratierung:** drei Schlagseiten-Gruppen — **A** (trifft Grüne/Linke), **B** (trifft
   AfD/CDU), **C** (quergespannt, bricht Links-Rechts) — grob im Verhältnis 5/5/6. Primär- und
   Sekundär-Treffer wurden so verteilt, dass der **Cast-Audit** (Schärfe-Summe je Partei)
   ausbalanciert ist. **SPD und BSW** sind als *Primär*-Ziel bewusst dünn (zentristisch/
   quergespannt) und im README als Audit-Beobachtung markiert.
4. **Themen-Check:** alle 16 Skills durch mindestens eine Persona belegt (Nischen-Anker:
   `landwirtschaft` → Landwirt, `verteidigung` → Soldat).

## Leitlinien aus der Recherche (im Dialog konsultiert)

Die folgenden Recherche-Stränge prägten Besetzung und Balance. Da die Recherche **im Dialog**
lief, sind nicht alle Einzel-URLs rekonstruierbar; die Quellen sind nach Typ/Name benannt.

- **Politische/satirische Spiele & Satire-vs-Neutralität:** Die meisten nutzen *fiktive*
  Stellvertreter; Satire *punktet* (nimmt Partei). → Auflösung für KanzlerClash: Satire auf die
  **Hülle** (Clash, Tribalismus, Nichtwähler), Substanz belegt/neutral.
- **Wahl-O-Mat / Voting-Advice-Methodik (bpb):** Thesen-/Themenauswahl ist die eigentliche
  Angriffsfläche; **alle** zugelassenen Parteien gleichwertig; autorisierte Positionen; offener
  Rechenweg. → prägte die „alle Parteien, keine Schonung"-Regel und die Display-Regeln.
- **Newsgames-Falle:** „offene" Frage mit heimlich „richtiger" Antwort. → stützt den Guardrail
  *verorten statt zustimmen*.
- **LLM-Bias-Forschung:** Modelle tendieren breit progressiv (v. a. ökonomisch). → die
  rechts-geneigten Lebenslagen und der Cast-Audit sind **bewusste Gegen-Bias-Maßnahmen**.
- **Datenquellen/Lizenz:** Wahlprogramme = Fakten/Position (paraphrasieren + belegen);
  abgeordnetenwatch.de = CC0, „Rolle/Realität"; Manifesto Project (WZB) = Kalibrierung;
  Wahl-O-Mat-Datensatz nicht für ein Produkt nutzbar.
- **Sachsen-Anhalt-Wahlprogramme 2026** (CDU/AfD/Grüne/Linke Agrar; AfD Energie/Gleichstellung)
  zum **Stresstest** der Schlagseiten in den beiden durchgerechneten Beispielen.
- *Detailtiefe der Persona-Profile:* siehe die im Schwester-Dokument zitierte
  Persona-Prompting-Literatur.

## Bewusste Grenzen

- Die Schlagseiten-Zuordnungen (`trifft_hart` / `betrifft_kaum`) sind **Hypothesen**, bis die
  `challengeMap`s aus echten Programmen belegt sind. `roster.md` ist ein **Design-Gerüst**,
  keine belegte Datenquelle.
- Neutralität wird **nur auf Roster-Ebene** behauptet und ist erst über den **Cast-Audit**
  (Schärfe-Summe je Partei) nach der Belegung beweisbar — nicht über die Primär-Zahl.
- **Selbst-Vorbehalt zum Modell:** Das verwendete Modell tendiert, wie LLMs allgemein, eher
  progressiv. Die bewusst rechts/marktliberal geneigten Lebenslagen und der Audit wirken dem
  entgegen — die **eigentliche Absicherung ist der menschliche Review** der projektführenden
  Person.
- **Namen sind Platzhalter.** Irrelevante Persona-Trivia (Name, Lieblingsfarbe) kann die
  Modellleistung senken und Stereotype verstärken (siehe Schwester-Dokument) → bewusst
  Lage/Haltung statt Deko.
- **Fiktive Archetypen, keine realen Personen;** würdevolle Formulierung gerade bei
  marginalisierten Lebenslagen.

## Verhältnis zu den anderen Artefakten

- `roster.md` (hier dokumentiert) = **Eingang / Design-Gerüst**.
- `personas/*.yaml` = **daraus erzeugt** (`herkunft-personas-und-avatare.md`).
- `challengeMap` je Partei/Land = **noch aus echten Wahlprogrammen zu belegen**
  (Quellen-Policy im [README](README.md#quellen-policy)).

## Reproduzierbarkeit & Lizenz

Die `roster.md` steht als redaktionelles Artefakt unter **CC-BY-SA** (siehe `DATA-LICENSE`).
Wer sie reproduzieren/fortschreiben will, nutzt dieses Dokument als **Methodenbeschreibung**;
eine 1:1-Reproduktion über einen festen API-Prompt ist hier ausdrücklich **nicht** gegeben
(im Gegensatz zum Programm-Vergleich).
