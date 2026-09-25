(() => {
'use strict';
const T = THREE;
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const bump = (a, b, x) => (x <= a || x >= b) ? 0 : Math.sin(Math.PI * (x - a) / (b - a));
const { G, CRYPTS, CHAINS, TRK_CH, ST } = SIM;
const DT = SIM.P.DT;

// ---------------------------------------------------------------- palette (from the styled review figures)
const COL = {
  stem: '#F2C94C', paneth: '#3FB09A', ta: '#E97BAA', diff: '#F6B8C6', hinge: '#C5E29A', eec: '#8FD6C4',
  traction: '#5B2A86', tension: '#D3246A', flow: '#B89AD1', tracked: '#B39BE0', neutral: '#ECE5F0',
  wnt: '#E3A92E', bmp: '#4A90D9', apical: '#5C7FD0', core: '#F3D3DC', stroma: '#CFC2DD'
};
const col = h => new T.Color(h);
const C_ = Object.fromEntries(Object.entries(COL).map(([k, v]) => [k, col(v)]));

// ---------------------------------------------------------------- journey: stages and schematic parameters
const STAGES = [
  { id: 'niche', s0: 0.00, s1: 0.12, name: 'Stem cell niche', chip: COL.stem },
  { id: 'ta',    s0: 0.12, s1: 0.32, name: 'Transit-amplifying', chip: COL.ta },
  { id: 'hinge', s0: 0.32, s1: 0.42, name: 'Crypt mouth', chip: COL.hinge },
  { id: 'lower', s0: 0.42, s1: 0.60, name: 'Lower villus', chip: '#F9CBD5' },
  { id: 'upper', s0: 0.60, s1: 0.80, name: 'Upper villus', chip: COL.diff },
  { id: 'tip',   s0: 0.80, s1: 0.94, name: 'Villus tip', chip: '#D9C7F0' },
  { id: 'lumen', s0: 0.94, s1: 1.00, name: 'Lumen', chip: '#E6DDF4' }
];
const stageAt = s => STAGES.find(st => s < st.s1) || STAGES[STAGES.length - 1];

// Schematic levels (0-1): directions of change follow the cited data; magnitudes are not measured values.
const KEYS = [
  //  s     k      h    apM  baM  trac  tens  lam  wnt  bmp  ephB eprB ecad  adh  lamz
  [0.00, 0.30, 1.55, 0.85, 0.10, -0.25, 0.55, 0.0, 1.00, 0.00, 1.0, 0.00, 0.35, 0.60, 0.0],
  [0.10, 0.28, 1.55, 0.85, 0.10, -0.9, 0.50, 0.0, 0.95, 0.00, 1.0, 0.00, 0.35, 0.60, 0.0],
  [0.22, 0.10, 1.65, 0.70, 0.12, -0.35, 0.28, 0.0, 0.60, 0.05, 0.8, 0.05, 0.40, 0.60, 0.0],
  [0.30, 0.03, 1.70, 0.55, 0.18, 0.00, 0.10, 0.05, 0.30, 0.15, 0.5, 0.20, 0.45, 0.60, 0.1],
  [0.37, -0.26, 1.70, 0.30, 0.40, 0.35, 0.30, 0.20, 0.10, 0.30, 0.15, 1.00, 0.50, 0.50, 0.6],
  [0.43, -0.04, 2.00, 0.15, 0.50, 0.35, 0.50, 0.45, 0.03, 0.45, 0.05, 0.35, 0.55, 0.60, 1.0],
  [0.48, -0.03, 2.02, 0.14, 0.53, 0.00, 0.53, 0.50, 0.02, 0.50, 0.04, 0.29, 0.58, 0.60, 1.0],
  [0.60, 0.00, 2.10, 0.10, 0.65, -0.50, 0.65, 0.70, 0.00, 0.70, 0.00, 0.05, 0.70, 0.60, 1.0],
  [0.78, -0.06, 2.10, 0.10, 0.88, -0.55, 0.85, 0.90, 0.00, 0.90, 0.00, 0.03, 0.90, 0.60, 1.0],
  [0.84, -0.17, 2.05, 0.10, 0.95, -0.20, 0.95, 0.90, 0.00, 1.00, 0.00, 0.03, 1.00, 0.60, 1.0],
  [1.00, -0.17, 2.05, 0.10, 0.95, -0.10, 0.95, 0.90, 0.00, 1.00, 0.00, 0.03, 1.00, 0.60, 1.0]
];
const PN = ['k', 'h', 'apM', 'baM', 'trac', 'tens', 'lam', 'wnt', 'bmp', 'ephB', 'eprB', 'ecad', 'adh', 'lamz'];
function params(s) {
  let i = 0; while (i < KEYS.length - 2 && s > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = smooth(a[0], b[0], s);
  const P = {}; PN.forEach((n, j) => P[n] = lerp(a[j + 1], b[j + 1], t));
  return P;
}

// ---------------------------------------------------------------- stage text (from the review, Sep 2026)
const tg = { t: '<span class="tag t">tissue</span>', o: '<span class="tag o">organoid</span>', m: '<span class="tag m">MDCK</span>', p: '<span class="tag p">preprint</span>', x: '<span class="tag x">model (this review)</span>' };
const r = x => `<span class="src">(${x})</span>`;
const CARDS = {
  niche: {
    where: 'Crypt base · an Lgr5⁺ crypt base columnar cell wedged between Paneth cells',
    Shape: [`Columnar cell on the concave crypt floor, between Paneth cells ${r('Barker 2007; Sato 2011')}`,
            `Actomyosin sits apically; apical constriction builds the crypt ${r('Sumigray 2018')}${tg.t} ${r('Hartl 2019')}${tg.o}`],
    Forces: [`Apical constriction of the stem cells folds the crypt: the stem-cell compartment pushes its substrate down, and radial traction points inward, toward the crypt base ${r('Pérez-González 2021')}${tg.o}`,
             `Push-dominated compartment: the cell is held in place by contact signals, and division displaces cells upward`],
    Signals: [`Contact-dependent niche: Paneth cells present EGF, TGF-α, Wnt3 and Dll4 ${r('Sato 2011')}`,
              `Wnt3 coats neighbouring membranes; its transfer involves direct contact, and it is diluted by division ${r('Farin 2016')}${tg.o}`,
              `FOXL1⁺ telocytes supply further Wnts ${r('Shoshkes-Carmel 2018')}; EphB2/EphB3 are high ${r('Batlle 2002')}`],
    Notes: [`Lgr5 cells divide daily; clones compete neutrally ${r('Snippert 2010')} and move between niche centre and periphery ${r('Ritsma 2014')}`,
            `Displaced cells can return by Wnt-dependent retrograde movement ${r('Azkanaz 2022')}; Paneth cells stay up to 57 d ${r('Ireland 2005')}`],
    open: 'How far up the axis can a cell travel and still return to the niche?'
  },
  ta: {
    where: 'Crypt wall · the cell divides repeatedly while moving up',
    Shape: [`Each mitosis happens at the apical surface: the nucleus migrates up (interkinetic nuclear migration) ${r('Carroll 2017')}${tg.o}, and the cell rounds up while keeping a thin process on the basal matrix ${r('McKinley 2018')}`,
            `After cytokinesis both daughters reach back to the base; elongated neighbours can insert between apically displaced daughters ${r('McKinley 2018')}${tg.o}`,
            `Actomyosin still apical`],
    Forces: [`Pushed by division: mitotic pressure dominates movement in the crypt and lower villus ${r('Krndija 2019')}${tg.t}`,
             `Where the push comes from: two daughters spreading back onto the base take more room than their mother and push their neighbours aside ${tg.x}`,
             `Traction vanishes at the outer border of the TA zone, and cell–cell tension is at its minimum here ${r('Pérez-González 2021')}${tg.o}`],
    Signals: [`Wnt falls and BMP begins to rise; EphB2 is still high, peaking at positions 4–6 ${r('Batlle 2002')}`,
              `PIEZO1 sits at the basolateral membrane of crypt cells; PIEZO1/2 are needed for normal Wnt and Notch responses ${r('Baghdadi 2024')}`],
    Notes: [`The crypt reads the villus: raising villus contractility deepens the crypts within 18 h through TA hyperproliferation (1.5× deeper, back to normal 5 d after the trigger stops, villus length unchanged) ${r('Hinnant 2024')}${tg.t}`,
            `Stretch and distension also raise proliferation: cyclic stretch of organoids ${r('Houtekamer 2026')}${tg.o}${tg.p}; distension of pig and mouse gut ${r('Spencer 2006; Sueyoshi 2014')}`],
    open: 'What carries information from the tip to the crypt? Probably not force through the sheet: the α-catenin tension epitope stays in the contractile cells (Hinnant 2024).'
  },
  hinge: {
    where: 'Crypt–villus junction · the switch from push to pull',
    Shape: [`Hinge cells are wedge-shaped, with a wide apex and a constricted base, and are defined by that shape rather than by a marker`,
            `Hinge formation needs RAC1 to suppress the hemidesmosome integrins α6β4; without it there are no hinge cells, post-mitotic cells fill the crypt neck, and villi sit closer together ${r('Sumigray 2018')}${tg.t}`,
            `The sheet turns from concave (crypt) to convex`],
    Forces: [`Traction reverses from inward to outward ${r('Pérez-González 2021')}${tg.o}`,
             `Actomyosin moves from the apical to the basal side; what induces this switch is unknown`],
    Signals: [`Crosses the EphB / ephrin-B boundary: EphB activation drives ADAM10 to shed E-cadherin at the interface, so the two populations adhere differently ${r('Batlle 2002; Solanas 2011')}; the ADAM10 mechanism was shown in cultured cells, in vivo it positions Paneth cells`,
              `New substrate: in human small intestine laminin α2 lines the crypt ${r('Beaulieu & Vachon 1994')}, α3 and α5 the villus, and α1 is absent from the adult ${r('Teller 2007')}; mouse crypts carry α1 and α2 ${r('Simon-Assmann 1994')}`,
              `The basement membrane does not move with the cells; it turns over in place ${r('Trier 1990')}`],
    Notes: [`In engineered organoids, the imposed initial geometry controls patterning ${r('Gjorevski 2022')}${tg.o}`],
    open: 'Does differentiation rewire cell mechanics here, or does the change in substrate, geometry and neighbours do it?'
  },
  lower: {
    where: 'Villus base to mid-shaft · columnar enterocyte',
    Shape: [`Tall columnar enterocyte`,
            `Cryptic lamellipodia at the basal surface point toward the tip; their front–back orientation and villus migration depend on Arp2/3 ${r('Krndija 2019')}${tg.t}`,
            `A radial actin star at the cell base links to the neighbours' stars through bicellular junctions ${r('Barai 2025')}`],
    Forces: [`≈ 3–4.5 µm/h in explants ${r('Krndija 2019')}`,
             `Push and pull overlap: high-dose hydroxyurea slows migration only here; CK-666 slows it less here than higher up ${r('Krndija 2019')}`,
             `At the villus base traction still points outward, toward the villus: cells leaving the crypt are dragged by those further out ${r('Pérez-González 2021')}${tg.o}`,
             `In organoids on synthetic villi basal myosin II pulses; when one cell constricts its base, its neighbours expand ${r('Krueger 2025')}${tg.o}. Where along the axis the pulses start is not known`,
             `The villus is under tension: basal cuts recoil at shaft and tip ${r('Krueger 2025')}; apical-junction cuts recoil in the lower and upper villus, faster lower down ${r('Krndija 2019')}${tg.t}`],
    Signals: [`BMP rising; enterocyte programs are zonated along the axis ${r('Moor 2018')}`,
              `Planar cell polarity aligns basal protrusions and polarises basement-membrane integrins, giving coherent streams ("villus ribbons"), shown during postnatal development ${r('Lee 2025')}${tg.p}`],
    open: 'What orients migration: the tension gradient, BMP, matrix composition, planar cell polarity, or a combination?',
    hl: `From here on, each cell crawls toward the tip on its own actin-rich basal protrusions, the cryptic lamellipodia, oriented by Arp2/3. In the lower villus this active migration overlaps with the push from division; in the upper villus it dominates ${r('Krndija 2019')}`
  },
  upper: {
    where: 'Upper shaft · active migration',
    Shape: [`Basal actomyosin thickens toward the tip ${r('Krueger 2025')}`,
            `In organoid-derived monolayers the basal star network is under tension and restrains basal protrusion and migration ${r('Barai 2025')}${tg.o}`],
    Forces: [`In organoids, pulsatile basal contractions run through the villus-like domain: a constricting cell pulls its neighbours' bases wider, a "tissue-wide tug-of-war" ${r('Krueger 2025')}${tg.o}`,
             `≈ 5–8 µm/h: cells accelerate toward the site of their own removal ${r('Krndija 2019')}. A column pushed from below would slow down ${tg.x}`,
             `Cells crawling on their own basal protrusions push the matrix backward, so traction points toward the base, as drawn by ${r('Pérez-González 2022')} (inferred; not measured in tissue)`,
             `Basal phospho-myosin II and E-cadherin rise from base to tip ${r('Krueger 2025; Moor 2018')}, read as a tip-high tension gradient ${r('Wen 2026')}${tg.p}. Which way the gradient runs is still disputed (Box 1)`],
    Signals: [`BMP high`],
    open: 'Which way does the tension gradient run? Recoil, nuclear shape and basement-membrane stiffness sample different structures.'
  },
  tip: {
    where: 'Villus tip · mechanical quality control',
    Shape: [`The departing cell expands, starting at its base, which is what tension predicts ${r('Matejčić 2025')}${tg.o}${tg.p}; after basal ablation, targeted cells expand within seconds ${r('Krueger 2025')}`,
            `It leaves apically while its neighbours close beneath it; the sheet never opens`],
    Forces: [`Tug-of-war: the pulses load every cell, and the cell that cannot hold its share of the tension leaves ${tg.x}. Wild-type cells next to optogenetically hypercontractile cells are extruded more, and Myh9⁺/⁻ cells are over-represented among extruded cells ${r('Krueger 2025')}${tg.o}`,
             `Ablating the basal cytoskeleton of one enterocyte makes that cell extrude within 1 h; blebbistatin lowers the probability from 91% to 50% ${r('Krueger 2025')}${tg.o}`,
             `Execution: a Ca²⁺ pulse collapses the basal myosin 2A meshwork, and the neighbours' lamellipodia pull upward and set whether the cell exits apically or basally ${r('Matejčić 2025')}${tg.o}${tg.p}`,
             `Myosin II rises in the extruding cell and in its neighbours around the time of extrusion ${r('Krueger 2025')}${tg.o}`,
             `Demand: the neighbours that close the gap are stretched and pull the cells behind them up; the flow fills the vacancy ${tg.x}`],
    Signals: [`BMP2 from tip mesenchyme acts on adhesion through its target genes ${r('Berková 2023')}; PIEZO1 is present in extruding tip cells ${r('Baghdadi 2024')}`],
    Notes: [`In human sections most shedding events sit at the tip ${r('Bullen 2006')}; after LPS, shedding occurs along the axis and rises toward the tip ${r('Williams 2013')}. Here weak cells leave from anywhere in the tip zone, most often near the apex but not only there ${tg.x}`,
            `≈ 92% of extrusions in the villus-like domain of organoids are non-apoptotic ${r('Krueger 2025')}${tg.o}; caspase-3/7 are dispensable for shedding ${r('Ghazavi 2022')}`,
            `In organoids, cells extrude from regions of average or low density, which is not crowding ${r('Krueger 2025')}${tg.o}`],
    open: 'What fixes the position of removal? Competition explains which cell leaves, not why removal is enriched at the tip.'
  },
  lumen: {
    where: 'Gut lumen · after extrusion',
    Notes: [`The vacancy is filled by the sheet moving up; each cell ends one position closer to the tip, and division in the crypt supplies the replacement ${tg.x}`,
            `Shed cells stay viable for hours and switch on antimicrobial programs before dying by anoikis ${r('Bahar Halpern 2023')}`,
            `They carry a villus-tip transcriptional signature ${r('Bahar Halpern 2023; Barkai 2025')}`,
            `Local density recovers within ≈ 45 min ${r('Krueger 2025')}${tg.o}; each mouse villus loses ≈ 1400 enterocytes a day ${r('Potten & Loeffler 1990')}`],
    open: 'Does removal follow production, or production follow removal? Neither rate has been changed alone while the other was measured.'
  }
};
const SPEED_TXT = { niche: 'held', ta: 'by division', hinge: '—', lower: '3–4.5 µm/h', upper: '5–8 µm/h', tip: '5–8 µm/h; the followed cell stops as it leaves', lumen: 'shed' };

function captionFor(s, J) {
  const st = stageAt(s), e = J.e;
  if (J.mit) {
    const who = J.mit.kind === 'stem' ? 'Stem cell division' : 'Transit-amplifying division', p = J.mit.p;
    if (p < 0.3) return [who + ': prophase', 'the nucleus moves to the apical surface; the cell rounds up while keeping a thin basal process on the matrix'];
    if (p < 0.7) return [who + ': metaphase', 'at the apical surface; the spindle lies parallel to the epithelium and the basal process stays attached'];
    return [who + ': anaphase and cytokinesis', 'the two daughters separate side by side'];
  }
  if (J.dA >= 0) return ['The daughters reach back to the base', 'together they take more room than their mother and push their neighbours aside (model); the upper daughter is followed'];
  if (FOCP < 1 && J.phase === 'flow') return FOCP > 0 ? ['Following the displaced daughter', 'it has left the niche; from here the close-up moves with it']
    : ['The stem cell stays at the crypt bottom', 'its daughter (outlined) is pushed away from the niche as the cells between them divide'];
  switch (st.id) {
    case 'niche': return ['Retained in the niche', 'apical actomyosin · inward traction · contact-dependent Wnt3, Dll4, EGF'];
    case 'ta': return s < 0.27 ? ['Pushed up by division', 'tension falls to its minimum at the outer TA border']
                               : ['Traction fades at the TA border', 'net traction ≈ 0 here in organoids; the cells are still pushed by division'];
    case 'hinge': return ['Hinge: wide apex, constricted base', 'traction reverses · actomyosin moves apical → basal · EphB/ephrin-B boundary'];
    case 'lower': return ['<span class="pill">Active migration</span>Crawling on cryptic lamellipodia', 'each cell pulls itself toward the tip on actin-rich basal protrusions oriented by Arp2/3; the push from division overlaps here'];
    case 'upper': return ['<span class="pill">Active migration</span>Tug-of-war along the villus base', 'active crawling now dominates · basal myosin pulses (seen in organoids) · cells accelerate'];
    case 'tip':
      if (s < 0.84) return ['Tug-of-war in the tip zone', 'weak cells leave from anywhere in the zone; the followed cell holds the least basal myosin, and its neighbours’ pulses pull its base wider'];
      if (e < 0.15) return ['Ca²⁺ pulse in the departing cell', 'organoid data (Matejčić 2025, preprint)'];
      if (e < 0.35) return ['Basal myosin meshwork collapses', 'the base expands, as tension predicts and compression does not'];
      if (e < 0.60) return ['Neighbours crawl underneath and pull up', 'lamellipodial upward traction · myosin relocalises to the junctions'];
      if (e < 0.88) return ['The cell leaves; neighbours close the gap', 'myosin rises transiently in the neighbours'];
      return ['The gap creates demand', 'the neighbours that closed it stretch and pull up the cells behind them (model)'];
    default: return s < 0.985 ? ['The sheet moves up to fill the vacancy', 'the extruded cell stays alive for hours in the lumen']
                              : ['Anoikis', 'the shed cell dies hours after leaving; the sheet has already closed'];
  }
}

// =================================================================== SIMULATION DRIVER
// LS = the state on screen; AS = a look-ahead copy that runs ahead in idle time, logs extrusions,
// stores snapshots for scrubbing and finds when the followed cell enters each stage.
let LS = null, AS = null, T0 = 0, asSteps = 0, asDone = false;
const SNAP = [];
let T_END = 176.7;                       // estimate from a headless run; replaced once the look-ahead finishes
let STAGE_T = { 0: 0, 0.12: 10.0, 0.32: 78.9, 0.42: 95.7, 0.6: 122.9, 0.8: 154.6, 0.94: 168.7 };
const stageSeen = {};
const tau = () => LS.t - T0;
function lookahead(budget) {
  if (!AS || asDone) return;
  const t0 = performance.now();
  while (performance.now() - t0 < budget) {
    if (asSteps % 80 === 0) SNAP[asSteps / 80] = SIM.snapshot(AS);
    SIM.step(AS, DT); asSteps++;
    const s = SIM.journeyS(AS), tt = AS.t - T0;
    if (asSteps % 10 === 0) confMilestones(AS);
    STAGES.forEach(st => { if (s >= st.s0 && stageSeen[st.s0] === undefined) stageSeen[st.s0] = tt; });
    if (AS.trk.phase === 'done') { asDone = true; T_END = tt; STAGE_T = Object.assign({}, stageSeen); layoutChips(); break; }
  }
}
// when do labelled cells first leave the crypt, reach the villus, and reach the tip? (model hours after labelling)
const CONF_MS = { exit: null, villus: null, tip: null };
function confMilestones(S) {
  if (CONF_MS.tip !== null) return;
  const hrs = S.mt - S.mt0;
  for (let i = 0; i < CHAINS.length; i++) {
    const ch = CHAINS[i]; if (!ch.crypt) continue;
    const cs = S.ch[i].cells;
    for (let k = cs.length - 1; k >= 0; k--) {
      const c = cs[k]; if (!c.lab) continue;
      if (c.l > ch.lCE && CONF_MS.exit === null) CONF_MS.exit = hrs;
      if (ch.kind === 'in' && c.l >= ch.lV0 && CONF_MS.villus === null) CONF_MS.villus = hrs;
      if (ch.kind === 'in' && c.l >= ch.lTZ && CONF_MS.tip === null) { CONF_MS.tip = hrs; if (colourMode === 'conf') drawLegend(); }
      break;
    }
  }
}
const computedT = () => asDone ? T_END : AS ? Math.max(0, AS.t - T0 - DT) : 0;
function goTo(target) {
  target = clamp(target, 0, computedT());
  const now = tau();
  if (target < now - DT / 2 - 1e-6 || target - now > 3) {
    let idx = Math.floor(target / (80 * DT)); while (idx > 0 && !SNAP[idx]) idx--;
    SIM.restore(LS, SNAP[idx]);
  }
  let guard = 0;
  while (tau() < target - DT / 2 && guard++ < 400) SIM.step(LS, DT);
}
function journeyState() {
  const J = LS.trk, s = SIM.journeyS(LS);
  const e = J.phase === 'extrude' ? J.te : (J.phase === 'lumen' || J.phase === 'done') ? 1 : 0;
  let L = -1;
  if (J.phase === 'extrude' && J.te >= 0.6) L = (J.te - 0.6) / 0.4;
  if (J.phase === 'lumen' || J.phase === 'done') L = 1 + 2.6 * J.tl;
  const dA = J.splitM > -50 ? LS.mt - J.splitM : -1;
  return { s, e, L, phase: J.phase, mit: SIM.trackedMitosis(LS), tc: J.tc, tl: J.tl, dA: dA < 1.4 ? dA : -1 };
}

// =================================================================== MAIN SCENE
const canvas = $('main');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
renderer.localClippingEnabled = true;
const scene = new T.Scene();
scene.scale.x = -1;                 // mirrored: the followed cell moves from its crypt on the left to the villus on the right
const MIR = v => { v.x = -v.x; return v; };   // model -> world
const camera = new T.PerspectiveCamera(36, 1, 0.05, 200);
scene.add(new T.HemisphereLight(0xffffff, 0xe2d8ea, 1.45));
const dl = new T.DirectionalLight(0xffffff, 0.75); dl.position.set(3, 8, 9); scene.add(dl);
const dl2 = new T.DirectionalLight(0xf2e6ff, 0.35); dl2.position.set(-6, 2, -4); scene.add(dl2);
const CLIP = new T.Plane(new T.Vector3(0, 0, -1), 0);
let cutaway = true;
const clipped = [], capMeshes = [];
function clipMat(m) { clipped.push(m); return m; }

// villus core (lamina propria), translucent so the pulsing cell bases show through the cut
{
  const m = clipMat(new T.MeshStandardMaterial({ color: COL.core, roughness: 0.9, transparent: true, opacity: 0.38, side: T.DoubleSide, depthWrite: false }));
  const cyl = new T.Mesh(new T.CylinderGeometry(G.R * 0.99, G.R * 0.99, G.H, 48, 1, true), m); cyl.position.y = G.H / 2; scene.add(cyl);
  const cp = new T.Mesh(new T.SphereGeometry(G.R * 0.99, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), m); cp.position.y = G.H; scene.add(cp);
  const sh = new T.Shape(); sh.moveTo(-G.R, 0); sh.lineTo(-G.R, G.H); sh.absarc(0, G.H, G.R, Math.PI, 0, true); sh.lineTo(G.R, 0); sh.closePath();
  const cap = new T.Mesh(new T.ShapeGeometry(sh, 24), new T.MeshBasicMaterial({ color: '#F1CBD6', transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide }));
  cap.position.z = -0.002; scene.add(cap); capMeshes.push(cap);
}
// stroma block with a cut face; crypt basement membranes
{
  const m = clipMat(new T.MeshStandardMaterial({ color: COL.stroma, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false }));
  const stm = new T.Mesh(new T.CylinderGeometry(3.0, 3.0, 2.75, 64, 1, true), m); stm.position.y = -1.375; scene.add(stm);
  const fl = new T.Mesh(new T.CircleGeometry(3.0, 64), clipMat(new T.MeshStandardMaterial({ color: '#C9BCD8', transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide })));
  fl.rotation.x = -Math.PI / 2; fl.position.y = -2.75; scene.add(fl);
  const sh = new T.Shape(); sh.moveTo(-3, -2.75); sh.lineTo(3, -2.75); sh.lineTo(3, 0); sh.lineTo(-3, 0); sh.closePath();
  [CRYPTS[0], CRYPTS[3]].forEach(C => {
    const hp = new T.Path(); hp.moveTo(C.x - G.RC, 0); hp.lineTo(C.x - G.RC, G.Y0); hp.absarc(C.x, G.Y0, G.RC, Math.PI, 0, false); hp.lineTo(C.x + G.RC, 0); hp.closePath(); sh.holes.push(hp);
  });
  const cap = new T.Mesh(new T.ShapeGeometry(sh, 24), new T.MeshBasicMaterial({ color: '#D8CDE4', transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide }));
  cap.position.z = -0.002; scene.add(cap); capMeshes.push(cap);
  const bm = clipMat(new T.MeshStandardMaterial({ color: '#E4C4D4', transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false }));
  CRYPTS.forEach(C => {
    const w = new T.Mesh(new T.CylinderGeometry(G.RC, G.RC, G.D - G.RC, 32, 1, true), bm); w.position.set(C.x, -(G.D - G.RC) / 2, C.z); scene.add(w);
    const b = new T.Mesh(new T.SphereGeometry(G.RC, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bm); b.position.set(C.x, G.Y0, C.z); scene.add(b);
  });
}
// the surface epithelium as a closed slab: an outer edge and a basal side, so nothing shows beneath its rim at low angles
// (openings: the villus base and the six crypt necks)
{
  const m = clipMat(new T.MeshStandardMaterial({ color: '#D3BFD0', roughness: 0.85, side: T.DoubleSide }));
  const rim = new T.Mesh(new T.CylinderGeometry(3.0, 3.0, G.HS + 0.006, 96, 1, true), m); rim.position.y = (G.HS - 0.006) / 2; scene.add(rim);
  const sh = new T.Shape(); sh.absarc(0, 0, 3.0, 0, Math.PI * 2, false);
  const hole = (x, y, r) => { const p = new T.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); sh.holes.push(p); };
  hole(0, 0, G.R + G.RHO2); CRYPTS.forEach(C => hole(C.x, -C.z, G.RC + G.RHO1));
  const fl = new T.Mesh(new T.ShapeGeometry(sh, 48), m); fl.rotation.x = -Math.PI / 2; fl.position.y = -0.006; scene.add(fl);
}
function applyCut() {
  clipped.forEach(m => { m.clippingPlanes = cutaway ? [CLIP] : null; m.needsUpdate = true; });
  capMeshes.forEach(m => m.visible = cutaway);
}

// ---------------------------------------------------------------- dynamic epithelium mesh
const MAXV = 240000;
const tPos = new Float32Array(MAXV * 3), tNor = new Float32Array(MAXV * 3), tCol = new Float32Array(MAXV * 3);
const tGeo = new T.BufferGeometry();
[['position', tPos], ['normal', tNor], ['color', tCol]].forEach(([n, a]) => { const b = new T.BufferAttribute(a, 3); b.setUsage(T.DynamicDrawUsage); tGeo.setAttribute(n, b); });
const tissue = new T.Mesh(tGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, side: T.DoubleSide }));
tissue.frustumCulled = false; scene.add(tissue);
const MAXL = 140000;
const lPos = new Float32Array(MAXL * 3);
const lGeo = new T.BufferGeometry(); { const b = new T.BufferAttribute(lPos, 3); b.setUsage(T.DynamicDrawUsage); lGeo.setAttribute('position', b); }
const lines = new T.LineSegments(lGeo, new T.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85 }));
lines.frustumCulled = false; scene.add(lines);
const MAXA = 60000;
const aPos = new Float32Array(MAXA * 3), aCol = new Float32Array(MAXA * 3);
const aGeo = new T.BufferGeometry();
[['position', aPos], ['color', aCol]].forEach(([n, a]) => { const b = new T.BufferAttribute(a, 3); b.setUsage(T.DynamicDrawUsage); aGeo.setAttribute(n, b); });
const annot = new T.Mesh(aGeo, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
annot.frustumCulled = false; annot.renderOrder = 2; scene.add(annot);

let nv = 0, nl = 0, na = 0;
const _e1 = [0, 0, 0], _e2 = [0, 0, 0], _n = [0, 0, 0];
function pushV(p, n, c) { const o = nv * 3; tPos[o] = p[0]; tPos[o + 1] = p[1]; tPos[o + 2] = p[2]; tNor[o] = n[0]; tNor[o + 1] = n[1]; tNor[o + 2] = n[2]; tCol[o] = c.r; tCol[o + 1] = c.g; tCol[o + 2] = c.b; nv++; }
function quad(p0, p1, p2, p3, hx, hy, hz, c) {
  if (nv + 6 > MAXV) return;
  _e1[0] = p2[0] - p0[0]; _e1[1] = p2[1] - p0[1]; _e1[2] = p2[2] - p0[2];
  _e2[0] = p3[0] - p1[0]; _e2[1] = p3[1] - p1[1]; _e2[2] = p3[2] - p1[2];
  let x = _e1[1] * _e2[2] - _e1[2] * _e2[1], y = _e1[2] * _e2[0] - _e1[0] * _e2[2], z = _e1[0] * _e2[1] - _e1[1] * _e2[0];
  const L = Math.hypot(x, y, z) || 1; x /= L; y /= L; z /= L;
  if (x * hx + y * hy + z * hz < 0) { x = -x; y = -y; z = -z; }
  _n[0] = x; _n[1] = y; _n[2] = z;
  pushV(p0, _n, c); pushV(p1, _n, c); pushV(p2, _n, c); pushV(p0, _n, c); pushV(p2, _n, c); pushV(p3, _n, c);
}
function line(a, b, ox, oy, oz) { if (nl + 2 > MAXL) return; const o = nl * 3; lPos[o] = a[0] + ox; lPos[o + 1] = a[1] + oy; lPos[o + 2] = a[2] + oz; lPos[o + 3] = b[0] + ox; lPos[o + 4] = b[1] + oy; lPos[o + 5] = b[2] + oz; nl += 2; }
let aZ = 0.004;
function aTri(x0, y0, x1, y1, x2, y2, c) {
  if (na + 3 > MAXA) return; const Z = aZ, o = na * 3;
  aPos[o] = x0; aPos[o + 1] = y0; aPos[o + 2] = Z; aPos[o + 3] = x1; aPos[o + 4] = y1; aPos[o + 5] = Z; aPos[o + 6] = x2; aPos[o + 7] = y2; aPos[o + 8] = Z;
  for (let k = 0; k < 3; k++) { aCol[o + 3 * k] = c.r; aCol[o + 3 * k + 1] = c.g; aCol[o + 3 * k + 2] = c.b; }
  na += 3;
}
const aQuad = (a, b, c2, d, c) => { aTri(a[0], a[1], b[0], b[1], c2[0], c2[1], c); aTri(a[0], a[1], c2[0], c2[1], d[0], d[1], c); };

const SB = [0, 1, 2].map(() => new Float32Array(ST)), SA = [0, 1, 2].map(() => new Float32Array(ST));
const BL = [0, 1, 2].map(() => [0, 0, 0]), BR = [0, 1, 2].map(() => [0, 0, 0]), AL = [0, 1, 2].map(() => [0, 0, 0]), AR = [0, 1, 2].map(() => [0, 0, 0]);
const off = (dst, s, i, ni, k) => { dst[0] = s[i] + s[ni] * k; dst[1] = s[i + 1] + s[ni + 1] * k; dst[2] = s[i + 2] + s[ni + 2] * k; };

let colourMode = 'id';
const LAMC = col('#B03A78'), cTmp = new T.Color(), cA = new T.Color(), cB = new T.Color(), cC = new T.Color(), WHITE = col('#FFFFFF'), FLASH = col('#E8F06A'), PULLC = col('#7A55C0'), CHROM = col('#6A3F7E');
const pulse = (c, t) => { const x = Math.sin(2 * Math.PI * t / c.per + c.ph); return x > 0 ? x * x : 0; };
function baseMyo(ch, l) {
  if (ch.crypt && l < ch.lCE) return 0.1;
  if (ch.kind !== 'in' || l < ch.lV0) return 0.3;
  return lerp(0.4, 1.0, clamp((l - ch.lV0) / (ch.lTip0 - ch.lV0)));
}
function axial(ch, l) {
  if (ch.crypt && l < ch.lCE) return 0.3 * l / ch.lCE;
  if (ch.kind !== 'in' || l < ch.lV0) return 0.33;
  return 0.36 + 0.64 * clamp((l - ch.lV0) / (ch.lP - ch.lV0));
}
function identity(ch, c, out) {
  if (c.trk) return out.copy(C_.tracked);
  if (c.fixed) return out.copy(c.type === 'paneth' ? C_.paneth : C_.stem);
  if (ch.crypt && c.l < ch.lTA - 0.05) { out.copy(C_.ta); if (c.mit >= 0) out.lerp(C_.tension, 0.25); return out; }
  if (ch.crypt && c.l < ch.lCE + 0.1) return out.copy(C_.hinge);
  return out.copy(C_.diff);
}
const MO = { type: 'x', ent: true, m: 0.5, v: 0.08, idc: null, lab: 0 };
// Confetti colours: 1 nuclear GFP, 2 cytoplasmic YFP, 3 cytoplasmic RFP, 4 membrane CFP (all drawn as whole-cell colour)
const CONFC = [null, col('#46C05A'), col('#F2CC2A'), col('#E2474C'), col('#3D8FDB')], CONF0 = col('#C9C2CF');
let CLAB = 0;
function modeColour(ch, c, m, idc, out) {
  MO.type = c.fixed ? c.type : 'x'; MO.ent = !c.fixed && !(ch.crypt && c.l < ch.lCE); MO.m = m; MO.v = c.v; MO.idc = idc; MO.lab = c.lab || 0;
  return modeColourAt(axial(ch, c.l), MO, out);
}
const isEph = m => m === 'eph' || m === 'ephb2' || m === 'ephb3' || m === 'efnb';
function modeColourAt(a, o, out) {
  switch (colourMode) {
    case 'am': if (a < 0.31) return out.copy(C_.neutral).lerp(C_.apical, 0.85 * (1 - a / 0.31) + 0.1);
               return out.copy(C_.neutral).lerp(C_.tension, clamp(0.1 + 0.75 * o.m));
    case 'tr': if (a < 0.24) return out.copy(C_.neutral).lerp(C_.apical, 0.9 * (1 - a / 0.24) + 0.1);
               if (a < 0.31) return out.copy(C_.neutral);
               return out.copy(C_.neutral).lerp(C_.traction, 0.25 + 0.7 * smooth(0.31, 1, a));
    case 'sig': return out.copy(C_.neutral).lerp(C_.wnt, (1 - smooth(0, 0.34, a)) * 0.9).lerp(C_.bmp, smooth(0.26, 1, a) * 0.85);
    case 'eph': return ephColour(a, o.type, out);
    case 'ephb2': case 'ephb3': case 'efnb': return ephComponent(a, o.type, out);
    case 'moor': return moorColour(a, o.ent, out);
    case 'conf': return out.copy(o.lab ? CONFC[o.lab] : CONF0);
    case 'v': return out.set('#EFE8F4').lerp(C_.traction, clamp(o.v / 0.22));
    default: return out.copy(o.idc);
  }
}
function tractionAt(ch, l) {
  const a = axial(ch, l);
  if (a < 0.3) return a < 0.06 ? -1 : -1 + smooth(0.06, 0.29, a);
  if (a < 0.36) return 0.35;
  return 0.5 + 0.5 * smooth(0.36, 1, a);
}

// ---- colour modes for signalling and maturation
// Eph/ephrin (Batlle 2002, adult jejunum): EphB3 below position +4 (Paneth cells and the crypt base columnar cells); EphB2 through the proliferative
// compartment, peaking at positions 4-6 and falling toward the crypt top; ephrin-B1/B2 highest at the crypt-villus junction,
// decreasing toward the crypt base, and little expressed from the first third of the villus on.
// Enterocyte zones (Moor 2018): six villus zones V1-V6 from bottom to tip; here read from the cell's position.
const OV = { n: col('#F2EEF4'), b2: col('#2F6FD0'), b3: col('#1B2F7A'), ef: col('#EE8A2E'), crypt: col('#D8D3DE') };
const MOOR = ['#E6F2B9', '#B6DE9A', '#7DC8A0', '#4EA8A8', '#3F80A8', '#4A4E95'].map(col);
const MOOR_TXT = ['antimicrobial (Reg3b/g, Lypd8)', 'antimicrobial → transport', 'carbohydrate & amino-acid transport (Slc2a2, Slc5a1)',
                  'peptide transport (Slc15a1) rising', 'lipid uptake & chylomicron assembly (Npc1l1, Apoa4)', 'Cd73 (Nt5e), Ada: purine program at the tip'];
function ephLevels(a, type) {
  let e2 = 0, e3 = 0;
  if (type === 'paneth' || a < 0.06) e3 = 1;
  if (type !== 'paneth' && a < 0.3) e2 = a < 0.06 ? 0.85 : a < 0.12 ? 1 : Math.max(0, 1 - (a - 0.12) / 0.18);
  const ef = type === 'paneth' ? 0 : a < 0.3 ? Math.pow(a / 0.3, 1.6) : a < 0.4 ? 1 - 0.75 * (a - 0.3) / 0.1 : a < 0.53 ? 0.25 - 0.21 * (a - 0.4) / 0.13 : 0.04;
  return [e2, e3, ef];
}
function ephColour(a, type, out) {
  const [e2, e3, ef] = ephLevels(a, type);
  out.copy(OV.n).lerp(OV.b3, e3 * 0.9).lerp(OV.b2, e2 * 0.85).lerp(OV.ef, ef * 0.85 * (1 - 0.45 * e2));
  return out;
}
// a single component on its own ramp, so its change along the axis is easy to read
const EPHC = { ephb2: col('#2F6FD0'), ephb3: col('#1B2F7A'), efnb: col('#E0701C') }, EPH0 = col('#F6F3F8');
function ephComponent(a, type, out) {
  const [e2, e3, ef] = ephLevels(a, type), v = colourMode === 'ephb2' ? e2 : colourMode === 'ephb3' ? e3 : ef;
  return out.copy(EPH0).lerp(EPHC[colourMode], 0.1 + 0.9 * v);
}
const aOfS = s => s < 0.32 ? 0.3 * s / 0.32 : s < 0.42 ? 0.3 + 0.06 * (s - 0.32) / 0.1 : 0.36 + 0.64 * clamp((s - 0.42) / 0.4);
const moorZone = a => a < 0.33 ? -1 : Math.min(5, Math.max(0, Math.floor((a - 0.36) / 0.64 * 6)));
function moorColour(a, enterocyte, out) { const z = moorZone(a); return z < 0 || !enterocyte ? out.copy(OV.crypt) : out.copy(MOOR[z]); }
const cOv = new T.Color();

const trkInfo = { pos: new T.Vector3(), ok: false };
// Pass 1 stores every column's boundaries, so neighbouring columns can share one zig-zag edge in pass 2:
// each cell's corners are pulled in and the neighbour column's boundaries bulge out, giving hexagons, pentagons and heptagons.
const CS = CHAINS.map(() => ({ ok: false, n: 0, myo: new Float64Array(220), bnd: new Float64Array(221), bndA: new Float64Array(221), dlt: new Float64Array(221),
  hmC: new Float64Array(220), hmB: new Float64Array(221), dome: new Float64Array(220), nuc: new Float64Array(220), wB: new Float64Array(220), wA: new Float64Array(220) }));
const NBR = CHAINS.map(ch => {
  const o = { vl: -1, vr: -1, vo: [0, 0], cl: -1, cr: -1 };
  if (ch.kind === 'in') { [['vl', -1], ['vr', 1]].forEach(([key, s], q) => { const j = SIM.IN_BY_COL[(ch.col + s * ch.fl + G.NV) % G.NV]; o[key] = j; o.vo[q] = CHAINS[j].lV0 - ch.lV0; }); }
  if (ch.crypt) { o.cl = SIM.CRYPT_CH[ch.cryptK][(ch.cc + 11) % 12]; o.cr = SIM.CRYPT_CH[ch.cryptK][(ch.cc + 1) % 12]; }
  return o;
});
const HEXF = 0.36, HX = new Float32Array(ST), PUSHC = col('#4F7BD8'), SPINC = col('#3FAE4A');
// a dividing cell rounds up at the apical surface on a thin basal process; fresh daughters reach back down to the base
function divState(c, out) {
  if (c.mit >= 0) { const r = smooth(0, 0.3, c.mit); out[0] = 1 - 0.82 * r; out[1] = 1 + 0.35 * r; out[2] = 0.3 * r; out[3] = lerp(0.42, 0.8, r); out[4] = 0; return out; }
  const age = LS.mt - c.bornT;
  if (age < 1.3) { const g = smooth(0.05, 1.3, age); out[0] = lerp(0.3, 1, g); out[1] = lerp(1.2, 1, g); out[2] = 0.25 * (1 - g); out[3] = lerp(0.78, 0.42, g); out[4] = 1 - g; return out; }
  out[0] = 1; out[1] = 1; out[2] = 0; out[3] = 0.42; out[4] = 0; return out;
}
const DV = [0, 0, 0, 0, 0], HP = [], ALd = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], ARd = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
for (let i = 0; i < 44; i++) HP.push([0, 0, 0]);
function hexVert(ch, l, bi, f, hm, dst) {
  SIM.samp(ch, l, HX);
  const bx = HX[bi], by = HX[bi + 1], bz = HX[bi + 2], h = HX[18] * hm;
  dst[0] = bx + (HX[0] - bx) * f + HX[bi + 3] * h; dst[1] = by + (HX[1] - by) * f + HX[bi + 4] * h; dst[2] = bz + (HX[2] - bz) * f + HX[bi + 5] * h;
}
// one side of a cell as a zig-zag shared with the neighbouring column
function hexSide(ch, D, k, side, la0, la1, cutSide, nbrIdx, off, list, cnt) {
  const bi = side === 'l' ? 6 : 12;
  const straight = cutSide === side || nbrIdx < 0 || !CS[nbrIdx].ok;
  hexVert(ch, la0, bi, straight ? 0 : HEXF, D.hmB[k], HP[cnt]); list.push(HP[cnt++]);
  if (!straight) {
    const E = CS[nbrIdx];
    for (let m = 1; m < E.n; m++) { const lb = E.bndA[m] - off; if (lb > la0 + 0.012 && lb < la1 - 0.012 && cnt < 38) { hexVert(ch, lb, bi, -HEXF, D.hmC[k], HP[cnt]); list.push(HP[cnt++]); } }
  }
  hexVert(ch, la1, bi, straight ? 0 : HEXF, D.hmB[k + 1], HP[cnt]); list.push(HP[cnt++]);
  return cnt;
}
const _t1 = [0, 0, 0], _t2 = [0, 0, 0], _tn = [0, 0, 0];
function tri(p0, p1, p2, hx, hy, hz, c) {
  if (nv + 3 > MAXV) return;
  _t1[0] = p1[0] - p0[0]; _t1[1] = p1[1] - p0[1]; _t1[2] = p1[2] - p0[2]; _t2[0] = p2[0] - p0[0]; _t2[1] = p2[1] - p0[1]; _t2[2] = p2[2] - p0[2];
  let x = _t1[1] * _t2[2] - _t1[2] * _t2[1], y = _t1[2] * _t2[0] - _t1[0] * _t2[2], z = _t1[0] * _t2[1] - _t1[1] * _t2[0];
  const L = Math.hypot(x, y, z) || 1; x /= L; y /= L; z /= L; if (x * hx + y * hy + z * hz < 0) { x = -x; y = -y; z = -z; }
  _tn[0] = x; _tn[1] = y; _tn[2] = z; pushV(p0, _tn, c); pushV(p1, _tn, c); pushV(p2, _tn, c);
}
// ================================================================ apical cell network
// The top of the epithelium is drawn as a power (weighted Voronoi) diagram of the cell centres, so every cell shares
// its edges with its neighbours: one continuous network with no gaps. Each part of the surface gets an angle-preserving
// flat map (conformal on the villus and crypt walls, azimuthal around the two poles, the plane between them).
const GR = G.R, GH = G.H, GHV = G.HV, GRC = G.RC, GHC = G.HC, GHS = G.HS, GRHO1 = G.RHO1, GRHO2 = G.RHO2, GY0 = G.Y0, TAU = 2 * Math.PI;
const BFL = GRHO2 * Math.PI / 2, VW = GH - GRHO2, UP = VW + GR * Math.PI / 2;           // villus arc u = l - lV0: fillet [-BFL,0), wall [0,VW), tip [VW,UP]
const UCAPV = VW + GR * 50 * Math.PI / 180, RCAPV = UP - UCAPV;
const CUQ = GRC * Math.PI / 2, CWL = -GRHO1 - GY0, CRL = GRHO1 * Math.PI / 2, CLE = CUQ + CWL + CRL, LCAPC = GRC * 55 * Math.PI / 180;
const RBASE = GR + GRHO2, RHOLE = GRC + GRHO1, ROUTER = 3.0;
const vR = u => u < 0 ? GR + GRHO2 - GRHO2 * Math.sin(clamp((u + BFL) / GRHO2, 0, Math.PI / 2)) : u < VW ? GR : GR * Math.cos(Math.min((u - VW) / GR, Math.PI / 2 - 1e-3));
const cRr = l => l < CUQ ? GRC * Math.sin(Math.max(l / GRC, 1e-3)) : l < CUQ + CWL ? GRC : GRC + GRHO1 - GRHO1 * Math.cos(clamp((l - CUQ - CWL) / GRHO1, 0, Math.PI / 2));
function makeConf(r, u0, u1) {
  const du = 0.004, n = Math.ceil((u1 - u0) / du) + 1, Yt = new Float64Array(n);
  for (let i = 1; i < n; i++) { const a = u0 + (i - 1) * du, b = u0 + i * du; Yt[i] = Yt[i - 1] + du * 2 / (r(a) + r(b)); }
  return { u0, du, Yt, n };
}
const VCONF = makeConf(vR, -BFL, UCAPV + 0.01), CCONF = makeConf(cRr, LCAPC - 0.01, CLE + 0.01);
function confY(Tb, u) { const x = clamp((u - Tb.u0) / Tb.du, 0, Tb.n - 1.001), i = x | 0; return Tb.Yt[i] + (Tb.Yt[i + 1] - Tb.Yt[i]) * (x - i); }
function confU(Tb, y) {
  const Y = Tb.Yt; let lo = 0, hi = Tb.n - 1;
  if (y <= Y[0]) return Tb.u0; if (y >= Y[hi]) return Tb.u0 + hi * Tb.du;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Y[m] <= y) lo = m; else hi = m; }
  return Tb.u0 + (lo + (y - Y[lo]) / (Y[hi] - Y[lo])) * Tb.du;
}
const VYTOP = confY(VCONF, UCAPV), CYBOT = confY(CCONF, LCAPC), CYTOP = confY(CCONF, CLE);
function villusPt(th, u, hOff, out) {
  const cx = Math.cos(th), cz = Math.sin(th); let r, y, nr, ny, h;
  if (u < 0) { const g = clamp((u + BFL) / GRHO2, 0, Math.PI / 2); r = GR + GRHO2 - GRHO2 * Math.sin(g); y = GRHO2 - GRHO2 * Math.cos(g); nr = Math.sin(g); ny = Math.cos(g); h = lerp(GHS, GHV, g / (Math.PI / 2)); }
  else if (u < VW) { r = GR; y = GRHO2 + u; nr = 1; ny = 0; h = GHV; }
  else { const b = Math.min((u - VW) / GR, Math.PI / 2); r = GR * Math.cos(b); y = GH + GR * Math.sin(b); nr = Math.cos(b); ny = Math.sin(b); h = GHV; }
  const kk = h * hOff; out[0] = (r + nr * kk) * cx; out[1] = y + ny * kk; out[2] = (r + nr * kk) * cz; return out;
}
function cryptPt(C, ph, l, hOff, out) {
  const dx = Math.cos(ph), dz = Math.sin(ph); let ud, y, nd, ny, h;
  if (l < CUQ) { const a = Math.max(l / GRC, 1e-4); ud = GRC * Math.sin(a); y = GY0 - GRC * Math.cos(a); nd = -Math.sin(a); ny = Math.cos(a); h = GHC; }
  else if (l < CUQ + CWL) { ud = GRC; y = GY0 + (l - CUQ); nd = -1; ny = 0; h = GHC; }
  else { const b = clamp((l - CUQ - CWL) / GRHO1, 0, Math.PI / 2); ud = GRC + GRHO1 - GRHO1 * Math.cos(b); y = -GRHO1 + GRHO1 * Math.sin(b); nd = -Math.cos(b); ny = Math.sin(b); h = lerp(GHC, GHS, b / (Math.PI / 2)); }
  const kk = h * hOff; out[0] = C.x + (ud + nd * kk) * dx; out[1] = y + ny * kk; out[2] = C.z + (ud + nd * kk) * dz; return out;
}
// families: 0 villus wall (conformal), 1 villus cap, 2+k crypt k wall (conformal), 8+k crypt k base cap, 14 surface plane
const NFAM = 15;
const FAM = Array.from({ length: NFAM }, (_, f) => ({ f, ids: [], crypt: f >= 2 && f < 14 ? (f < 8 ? f - 2 : f - 8) : -1 }));
const famType = f => f === 0 ? 'vw' : f === 1 ? 'vc' : f < 8 ? 'cw' : f < 14 ? 'cc' : 's';
function famMap(f, X, Y, hOff, out) {
  switch (famType(f)) {
    case 'vw': return villusPt(X, confU(VCONF, Y), hOff, out);
    case 'vc': return villusPt(Math.atan2(Y, X), UP - Math.hypot(X, Y), hOff, out);
    case 'cw': return cryptPt(CRYPTS[f - 2], X, confU(CCONF, Y), hOff, out);
    case 'cc': return cryptPt(CRYPTS[f - 8], Math.atan2(Y, X), Math.hypot(X, Y), hOff, out);
    default: out[0] = X; out[1] = GHS * hOff; out[2] = Y; return out;
  }
}
const famScale = (f, Y) => famType(f) === 'vw' ? vR(confU(VCONF, Y)) : famType(f) === 'cw' ? cRr(confU(CCONF, Y)) : 1;   // 3D length per family unit
// sites (pooled)
const SITES = []; let nSites = 0;
function newSite() { if (nSites >= SITES.length) SITES.push({ X: 0, Y: 0, w: 0, f: 0, ci: -1, k: -1, dome: 0, col: new T.Color(), sec: 0, cA: [0, 0, 0], cB: [0, 0, 0], cN: 0 }); const s = SITES[nSites++]; s.cN = 0; s.dome = 0; s.w = 0; s.sec = 0; s.ci = -1; s.k = -1; return s; }
// static surface cells around the crypts, beyond the flowing columns
const STATIC = [];
{
  const sp = 0.19;
  for (let iy = -20; iy <= 20; iy++) for (let ix = -20; ix <= 20; ix++) {
    let x = (ix + (iy & 1) * 0.5) * sp, z = iy * sp * 0.866;
    const j1 = Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453, j2 = Math.sin(ix * 39.346 + iy * 11.135) * 24634.6345;
    x += ((j1 - Math.floor(j1)) - 0.5) * 0.06; z += ((j2 - Math.floor(j2)) - 0.5) * 0.06;
    const r = Math.hypot(x, z); if (r < G.RCAP + 0.1 || r > ROUTER - 0.02) continue;
    let dmin = 9, near = null; CRYPTS.forEach(C => { const d = Math.hypot(x - C.x, z - C.z); if (d < dmin) { dmin = d; near = C; } });
    if (dmin < RHOLE + 0.05) continue;
    const ang = Math.atan2(z, x), da = Math.abs(((ang - near.th) % TAU + TAU + Math.PI) % TAU - Math.PI);
    if (r > G.CR && da < G.DTH * 1.05) continue;                   // the outward-flowing columns run here
    STATIC.push({ x, z, hinge: dmin < RHOLE + 0.22 });
  }
}
// grids for neighbour search
// the angular families wrap around: their grid columns divide 2π exactly, so a column index wraps with a shift of 2π
function makeGrid(x0, y0, x1, y1, b, per) {
  const nx = per ? Math.round(TAU / b) : Math.ceil((x1 - x0) / b) + 1; if (per) { x0 = 0; b = TAU / nx; }
  const ny = Math.ceil((y1 - y0) / b) + 1; return { x0, y0, b, nx, ny, per, head: new Int32Array(nx * ny), next: new Int32Array(8000) };
}
const gridCol = (g, X) => { const c = Math.floor((X - g.x0) / g.b); return g.per ? ((c % g.nx) + g.nx) % g.nx : clamp(c, 0, g.nx - 1); };
const GRIDS = FAM.map(F => { const t = famType(F.f); return t === 'vw' ? makeGrid(0, -0.1, TAU, VYTOP + 0.2, 0.5, true) : t === 'cw' ? makeGrid(0, CYBOT - 0.2, TAU, CYTOP + 0.2, 0.8, true) : t === 's' ? makeGrid(-3.2, -3.2, 3.2, 3.2, 0.45) : makeGrid(-1.6, -1.6, 1.6, 1.6, 0.5); });
function gridBuild(F) {
  const g = GRIDS[F.f]; g.head.fill(-1);
  F.ids.forEach(id => { const s = SITES[id]; const cx = gridCol(g, s.X), cy = clamp(Math.floor((s.Y - g.y0) / g.b), 0, g.ny - 1), c = cy * g.nx + cx; g.next[id] = g.head[c]; g.head[c] = id; });
}
// polygon clipping (Sutherland-Hodgman against a*x + b*y <= c)
const PA = new Float64Array(520), PB = new Float64Array(520);
let pN = 0, pCur = PA, pAlt = PB;
function clipHP(a, b, c) {
  const inP = pCur, out = pAlt; let m = 0;
  for (let i = 0; i < pN; i++) {
    const x1 = inP[2 * i], y1 = inP[2 * i + 1], j = (i + 1) % pN, x2 = inP[2 * j], y2 = inP[2 * j + 1];
    const d1 = a * x1 + b * y1 - c, d2 = a * x2 + b * y2 - c;
    if (d1 <= 0) { out[2 * m] = x1; out[2 * m + 1] = y1; m++; }
    if ((d1 < 0 && d2 > 0) || (d1 > 0 && d2 < 0)) { const t = d1 / (d1 - d2); out[2 * m] = x1 + (x2 - x1) * t; out[2 * m + 1] = y1 + (y2 - y1) * t; m++; }
    if (m > 250) break;
  }
  pN = m; pCur = out; pAlt = inP;
}
// clip against a circle (keep its outside or its inside); where the polygon meets the circle the edge follows the arc,
// so neighbouring families that end on the same circle meet without slivers
const ARC = 0.04;
function clipDisk(cx, cy, rho, outside) {
  const inP = pCur, out = pAlt, r2 = rho * rho, dir = outside ? -1 : 1;
  const keep = (x, y) => { const g = (x - cx) * (x - cx) + (y - cy) * (y - cy) - r2; return outside ? g >= 0 : g <= 0; };
  let i0 = -1; for (let i = 0; i < pN; i++) if (keep(inP[2 * i], inP[2 * i + 1])) { i0 = i; break; }
  if (i0 < 0) { pN = 0; pCur = out; pAlt = inP; return; }
  let m = 0, hasL = false, lx = 0, ly = 0;
  const put = (x, y) => { if (m < 255) { out[2 * m] = x; out[2 * m + 1] = y; m++; } };
  for (let q = 0; q < pN; q++) {
    const i = (i0 + q) % pN, j = (i + 1) % pN, x1 = inP[2 * i], y1 = inP[2 * i + 1], x2 = inP[2 * j], y2 = inP[2 * j + 1];
    let st = keep(x1, y1); if (st) put(x1, y1);
    const dx = x2 - x1, dy = y2 - y1, ex = x1 - cx, ey = y1 - cy, a = dx * dx + dy * dy, b = 2 * (dx * ex + dy * ey), c = ex * ex + ey * ey - r2, D = b * b - 4 * a * c;
    if (D <= 0 || a < 1e-18) continue;
    const sq = Math.sqrt(D), ts = [(-b - sq) / (2 * a), (-b + sq) / (2 * a)];
    for (const t of ts) {
      if (t <= 1e-9 || t >= 1 - 1e-9) continue;
      const qx = x1 + dx * t, qy = y1 + dy * t;
      if (st) { lx = qx; ly = qy; hasL = true; put(qx, qy); st = false; }
      else {
        if (hasL) {
          const aL = Math.atan2(ly - cy, lx - cx); let sw = dir * (Math.atan2(qy - cy, qx - cx) - aL);
          sw = ((sw % TAU) + TAU + Math.PI) % TAU - Math.PI;
          if (sw > 0) { const ns = Math.ceil(sw / ARC); for (let k = 1; k < ns; k++) { const an = aL + dir * sw * k / ns; put(cx + rho * Math.cos(an), cy + rho * Math.sin(an)); } }
        }
        put(qx, qy); st = true;
      }
    }
  }
  pN = m; pCur = out; pAlt = inP;
}
// straight edges along a line of constant Y in a conformal map are circles in 3D: split them so they follow the circle
function splitFlat(step) {
  const inP = pCur, out = pAlt; let m = 0;
  for (let i = 0; i < pN && m < 250; i++) {
    const j = (i + 1) % pN, x1 = inP[2 * i], y1 = inP[2 * i + 1], x2 = inP[2 * j], y2 = inP[2 * j + 1];
    out[2 * m] = x1; out[2 * m + 1] = y1; m++;
    if (Math.abs(y2 - y1) < 1e-9 && Math.abs(x2 - x1) > step * 1.1) { const ns = Math.ceil(Math.abs(x2 - x1) / step); for (let k = 1; k < ns && m < 250; k++) { out[2 * m] = x1 + (x2 - x1) * k / ns; out[2 * m + 1] = y1; m++; } }
  }
  pN = m; pCur = out; pAlt = inP;
}
const Q3 = [0, 0, 0], Q3b = [0, 0, 0], QC = [0, 0, 0], VP = [];
for (let i = 0; i < 256; i++) VP.push([0, 0, 0]);
function buildApical() {
  const J = LS.trk, tt = LS.t;
  nSites = 0; FAM.forEach(F => F.ids.length = 0);
  // ---- chain cells become sites
  for (let ci = 0; ci < CHAINS.length; ci++) {
    const ch = CHAINS[ci], D = CS[ci]; SIDX[ci].fill(-1); if (!D.ok) continue;
    const cs = LS.ch[ci].cells, sec = cutaway && ch.cut ? 1 : 0;
    for (let k = 0; k < D.n; k++) {
      const c = cs[k];
      let f, X, Y, r3 = 1, nL = 1, l = c.l;
      if (ch.kind === 'crypt' && l >= ch.lCE) l = ch.lCE - 1e-3;       // a crypt-only column ends at the rim: keep its last cells in the crypt
      if (ch.crypt && l < ch.lCE) {
        const ph = (ch.cc + 0.5) * G.DPH;
        if (l < 0.17 && !sec && ch.cc % 3 !== 0) continue;            // thin out the crowded crypt pole
        if (l < LCAPC) { f = 8 + ch.cryptK; X = l * Math.cos(ph); Y = l * Math.sin(ph); }
        else { f = 2 + ch.cryptK; X = ph; Y = confY(CCONF, l); r3 = cRr(l); }
      } else if (ch.kind === 'in' && l >= ch.lV0 - BFL) {
        const th = (ch.col + 0.5) * G.DTH, u = l - ch.lV0;
        if (u >= UCAPV) { f = 1; const rho = UP - u; X = rho * Math.cos(th); Y = rho * Math.sin(th); }
        else { f = 0; X = th; Y = confY(VCONF, u); r3 = vR(u); }
      } else { f = 14; SIM.samp(ch, l, HX); X = HX[0]; Y = HX[2]; nL = c.trk ? 1 : 2; }
      // on the flat surface a column is two to four cells wide: each row is drawn as two cells side by side
      // (the followed cell stays one cell); the one next to the cut plane carries the cut face
      for (let j = 0; j < nL; j++) {
        const s = newSite(); s.f = f; s.ci = ci; s.k = k; s.sec = sec;
        if (nL === 1) { s.X = X; s.Y = Y; }
        else { const t = (j + 0.5) / nL; s.X = lerp(HX[6], HX[12], t); s.Y = lerp(HX[8], HX[14], t); }
        // weights (3D units²): a cell leaving the sheet shrinks away, a rounding mitotic cell and fresh daughters bulge
        let w = 0;
        if (c.sig < 0.999) w -= 0.05 * (1 - Math.pow(c.sig, 0.45));
        w += 0.012 * D.dome[k] / 0.3;
        s.w = w / (r3 * r3);
        s.dome = D.dome[k] + 0.62 * (1 - c.sig);
        // colour
        if (j === 0) {
          const idc = identity(ch, c, cA);
          if (c.trk && J.phase === 'extrude' && J.te < 0.15) idc.lerp(FLASH, 0.8 * bump(0, 0.15, J.te));
          modeColour(ch, c, D.myo[k], idc, s.col);
          if (outlineMode === 'none' && !c.trk) s.col.multiplyScalar(0.985 + 0.03 * ((c.id * 0.618) % 1));
        } else s.col.copy(SITES[nSites - 2].col);
        FAM[f].ids.push(nSites - 1);
        if (nL === 1 || (j === 0) === (ch.cut !== 'r')) SIDX[ci][k] = nSites - 1;
      }
    }
  }
  // ---- static surface cells
  for (let i = 0; i < STATIC.length; i++) {
    const p = STATIC[i]; if (cutaway && p.z > 0) continue;
    const s = newSite(); s.X = p.x; s.Y = p.z; s.f = 14;
    if (colourMode === 'id') s.col.copy(p.hinge ? C_.hinge : C_.diff);
    else { MO.type = 'x'; MO.ent = true; MO.m = 0.3; MO.v = 0.02; MO.lab = 0; MO.idc = C_.diff; modeColourAt(0.33, MO, s.col); }
    FAM[14].ids.push(nSites - 1);
  }
  // ---- cells: clip a box by the power bisectors of nearby sites and by the family's domain
  const o = 0.004;
  for (let f = 0; f < NFAM; f++) {
    const F = FAM[f], ids = F.ids; if (!ids.length) continue;
    const type = famType(f), periodic = (type === 'vw' || type === 'cw') && !(cutaway && (type === 'vw' || f === 2 || f === 5));
    const g = GRIDS[f]; gridBuild(F);
    const box = type === 'vw' ? 0.8 : type === 'cw' ? 1.3 : type === 's' ? 0.6 : 0.5, rMax = type === 'vw' ? 0.75 : type === 'cw' ? 1.2 : 0.6;
    for (let q = 0; q < ids.length; q++) {
      const s = SITES[ids[q]];
      pCur = PA; pAlt = PB; pN = 4;
      PA[0] = s.X - box; PA[1] = s.Y - box; PA[2] = s.X + box; PA[3] = s.Y - box; PA[4] = s.X + box; PA[5] = s.Y + box; PA[6] = s.X - box; PA[7] = s.Y + box;
      // neighbours
      const cx = gridCol(g, s.X), cy = clamp(Math.floor((s.Y - g.y0) / g.b), 0, g.ny - 1), wx = g.per ? 2 : 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -wx; dx <= wx; dx++) {
        let gx = cx + dx, shift = 0; const gy = cy + dy;
        if (gy < 0 || gy >= g.ny) continue;
        if (gx < 0 || gx >= g.nx) { if (!periodic) continue; if (gx < 0) { gx += g.nx; shift = -TAU; } else { gx -= g.nx; shift = TAU; } }
        for (let id = g.head[gy * g.nx + gx]; id >= 0; id = g.next[id]) {
          const t = SITES[id]; if (t === s) continue;
          const tx = t.X + shift, ty = t.Y;
          const ddx = tx - s.X, ddy = ty - s.Y; if (ddx * ddx + ddy * ddy > rMax * rMax) continue;
          clipHP(2 * ddx, 2 * ddy, (tx * tx + ty * ty) - (s.X * s.X + s.Y * s.Y) + s.w - t.w - 2 * (0) );
          if (pN < 3) break;
        }
      }
      if (pN < 3) continue;
      // the bisector above used absolute coordinates: a·x <= b with a = 2(t - s), b = |t|² - |s|² + ws - wt
      // domain
      let cutLine = null;
      if (type === 'vw') {
        clipHP(0, -1, 0); clipHP(0, 1, VYTOP);
        if (cutaway) { clipHP(-1, 0, -Math.PI); clipHP(1, 0, TAU); cutLine = s.X > 4.7 ? ['x', TAU] : ['x', Math.PI]; }
      } else if (type === 'cw') {
        clipHP(0, -1, -CYBOT); clipHP(0, 1, CYTOP);
        if (cutaway && (f === 2 || f === 5)) { clipHP(-1, 0, -Math.PI); clipHP(1, 0, TAU); cutLine = s.X > 4.7 ? ['x', TAU] : ['x', Math.PI]; }
      } else if (type === 'vc' || type === 'cc') {
        const Rm = type === 'vc' ? RCAPV : LCAPC, a0 = Math.atan2(s.Y, s.X);
        clipDisk(0, 0, Rm, false); void a0;
        if (cutaway && (type === 'vc' || f === 8 || f === 11)) { clipHP(0, 1, 0); cutLine = ['y', 0, s.X > 0 ? 1 : -1]; }
      } else {
        clipDisk(0, 0, RBASE, true); if (pN >= 3) clipDisk(0, 0, ROUTER, false);
        CRYPTS.forEach(C => { const dx = s.X - C.x, dz = s.Y - C.z; if (pN >= 3 && dx * dx + dz * dz < 1.2) clipDisk(C.x, C.z, RHOLE, true); });
        if (cutaway && pN >= 3) { clipHP(0, 1, 0); cutLine = ['y', 0, s.X > 0 ? 1 : -1]; }
      }
      if (pN < 3) continue;
      // map to 3D and draw: a fan from the (possibly domed) centre
      if (type === 'vw' || type === 'cw') splitFlat(type === 'cw' ? 0.1 : ARC);   // angle steps: the crypt wall is a third of the villus radius
      const n = Math.min(pN, 255);
      for (let i = 0; i < n; i++) famMap(f, pCur[2 * i], pCur[2 * i + 1], 1, VP[i]);
      famMap(f, s.X, s.Y, 1 + s.dome, QC); famMap(f, s.X, s.Y, 0, Q3);
      const hx = QC[0] - Q3[0], hy = QC[1] - Q3[1], hz = QC[2] - Q3[2];
      for (let i = 0; i < n; i++) {
        const a = VP[i], b = VP[(i + 1) % n];
        tri(QC, a, b, hx, hy, hz, s.col);
        line(a, b, hx * o / 0.3, hy * o / 0.3, hz * o / 0.3);
      }
      // record the edge on the cut plane, for the cell's cut face
      if (cutLine && s.sec) {
        let m = 0;
        for (let i = 0; i < n && m < 2; i++) {
          const x = pCur[2 * i], y = pCur[2 * i + 1];
          const on = cutLine[0] === 'x' ? Math.abs(x - cutLine[1]) < 1e-7 : (Math.abs(y) < 1e-7 && Math.sign(x) === cutLine[2]);
          if (on) { const dst = m ? s.cB : s.cA; dst[0] = VP[i][0]; dst[1] = VP[i][1]; dst[2] = VP[i][2]; m++; }
        }
        s.cN = m;
      }
    }
  }
}
const SIDX = CHAINS.map(() => new Int32Array(240));

function buildTissue() {
  nv = 0; nl = 0; na = 0;
  const tt = LS.t, J = LS.trk, hexOn = outlineMode !== 'none';
  trkInfo.ok = false;
  // ---------------- pass 1: boundaries, heights, myosin
  for (let ci = 0; ci < CHAINS.length; ci++) {
    const ch = CHAINS[ci], D = CS[ci]; D.ok = false;
    if (cutaway && !ch.back) continue;
    const cs = LS.ch[ci].cells, n = cs.length; if (!n) continue;
    D.ok = true; D.n = n;
    const myo = D.myo, bnd = D.bnd, bndA = D.bndA, dlt = D.dlt, hmC = D.hmC, hmB = D.hmB;
    for (let k = 0; k < n; k++) {
      const c = cs[k];
      let m = baseMyo(ch, c.l) * (0.55 + 0.45 * pulse(c, tt));
      if (ch.kind === 'in' && c.l > ch.lV0) m *= clamp(SIM.qEff(c), 0.3, 1.3);   // weak cells hold less basal myosin
      if (c.ext >= 0) m *= 1 - clamp(c.ext * 2);
      if (c.trk && J.phase === 'extrude') m *= 1 - smooth(0.15, 0.35, J.te);
      myo[k] = m + 0.8 * c.boost;
      divState(c, DV); D.dome[k] = DV[2]; D.nuc[k] = DV[3];
      D.wB[k] = c.A * DV[0]; D.wA[k] = c.A / c.sig * Math.pow(c.sig, 0.45) * DV[1];
    }
    // shared boundaries, so cells always touch; each base shifts toward the more contractile neighbour
    bnd[0] = ch.crypt ? 0 : Math.max(0, cs[0].l - cs[0].A / 2);
    for (let k = 1; k < n; k++) {
      const a = cs[k - 1], b = cs[k];
      bnd[k] = a.l + (b.l - a.l) * D.wB[k - 1] / (D.wB[k - 1] + D.wB[k]);
      bndA[k] = a.l + (b.l - a.l) * D.wA[k - 1] / (D.wA[k - 1] + D.wA[k]);
    }
    const top = cs[n - 1];
    bnd[n] = ch.kind === 'in' ? (top.l + top.A / 2 >= ch.lP - 0.6 * SIM.restLen(ch, top.l) ? ch.lP : top.l + top.A / 2) : Math.min(ch.L, top.l + top.A / 2);
    bndA[0] = bnd[0]; bndA[n] = bnd[n];
    for (let k = 0; k < n; k++) hmC[k] = 1 - 0.1 * Math.min(cs[k].boost, 1);
    for (let k = 0; k < n; k++) {
      const s1 = 1 - cs[k].sig; if (s1 < 0.001) continue;
      [[-1, 0.16], [1, 0.16], [-2, 0.06], [2, 0.06]].forEach(([d, f]) => { const kk = k + d; if (kk >= 0 && kk < n) hmC[kk] -= f * s1; });
    }
    for (let k = 0; k < n; k++) hmC[k] = Math.max(0.72, hmC[k]);
    hmB[0] = hmC[0]; hmB[n] = hmC[n - 1];
    for (let k = 1; k < n; k++) hmB[k] = (hmC[k - 1] + hmC[k]) / 2;
    dlt[0] = 0; dlt[n] = 0;
    for (let k = 1; k < n; k++) { const a = cs[k - 1], b = cs[k]; dlt[k] = (ch.crypt && b.l < ch.lCE) ? 0 : 0.28 * (myo[k] - myo[k - 1]) * Math.min(a.A, b.A); }
  }
  buildApical();
  // ---------------- pass 2: basal faces, cut faces and annotations
  for (let ci = 0; ci < CHAINS.length; ci++) {
    const ch = CHAINS[ci], D = CS[ci]; if (!D.ok) continue;
    const cs = LS.ch[ci].cells, n = D.n, myo = D.myo, bnd = D.bnd, bndA = D.bndA, dlt = D.dlt, hmC = D.hmC, hmB = D.hmB;
    const cutSide = cutaway ? ch.cut : null, NB = NBR[ci];
    for (let k = 0; k < n; k++) {
      const c = cs[k];
      const la0 = bndA[k], la1 = bndA[k + 1];
      let lb0 = bnd[k] + dlt[k], lb1 = bnd[k + 1] + dlt[k + 1];
      if (la1 - la0 < 1e-4) continue;
      if (lb1 < lb0 + 0.01) { const mid = (lb0 + lb1) / 2; lb0 = mid - 0.005; lb1 = mid + 0.005; }
      SIM.samp(ch, lb0, SB[0]); SIM.samp(ch, (lb0 + lb1) / 2, SB[1]); SIM.samp(ch, lb1, SB[2]);
      SIM.samp(ch, la0, SA[0]); SIM.samp(ch, (la0 + la1) / 2, SA[1]); SIM.samp(ch, la1, SA[2]);
      const lift = 1 - c.sig, dome = D.dome[k];
      for (let q = 0; q < 3; q++) {
        const sb = SB[q], sa = SA[q], h = sa[18];
        off(BL[q], sb, 6, 9, 0); off(BR[q], sb, 12, 15, 0);
        const hmx = q === 0 ? hmB[k] : q === 2 ? hmB[k + 1] : hmC[k];
        const ah = h * (hmx + (q === 1 ? dome + 0.62 * lift : 0.35 * dome + 0.48 * lift));
        off(AL[q], sa, 6, 9, ah); off(AR[q], sa, 12, 15, ah);
      }
      const idc = identity(ch, c, cA);
      if (c.trk && J.phase === 'extrude' && J.te < 0.15) idc.lerp(FLASH, 0.8 * bump(0, 0.15, J.te));
      const apc = modeColour(ch, c, myo[k], idc, cB);
      if (outlineMode === 'none' && !c.trk) apc.multiplyScalar(0.985 + 0.03 * ((c.id * 0.618) % 1));
      const n1 = SA[1];
      const inCrypt = ch.crypt && c.l < ch.lCE;
      cC.copy(colourMode === 'id' ? idc : apc).multiplyScalar(0.86); if (!inCrypt && (colourMode === 'id' || colourMode === 'am')) cC.lerp(C_.tension, clamp(0.1 + 0.55 * myo[k]));
      quad(BL[0], BR[0], BR[1], BL[1], -n1[3], -n1[4], -n1[5], cC);
      quad(BL[1], BR[1], BR[2], BL[2], -n1[3], -n1[4], -n1[5], cC);
      if (c.trk) { trkInfo.pos.set((AL[1][0] + AR[1][0]) / 2, (AL[1][1] + AR[1][1]) / 2, (AL[1][2] + AR[1][2]) / 2); trkInfo.ok = true; }
      if (!cutSide) continue;
      // ---- cut face: the cell in profile, with its actomyosin, nucleus and forces
      const B = cutSide === 'l' ? BL : BR, A = cutSide === 'l' ? AL : AR;
      { const si = SIDX[ci][k], S_ = si >= 0 ? SITES[si] : null;
        if (S_ && S_.cN === 2) {
          const dA_ = (S_.cA[0] - A[0][0]) ** 2 + (S_.cA[1] - A[0][1]) ** 2, dB_ = (S_.cB[0] - A[0][0]) ** 2 + (S_.cB[1] - A[0][1]) ** 2;
          const p0 = dA_ <= dB_ ? S_.cA : S_.cB, p2 = dA_ <= dB_ ? S_.cB : S_.cA;
          for (let w = 0; w < 3; w++) { A[0][w] = p0[w]; A[2][w] = p2[w]; A[1][w] = (p0[w] + p2[w]) / 2; }
        } }
      cTmp.copy(apc).lerp(WHITE, 0.12);
      quad(B[0], B[1], A[1], A[0], 0, 0, 1, cTmp); quad(B[1], B[2], A[2], A[1], 0, 0, 1, cTmp);
      line(B[0], B[1], 0, 0, 0.003); line(B[1], B[2], 0, 0, 0.003); line(A[0], A[1], 0, 0, 0.003); line(A[1], A[2], 0, 0, 0.003); line(B[2], A[2], 0, 0, 0.003);
      if (k === 0) line(B[0], A[0], 0, 0, 0.003);
      const nx = SA[1][cutSide === 'l' ? 9 : 15], ny = SA[1][cutSide === 'l' ? 10 : 16];
      let ux = A[2][0] - A[0][0], uy = A[2][1] - A[0][1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      const h = SA[1][18];
      const tb = inCrypt ? 0.008 : 0.01 + 0.05 * myo[k];
      aQuad(B[0], B[1], [B[1][0] + nx * tb, B[1][1] + ny * tb], [B[0][0] + nx * tb, B[0][1] + ny * tb], C_.tension);
      aQuad(B[1], B[2], [B[2][0] + nx * tb, B[2][1] + ny * tb], [B[1][0] + nx * tb, B[1][1] + ny * tb], C_.tension);
      if (ch.crypt && c.l < ch.lCE + 0.3) {
        const ta = 0.012 + 0.035 * (1 - smooth(ch.lTA - 0.4, ch.lCE + 0.2, c.l));
        aQuad(A[0], A[1], [A[1][0] - nx * ta, A[1][1] - ny * ta], [A[0][0] - nx * ta, A[0][1] - ny * ta], C_.tension);
        aQuad(A[1], A[2], [A[2][0] - nx * ta, A[2][1] - ny * ta], [A[1][0] - nx * ta, A[1][1] - ny * ta], C_.tension);
      }
      // nucleus: rises to the apical surface for mitosis and returns to the base in the daughters
      // sized by the cell's width at the nucleus's height (the apical edge alone can be tiny in the narrow crypt lumen),
      // never smaller than a visible minimum, and oriented along the cell base
      const nf = D.nuc[k], ncx = B[1][0] + (A[1][0] - B[1][0]) * nf, ncy = B[1][1] + (A[1][1] - B[1][1]) * nf;
      const wb = Math.hypot(B[2][0] - B[0][0], B[2][1] - B[0][1]) || 1e-6;
      ux = (B[2][0] - B[0][0]) / wb; uy = (B[2][1] - B[0][1]) / wb;
      const ra = clamp(0.36 * lerp(wb, ul, nf), 0.016, 0.06), rb = 0.2 * h;
      cTmp.copy(colourMode === 'id' ? idc : apc).lerp(WHITE, 0.6);
      if (!(c.mit > 0.3)) for (let q = 0; q < 10; q++) {
        const a0 = q / 10 * Math.PI * 2, a1 = (q + 1) / 10 * Math.PI * 2;
        aTri(ncx, ncy, ncx + ux * ra * Math.cos(a0) + nx * rb * Math.sin(a0), ncy + uy * ra * Math.cos(a0) + ny * rb * Math.sin(a0),
             ncx + ux * ra * Math.cos(a1) + nx * rb * Math.sin(a1), ncy + uy * ra * Math.cos(a1) + ny * rb * Math.sin(a1), cTmp);
      }
      if (c.mit > 0.3) {                   // metaphase plate across the spindle, then the two sets moving apart parallel to the sheet
        const sep = 0.03 * smooth(0.7, 0.95, c.mit), bars = sep > 0.002 ? [-sep, sep] : [0];
        bars.forEach(sx => { const cx = ncx + ux * sx, cy = ncy + uy * sx;
          aQuad([cx - ux * 0.007 - nx * 0.04, cy - uy * 0.007 - ny * 0.04], [cx + ux * 0.007 - nx * 0.04, cy + uy * 0.007 - ny * 0.04], [cx + ux * 0.007 + nx * 0.04, cy + uy * 0.007 + ny * 0.04], [cx - ux * 0.007 + nx * 0.04, cy - uy * 0.007 + ny * 0.04], CHROM); });
        [-1, 1].forEach(sg => { const px = ncx + ux * 0.055 * sg, py = ncy + uy * 0.055 * sg; aQuad([px - 0.008, py - 0.008], [px + 0.008, py - 0.008], [px + 0.008, py + 0.008], [px - 0.008, py + 0.008], SPINC); });
      }
      // pushed by a division: cells next to fresh daughters move away from them
      if (!c.fixed && c.mit < 0 && D.nuc[k] <= 0.43) {
        let dir = 0;
        for (let d = 1; d <= 2 && !dir; d++) {
          if (k + d < n && LS.mt - cs[k + d].bornT < 0.9) dir = -1;
          else if (k - d >= 0 && LS.mt - cs[k - d].bornT < 0.9) dir = 1;
        }
        if (dir) {
          const px = B[1][0] + (A[1][0] - B[1][0]) * 0.72, py = B[1][1] + (A[1][1] - B[1][1]) * 0.72, L = 0.09;
          aTri(px + ux * L / 2 * dir, py + uy * L / 2 * dir, px - ux * L / 2 * dir - nx * 0.03, py - uy * L / 2 * dir - ny * 0.03, px - ux * L / 2 * dir + nx * 0.03, py - uy * L / 2 * dir + ny * 0.03, PUSHC);
        }
      }
      // cryptic lamellipodium: from the cell's leading basal corner forward, under the cell ahead
      if (!inCrypt && c.sig > 0.9 && k < n - 1) {
        const lam = ch.kind === 'in' && c.l > ch.lV0 ? lerp(0.55, 1, clamp((c.l - ch.lV0) / (ch.lTip0 - ch.lV0))) : 0.4;
        const Lw = 0.58 * ul * lam, Hw = 0.32 * h * lam, x2 = B[2][0], y2 = B[2][1];
        aZ = 0.007;
        aQuad([x2 - ux * 0.03, y2 - uy * 0.03], [x2 + ux * Lw + nx * 0.008, y2 + uy * Lw + ny * 0.008],
              [x2 + ux * Lw * 0.5 + nx * Hw * 0.55, y2 + uy * Lw * 0.5 + ny * Hw * 0.55], [x2 - ux * 0.03 + nx * Hw, y2 - uy * 0.03 + ny * Hw], LAMC);
        aZ = 0.004;
      }
      const tr = tractionAt(ch, (la0 + la1) / 2), bx = B[1][0] - nx * 0.05, by = B[1][1] - ny * 0.05;
      if (Math.abs(tr) < 0.1) aQuad([bx - 0.012, by - 0.012], [bx + 0.012, by - 0.012], [bx + 0.012, by + 0.012], [bx - 0.012, by + 0.012], C_.traction);
      else {
        const L = 0.04 + 0.06 * Math.abs(tr), sx = ux * Math.sign(tr), sy = uy * Math.sign(tr);
        aQuad([bx - sx * L / 2 - nx * 0.006, by - sy * L / 2 - ny * 0.006], [bx + sx * L * 0.1 - nx * 0.006, by + sy * L * 0.1 - ny * 0.006],
              [bx + sx * L * 0.1 + nx * 0.006, by + sy * L * 0.1 + ny * 0.006], [bx - sx * L / 2 + nx * 0.006, by - sy * L / 2 + ny * 0.006], C_.traction);
        aTri(bx + sx * L / 2, by + sy * L / 2, bx + sx * L * 0.05 - nx * 0.022, by + sy * L * 0.05 - ny * 0.022, bx + sx * L * 0.05 + nx * 0.022, by + sy * L * 0.05 + ny * 0.022, C_.traction);
      }
      // pulled up: moving faster than the flow field, i.e. responding to a vacancy ahead
      const ex = c.v - SIM.vField(ch, c.l);
      if (!c.fixed && ex > 0.035 && !(ch.crypt && c.l < ch.lTA)) {
        const L = Math.min(0.16, 0.05 + 0.35 * ex), px = A[1][0] + nx * 0.07, py = A[1][1] + ny * 0.07;
        aTri(px + ux * L / 2, py + uy * L / 2, px - ux * L / 2 - nx * 0.03, py - uy * L / 2 - ny * 0.03, px - ux * L / 2 + nx * 0.03, py - uy * L / 2 + ny * 0.03, PULLC);
      }
    }
  }
  tGeo.setDrawRange(0, nv); tGeo.attributes.position.needsUpdate = tGeo.attributes.normal.needsUpdate = tGeo.attributes.color.needsUpdate = true;
  lGeo.setDrawRange(0, nl); lGeo.attributes.position.needsUpdate = true;
  aGeo.setDrawRange(0, na); aGeo.attributes.position.needsUpdate = aGeo.attributes.color.needsUpdate = true;
  annot.visible = cutaway;
}

// extruded cells, from the look-ahead event log
const BALLN = 240;
const balls = new T.InstancedMesh(new T.SphereGeometry(1, 14, 10), new T.MeshStandardMaterial({ color: '#E5C9D6', roughness: 0.6 }), BALLN);
balls.frustumCulled = false; scene.add(balls);
const trkBall = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshStandardMaterial({ color: COL.tracked, roughness: 0.5, emissive: '#6B4FA0', emissiveIntensity: 0.25 }));
scene.add(trkBall);
const halo = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshBasicMaterial({ color: '#8E6CCB', transparent: true, opacity: 0.2, depthTest: false, depthWrite: false }));
halo.renderOrder = 10; scene.add(halo);
const pinDot = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({ color: '#7A55C0', depthTest: false }));
pinDot.renderOrder = 11; scene.add(pinDot);
const m4 = new T.Matrix4(), q0 = new T.Quaternion(), v3 = new T.Vector3(), s3 = new T.Vector3();
const eS = new Float32Array(ST);
let evFrom = 0, toastOn = false;
// the "a cell leaves" notice only when the tip is what one is looking at: the followed cell has reached the tip zone,
// or the overview is zoomed in on the tip (its radius spans more than a sixth of the view's width)
function tipInView() {
  v3.set(0, G.H + 0.5 * G.R, 0).project(camera);
  if (v3.z > 1 || Math.abs(v3.x) > 0.9 || Math.abs(v3.y) > 0.9) return false;
  const x0 = v3.x; v3.set(G.R, G.H + 0.5 * G.R, 0).project(camera);
  return Math.abs(v3.x - x0) / 2 > 0.16;
}
function updateExtruded() {
  const now = LS.t, ev = AS.events;
  while (evFrom > 0 && ev[evFrom - 1].t > now - 3) evFrom--;
  while (evFrom < ev.length && ev[evFrom].t < now - 3) evFrom++;
  let k = 0, toast = null;
  for (let i = evFrom; i < ev.length && ev[i].t <= now; i++) {
    const e = ev[i], ch = CHAINS[e.ch]; if (e.trk || (cutaway && !ch.back)) continue;
    const age = now - e.t;
    SIM.samp(ch, e.l, eS);
    v3.set(eS[0], eS[1], eS[2]).addScaledVector(s3.set(eS[3], eS[4], eS[5]), eS[18] + 0.06 + age * 0.3); v3.y += age * 0.08;
    m4.compose(v3, q0, s3.setScalar(0.07 * (1 - 0.45 * age / 3)));
    if (k < BALLN) balls.setMatrixAt(k++, m4);
    if (cutaway && ch.cut && ch.kind === 'in' && age < 2.6) toast = { e, age };
  }
  balls.count = k; balls.instanceMatrix.needsUpdate = true;
  const J = LS.trk;
  trkBall.visible = !!J.gone;
  if (J.gone) {
    SIM.samp(CHAINS[J.ch], J.exitL, eS);
    const tl = J.tl || 0, up = 0.1 + 0.2 * smooth(0.88, 1, J.te) + 0.9 * tl;
    trkBall.position.set(eS[0], eS[1], eS[2]).addScaledVector(s3.set(eS[3], eS[4], eS[5]), eS[18] + up);
    trkBall.position.y += 0.4 * tl;
    const g = smooth(0.85, 1, tl);
    trkBall.scale.setScalar(0.11 * (1 - 0.2 * g));
    trkBall.material.color.set(COL.tracked).lerp(col('#A39DAA'), g);
    trkInfo.pos.copy(trkBall.position); trkInfo.ok = true;
  }
  const el = $('toast');
  if (toast && showLabels && (SIM.journeyS(LS) >= 0.80 || tipInView())) {
    SIM.samp(CHAINS[toast.e.ch], toast.e.l, eS);
    v3.set(-eS[0], eS[1] + 0.25, 0.02).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const sx = (v3.x + 1) / 2 * w, sy = (1 - v3.y) / 2 * h;
    el.style.left = Math.min(w - 140, sx + 150) + 'px'; el.style.top = Math.max(70, sy + 40) + 'px';
    if (!el.dataset.txt) { el.innerHTML = '<b>A cell leaves.</b> Its neighbours close the gap and their myosin rises; in this model they then pull up the cells behind them.'; el.dataset.txt = '1'; }
    el.style.opacity = toast.age < 2.2 ? 1 : 0;
    toastOn = toast.age < 2.2;
  } else { el.style.opacity = 0; toastOn = false; }
}

// ---------------------------------------------------------------- orbit controls (small, dependency-free)
function Orbit(cam, el, target, opts) {
  const o = { target: target.clone(), r: opts.r, th: opts.th, ph: opts.ph, min: opts.min || 1, max: opts.max || 60 };
  let drag = null, lx = 0, ly = 0, pinch0 = 0; const pts = new Map();
  const update = () => {
    o.ph = clamp(o.ph, 0.08, Math.PI - 0.08); o.r = clamp(o.r, o.min, o.max);
    cam.position.set(o.target.x + o.r * Math.sin(o.ph) * Math.sin(o.th), o.target.y + o.r * Math.cos(o.ph), o.target.z + o.r * Math.sin(o.ph) * Math.cos(o.th));
    cam.lookAt(o.target);
  };
  const pan = (dx, dy) => {
    const s = o.r * 0.0016, right = new T.Vector3().setFromMatrixColumn(cam.matrix, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrix, 1);
    o.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
  };
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    try { el.setPointerCapture(e.pointerId); } catch (_) {} pts.set(e.pointerId, [e.clientX, e.clientY]);
    drag = (e.button === 2 || e.shiftKey) ? 'pan' : 'rot'; if (pts.size === 1) { lx = e.clientX; ly = e.clientY; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  el.addEventListener('pointermove', e => {
    if (!drag || !pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); o.moved = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) o.r *= pinch0 / d; pinch0 = d; update(); return; }
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    if (drag === 'rot') { o.th -= dx * 0.006; o.ph -= dy * 0.006; } else pan(dx, dy);
    update();
  });
  const end = e => { pts.delete(e.pointerId); if (!pts.size) drag = null; else { const [q] = [...pts.values()]; lx = q[0]; ly = q[1]; } pinch0 = 0; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => { e.preventDefault(); o.r *= Math.exp(e.deltaY * 0.0012); o.moved = true; update(); }, { passive: false });
  o.update = update; update(); return o;
}
const HOME = { t: new T.Vector3(-0.1, 2.3, 0), r: 19.5, th: -0.28, ph: 1.36 };
const orbit = Orbit(camera, canvas, HOME.t, { r: HOME.r, th: HOME.th, ph: HOME.ph, min: 2, max: 40 });

// HTML labels beside the right-hand cut face
const lS = new Float32Array(ST);
// Labels sit to the right of the tissue: the followed cell travels on the left, and the tissue is mirror-symmetric, so the
// right side at the same height shows the same zone. Crypt-level labels go just outside the tissue block (clear of the
// right crypt), villus labels beside the right villus wall. Positions are in world coordinates (no mirroring) and fixed.
const X_OUT = 3.3, X_VIL = G.R + 0.55;
function lab(l, x, dy) { SIM.samp(CHAINS[TRK_CH], l, lS); return new T.Vector3(x === null ? lS[0] + 0.55 : x, lS[1] + dy, 0); }
const LABELS = [
  { t: 'Stem cell niche', s: 'Lgr5⁺ cells between Paneth cells', p: () => lab(0.25, X_OUT, -0.1) },
  { t: 'Transit-amplifying zone', s: 'pushed by division', p: () => lab(1.5, X_OUT, 0) },
  { t: 'Hinge', s: 'traction reverses', p: () => lab(CHAINS[TRK_CH].lCE, X_OUT, 0.35) },
  { t: 'Lower villus', s: 'active migration begins · 3–4.5 µm/h', p: () => lab(CHAINS[TRK_CH].lV0 + 1.3, X_VIL, 0) },
  { t: 'Upper villus', s: 'active migration dominates · 5–8 µm/h', p: () => lab(CHAINS[TRK_CH].lV0 + 4.2, X_VIL, 0) },
  { t: 'Villus tip', s: 'the cell that cannot hold its share leaves', p: () => new T.Vector3(G.R + 0.45, G.H + 0.75 * G.R, 0) }
];
const labelLayer = $('labels');
LABELS.forEach(l => { l.el = document.createElement('div'); l.el.className = l.c ? 'lbl' : 'lbl r'; l.el.innerHTML = `<b>${l.t}</b><span>${l.s}</span>`; labelLayer.appendChild(l.el); });
let showLabels = true;
const OVL = [
  { ov: 'eph', t: 'EphB3', s: 'Paneth and crypt base columnar cells', p: () => lab(0.1, X_OUT, -0.3) },
  { ov: 'eph', t: 'EphB2', s: 'peaks at positions 4–6, falls toward the crypt top', p: () => lab(0.9, X_OUT, 0) },
  { ov: 'eph', t: 'ephrin-B1 / B2', s: 'highest at the crypt–villus junction', p: () => lab(CHAINS[TRK_CH].lCE, X_OUT, 0.55) },
  ...[0, 1, 2, 3, 4, 5].map(z => ({ ov: 'moor', t: 'V' + (z + 1), s: MOOR_TXT[z], p: () => lab(CHAINS[TRK_CH].lV0 + (z + 0.5) / 6 * (CHAINS[TRK_CH].lP - CHAINS[TRK_CH].lV0), z === 5 ? null : X_VIL, z === 5 ? 0.3 : 0) }))
];
OVL.forEach(l => { l.el = document.createElement('div'); l.el.className = 'lbl r'; l.el.style.opacity = '0'; l.el.innerHTML = `<b>${l.t}</b><span>${l.s}</span>`; labelLayer.appendChild(l.el); });
// labels: fixed anchors, positions eased and rounded to whole pixels, fading in and out instead of popping
function placeLabel(l, v, show, w, h) {
  if (show) {
    const tx = (v.x + 1) / 2 * w, ty = (1 - v.y) / 2 * h;
    if (l.sx === undefined || jumped || l.op === '0' || Math.abs(tx - l.sx) + Math.abs(ty - l.sy) > 90) { l.sx = tx; l.sy = ty; }
    else { l.sx += (tx - l.sx) * 0.25; l.sy += (ty - l.sy) * 0.25; }
    const bw = l.bw || (l.bw = l.el.offsetWidth), x = l.c ? l.sx : Math.min(l.sx, w - bw - 6);   // keep the box inside the view
    const tr = `translate(${Math.round(x)}px,${Math.round(l.sy)}px) translate(${l.c ? '-50%' : '0'},-50%)`;
    if (tr !== l.tr) { l.el.style.transform = tr; l.tr = tr; }
  }
  const op = show ? '1' : '0'; if (op !== l.op) { l.el.style.opacity = op; l.op = op; }
}
function updateLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight, v = new T.Vector3();
  const onScreen = () => v.z < 1 && v.x > -1.02 && v.x < 0.97 && Math.abs(v.y) < 0.97;
  LABELS.forEach(l => {
    v.copy(l.P || (l.P = l.p())).project(camera);
    const show = showLabels && onScreen()
      && !(colourMode === 'moor' && (l.t === 'Lower villus' || l.t === 'Upper villus')) && !(isEph(colourMode) && (l.t === 'Hinge' || l.t === 'Stem cell niche' || l.t === 'Transit-amplifying zone'));
    placeLabel(l, v, show, w, h);
  });
  OVL.forEach(l => {
    v.copy(l.P || (l.P = l.p())).project(camera);
    placeLabel(l, v, showLabels && l.ov === (isEph(colourMode) ? 'eph' : colourMode) && onScreen(), w, h);
  });
}

// =================================================================== CLOSE-UP SCENE
const ccan = $('close');
const cr = new T.WebGLRenderer({ canvas: ccan, antialias: true, alpha: true });
cr.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const cs = new T.Scene();
const ccam = new T.PerspectiveCamera(30, 1, 0.1, 100);
cs.add(new T.HemisphereLight(0xffffff, 0xe6ddee, 1.5));
const cdl = new T.DirectionalLight(0xffffff, 0.8); cdl.position.set(3, 6, 8); cs.add(cdl);
const corbit = Orbit(ccam, ccan, new T.Vector3(0, 1.0, -0.8), { r: 14.5, th: 0.34, ph: 1.36, min: 6, max: 30 });

const N = 33, CI = 16, W = 1, ROWS = 3, ZD = 0.94;             // CI must stay even (stem/Paneth alternation)
// a fixed draw order for the close-up's pooled objects (all share the origin, so three.js cannot sort them by depth):
// cell bodies, then force symbols, then nuclei and dots - otherwise a cell drawn after its nucleus paints over it
const pool = (make, ro = 0) => { const a = []; let i = 0; return { get() { if (i >= a.length) { const o = make(); o.renderOrder = ro; a.push(o); cs.add(o); } const o = a[i++]; o.visible = true; return o; }, reset() { a.forEach(o => o.visible = false); i = 0; } }; };
const cellPool = pool(() => new T.Mesh(new T.BufferGeometry(), new T.MeshStandardMaterial({ roughness: 0.8, transparent: true })));
const segGeo = new T.CylinderGeometry(1, 1, 1, 8); segGeo.translate(0, 0.5, 0);
const segPool = pool(() => new T.Mesh(segGeo, new T.MeshStandardMaterial({ roughness: 0.6, transparent: true })), 2);
const coneGeo = new T.ConeGeometry(1, 1, 14); coneGeo.translate(0, -0.5, 0);
const conePool = pool(() => new T.Mesh(coneGeo, new T.MeshStandardMaterial({ roughness: 0.6, transparent: true })), 2);
const discGeo = new T.CircleGeometry(1, 28);
const discPool = pool(() => new T.Mesh(discGeo, new T.MeshBasicMaterial({ transparent: true, depthWrite: false })), 3);
const ballGeo = new T.SphereGeometry(1, 28, 20);
const ballPool = pool(() => new T.Mesh(ballGeo, new T.MeshStandardMaterial({ roughness: 0.55, transparent: true })), 3);
const bmMesh = new T.Mesh(new T.BufferGeometry(), new T.MeshStandardMaterial({ side: T.DoubleSide, roughness: 0.9, transparent: true, opacity: 0.9 }));
cs.add(bmMesh);
const CLMAX = 4000, clPos = new Float32Array(CLMAX * 3), clGeo = new T.BufferGeometry();
{ const b = new T.BufferAttribute(clPos, 3); b.setUsage(T.DynamicDrawUsage); clGeo.setAttribute('position', b); }
const cLines = new T.LineSegments(clGeo, new T.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.9 }));
cLines.frustumCulled = false; cLines.renderOrder = 1; cs.add(cLines);
let ncl = 0;
const cl = (a, b) => { if (ncl + 2 > CLMAX) return; const o = ncl * 3; clPos[o] = a.x; clPos[o + 1] = a.y; clPos[o + 2] = a.z; clPos[o + 3] = b.x; clPos[o + 4] = b.y; clPos[o + 5] = b.z; ncl += 2; };

const Y = new T.Vector3(0, 1, 0);
function seg(a, b, rad, color, op = 1) {
  const m = segPool.get(), d = new T.Vector3().subVectors(b, a), L = d.length(); if (L < 1e-4) { m.visible = false; return; }
  m.position.copy(a); m.quaternion.setFromUnitVectors(Y, d.divideScalar(L)); m.scale.set(rad, L, rad);
  m.material.color.set(color); m.material.opacity = op;
}
function arrow(a, dir, len, rad, color, op = 1, double = false) {
  const d = dir.clone().normalize(), hl = Math.min(rad * 4.5, len * 0.45);
  const b = a.clone().addScaledVector(d, len), a2 = double ? a.clone().addScaledVector(d, hl) : a;
  seg(a2, b.clone().addScaledVector(d, -hl), rad, color, op);
  const c = conePool.get(); c.position.copy(b); c.quaternion.setFromUnitVectors(Y, d); c.scale.set(rad * 2.4, hl, rad * 2.4); c.material.color.set(color); c.material.opacity = op;
  if (double) { const c2 = conePool.get(); c2.position.copy(a); c2.quaternion.setFromUnitVectors(Y, d.clone().negate()); c2.scale.set(rad * 2.4, hl, rad * 2.4); c2.material.color.set(color); c2.material.opacity = op; }
}
function disc(p, rx, ry, color, op) { const m = discPool.get(); m.position.copy(p); m.quaternion.identity(); m.scale.set(rx, ry, 1); m.material.color.set(color); m.material.opacity = op; return m; }
function ball(p, r_, color, op = 1, emissive = '#000000', ei = 0) {
  const m = ballPool.get(); m.position.copy(p); m.scale.setScalar(r_); m.material.color.set(color); m.material.opacity = op;
  m.material.emissive.set(emissive); m.material.emissiveIntensity = ei; return m;
}
function bmAt(x, k) {
  if (Math.abs(k) < 1e-4) return { p: [x, 0], n: [0, 1], t: [1, 0] };
  const xa = Math.PI / 2 / Math.abs(k), xc = clamp(x, -xa, xa), a = k * xc, e = x - xc, c = Math.cos(a), sn = Math.sin(a);
  return { p: [sn / k + c * e, (1 - c) / k + sn * e], n: [-sn, c], t: [c, sn] };   // an arc up to a quarter turn, then straight
}
const add2 = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s];
const mix2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
// prism from a 2D outline (may be non-convex); neighbouring cells share edges exactly, boundaries are drawn as lines.
// Buffers are reused frame to frame.
const PMAX = 64 * 12;
function prismGeo(mesh, ptsIn, z0, z1) {
  let g = mesh.geometry;
  if (!g.userData.pos) {
    g.dispose(); g = mesh.geometry = new T.BufferGeometry();
    const pa = new T.BufferAttribute(new Float32Array(PMAX * 3), 3), na_ = new T.BufferAttribute(new Float32Array(PMAX * 3), 3);
    pa.setUsage(T.DynamicDrawUsage); na_.setUsage(T.DynamicDrawUsage);
    g.setAttribute('position', pa); g.setAttribute('normal', na_); g.userData.pos = pa; g.userData.nor = na_;
    mesh.frustumCulled = false;
  }
  const pts = [];
  for (const q of ptsIn) { const r = pts[pts.length - 1]; if (!r || Math.abs(q[0] - r[0]) + Math.abs(q[1] - r[1]) > 1e-4) pts.push(q); }
  while (pts.length > 3 && Math.abs(pts[0][0] - pts[pts.length - 1][0]) + Math.abs(pts[0][1] - pts[pts.length - 1][1]) < 1e-4) pts.pop();
  const n = Math.min(pts.length, 58);
  if (n < 3) { g.setDrawRange(0, 0); return [0, 0]; }
  let ar = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; }
  const Q = pts.slice(0, n); if (ar < 0) Q.reverse();
  let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += Q[i][0]; cy += Q[i][1]; } cx /= n; cy /= n;
  const tris = n === 3 ? [[0, 1, 2]] : T.ShapeUtils.triangulateShape(Q.map(q => new T.Vector2(q[0], q[1])), []);
  const P = g.userData.pos.array, Nn = g.userData.nor.array;
  let v = 0;
  const put = (x, y, z, nx, ny, nz) => { P[v] = x; P[v + 1] = y; P[v + 2] = z; Nn[v] = nx; Nn[v + 1] = ny; Nn[v + 2] = nz; v += 3; };
  for (const t of tris) {
    let [a, b, c] = t; const A = Q[a], B = Q[b], C = Q[c];
    if ((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) < 0) [b, c] = [c, b];
    put(Q[a][0], Q[a][1], z1, 0, 0, 1); put(Q[b][0], Q[b][1], z1, 0, 0, 1); put(Q[c][0], Q[c][1], z1, 0, 0, 1);
    put(Q[a][0], Q[a][1], z0, 0, 0, -1); put(Q[c][0], Q[c][1], z0, 0, 0, -1); put(Q[b][0], Q[b][1], z0, 0, 0, -1);
  }
  for (let i = 0; i < n; i++) {
    const a = Q[i], b = Q[(i + 1) % n];
    let sx = b[1] - a[1], sy = -(b[0] - a[0]); const sl = Math.hypot(sx, sy) || 1; sx /= sl; sy /= sl;
    put(a[0], a[1], z0, sx, sy, 0); put(b[0], b[1], z0, sx, sy, 0); put(b[0], b[1], z1, sx, sy, 0);
    put(a[0], a[1], z0, sx, sy, 0); put(b[0], b[1], z1, sx, sy, 0); put(a[0], a[1], z1, sx, sy, 0);
  }
  g.setDrawRange(0, v / 3); g.userData.pos.needsUpdate = true; g.userData.nor.needsUpdate = true;
  return [cx, cy];
}
const cColor = new T.Color();
// lineage colour in the close-up: only true members of the followed clone, read from the cells next to it in its column
// (its sisters sit behind it, the labelled stem's later daughters behind them; the cells ahead predate the label)
const CLONE = new Uint8Array(N); let SISC = 0;
function cloneMask(J) {
  CLONE.fill(0); SISC = 0; const T_ = LS.trk; if (!T_) return;
  const cs = LS.ch[T_.ch].cells; let kT = -1;
  if (T_.phase === 'niche') kT = 2;
  else { for (let k = cs.length - 1; k >= 0; k--) if (cs[k].trk) { kT = k; break; } if (kT < 0) for (let k = cs.length - 1; k >= 0; k--) if (cs[k].cl) { kT = k + 1; break; } }
  if (kT < 0) return;
  const split = !J.mit && J.dA >= 0, cl = k => k >= 0 && k < cs.length && cs[k].cl ? 1 : 0;
  if (split) SISC = cl(kT - 1);
  for (let i = 0; i < N; i++) CLONE[i] = i === CI ? 1 : i < CI ? cl(kT - (CI - i) - (split ? 1 : 0)) : cl(kT + (i - CI));
}
// The close-up follows the real path of the followed column: its basement membrane in the cut plane, from the crypt pole
// over the crypt mouth and the villus base to the tip. It is drawn one cell at a time, and each cell turns the membrane
// as much as the real cell there does. The view is the mirror of the sim's coordinates, so the cell moves to the right,
// as it does in the overview.
// In the crypt the view first stays on the crypt bottom, and the followed daughter moves away as the cells between it and
// the stem are born (SIM.cuWidth counts cells: the sim packs them tighter near the base). Once the daughter is SIM.XSW
// cells from the stem, the view pans to it and from then on follows it. FOCP: 0 = on the crypt bottom, 1 = on the cell.
let FOCP = 1, FSIS_S = 0.05, FSIS_P = 0, CU_C = [0, 1], CU_UV = 0, CU_THV = 0, CU_LAY = true, CU_KT = -1, CU_SPLIT = false;
const FS = new Float64Array(N), FP = new Uint8Array(N), FSR = new Float64Array(N), KC = new Int32Array(N);
// tangent angle of the membrane by arc length l; 0 at the crypt pole
const PTH_DL = 0.01, PTH = (() => {
  const ch = CHAINS[TRK_CH], o = new Float64Array(ST), bi = ch.cut === 'l' ? 6 : 12, n = Math.ceil(ch.L / PTH_DL) + 1, A = new Float64Array(n);
  let last = 0, un = 0;
  for (let i = 0; i < n; i++) {
    const l = Math.min(i * PTH_DL, ch.L - 0.004); SIM.samp(ch, l, o); const ax = o[bi], ay = o[bi + 1]; SIM.samp(ch, l + 0.003, o);
    const th = Math.atan2(o[bi + 1] - ay, ax - o[bi]);
    if (i) { let d = th - last; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); un += d; } else un = th;
    last = th; A[i] = un;
  }
  const a0 = A[0]; for (let i = 0; i < n; i++) A[i] -= a0;
  return A;
})();
const PTH_L = (PTH.length - 1) * PTH_DL;
function pathTh(l) {
  if (l < 0) return -pathTh(-l);                                            // the far side of the crypt bottom mirrors this one
  if (l > PTH_L) return 2 * pathTh(PTH_L) - pathTh(Math.max(0, 2 * PTH_L - l)); // beyond the apex the dome continues
  const x = Math.min(l / PTH_DL, PTH.length - 1.0001), i = x | 0; return PTH[i] + (PTH[i + 1] - PTH[i]) * (x - i);
}
// cell boundaries of the followed column: k -> u (cells from the pole) and l (arc length); negative k mirror positive k
const KOFF = 40, KMAX = 480, UK = new Float64Array(KMAX), LKA = new Float64Array(KMAX); let KHI = 0;
const uK = k => { const q = clamp(k, -KOFF, KHI); return UK[q + KOFF] + (k - q); };
function lOfU(u) {
  let lo = 0, hi = KHI + KOFF;
  if (u <= UK[lo]) return LKA[lo] + (u - UK[lo]) * (LKA[lo + 1] - LKA[lo]) / (UK[lo + 1] - UK[lo]);
  if (u >= UK[hi]) return LKA[hi] + (u - UK[hi]) * (LKA[hi] - LKA[hi - 1]) / (UK[hi] - UK[hi - 1]);
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (UK[m] <= u) lo = m; else hi = m; }
  return LKA[lo] + (u - UK[lo]) * (LKA[hi] - LKA[lo]) / (UK[hi] - UK[lo]);
}
function uOfL(l) {
  let lo = 0, hi = KHI + KOFF;
  if (l <= LKA[lo]) return UK[lo]; if (l >= LKA[hi]) return UK[hi] + (l - LKA[hi]) * (UK[hi] - UK[hi - 1]) / (LKA[hi] - LKA[hi - 1]);
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (LKA[m] <= l) lo = m; else hi = m; }
  return UK[lo] + (l - LKA[lo]) * (UK[hi] - UK[lo]) / (LKA[hi] - LKA[lo]);
}
// the membrane around the view, sampled every CDU cells over ±CHW, level where the view is
const CDU = 0.05, CHW = 16, CUN = Math.round(2 * CHW / CDU) + 1, CPX = new Float64Array(CUN), CPY = new Float64Array(CUN), CTH = new Float64Array(CUN);
function BM(x) {
  const f = (x + CHW) / CDU;
  if (f <= 0 || f >= CUN - 1) {
    const i = f <= 0 ? 0 : CUN - 1, a = CTH[i] - CU_THV, d = (f - i) * CDU, c = Math.cos(a), sn = Math.sin(a);
    return { p: [CPX[i] + d * c, CPY[i] + d * sn], t: [c, sn], n: [-sn, c] };
  }
  const i = f | 0, g = f - i, a = CTH[i] + (CTH[i + 1] - CTH[i]) * g - CU_THV, c = Math.cos(a), sn = Math.sin(a);
  return { p: [CPX[i] + (CPX[i + 1] - CPX[i]) * g, CPY[i] + (CPY[i + 1] - CPY[i]) * g], t: [c, sn], n: [-sn, c] };
}
function closeLayout(J) {
  const T_ = LS.trk, cs = LS.ch[T_.ch].cells, n = cs.length;
  FOCP = T_.swT > -50 ? smooth(0, 3.5, LS.t - T_.swT) : (T_.phase === 'niche' || T_.phase === 'flow') ? 0 : 1;
  CU_LAY = T_.phase === 'niche' || T_.phase === 'flow';   // cells counted from the column (newborn pairs widen); later one width each
  const w = k => k >= 0 && k < n ? SIM.cuWidth(LS, cs, k) : 1;
  const lenE = n > 1 ? cs[n - 1].l - cs[n - 2].l : 0.2;
  KHI = Math.min(n + 30, KMAX - KOFF - 1);
  UK[KOFF] = 0; LKA[KOFF] = 0;
  for (let k = 1; k <= KHI; k++) { UK[k + KOFF] = UK[k - 1 + KOFF] + w(k - 1); LKA[k + KOFF] = k < n ? (cs[k - 1].l + cs[k].l) / 2 : cs[n - 1].l + (k - n + 0.5) * lenE; }
  for (let k = 1; k <= KOFF; k++) { UK[KOFF - k] = -UK[KOFF + k]; LKA[KOFF - k] = -LKA[KOFF + k]; }
  let kT = -1;
  if (T_.phase === 'niche') kT = 2; else if (!T_.gone) for (let k = n - 1; k >= 0; k--) if (cs[k].trk) { kT = k; break; }
  CU_KT = kT; CU_SPLIT = kT >= 0 && !J.mit && J.dA >= 0;
  const uT = kT >= 0 ? uK(kT) + w(kT) / 2 : uOfL(T_.exitL);
  CU_UV = uT * FOCP;
  // the view turns with the membrane, smoothed over a few cells so it does not swing at every corner
  let sv = 0; for (let q = -5; q <= 5; q++) sv += pathTh(lOfU(CU_UV + q * 0.5)); CU_THV = sv / 11;
  const c0 = Math.round(CHW / CDU);
  for (let i = 0; i < CUN; i++) CTH[i] = pathTh(lOfU(CU_UV - CHW + i * CDU));
  CPX[c0] = 0; CPY[c0] = 0;
  for (let i = c0; i < CUN - 1; i++) { const a = (CTH[i] + CTH[i + 1]) / 2 - CU_THV; CPX[i + 1] = CPX[i] + CDU * Math.cos(a); CPY[i + 1] = CPY[i] + CDU * Math.sin(a); }
  for (let i = c0; i > 0; i--) { const a = (CTH[i] + CTH[i - 1]) / 2 - CU_THV; CPX[i - 1] = CPX[i] - CDU * Math.cos(a); CPY[i - 1] = CPY[i] - CDU * Math.sin(a); }
  { const f = BM(uT - CU_UV), h = params(J.s).h; CU_C = add2(f.p, f.n, 0.62 * h); }       // the followed cell, for the camera
  // chain index of each front-row cell, and its identity: the stem and the cells around the crypt pole are niche cells
  const nicheP = kc => ((2 - kc) % 2 + 2) % 2;
  for (let i = 0; i < N; i++) {
    const kc = kT < 0 ? -999 : i < CI ? kT + (i - CI) - (CU_SPLIT ? 1 : 0) : kT + (i - CI);
    KC[i] = kc;
    const km = kc < 0 ? -kc - 1 : kc, nic = kc > -999 && km <= 2;
    FS[i] = nic ? 0.05 : 0.17; FP[i] = nic ? nicheP(km) : 0;
  }
  FSIS_S = kT - 1 <= 2 ? 0.05 : 0.17; FSIS_P = kT - 1 <= 2 ? nicheP(kT - 1) : 0;
}
function neighbourColor(s, i, row, sis) {
  let sc = s, par = i % 2;
  if (FOCP < 1 && (row || sis || i !== CI)) {                        // on the crypt bottom: each cell's own identity
    const fs = sis ? FSIS_S : row ? FSR[i - row] : FS[i], fp = sis ? FSIS_P : row ? i % 2 : FP[i];
    sc = lerp(fs, s, FOCP); if (FOCP < 0.5) par = fp;
  }
  const st = stageAt(sc);
  const base = st.id === 'niche' ? (par ? COL.paneth : COL.stem) : st.id === 'ta' ? COL.ta : st.id === 'hinge' ? COL.hinge : COL.diff;
  cColor.set(base);
  if (st.id === 'hinge') cColor.lerp(col(COL.ta), 1 - smooth(0.32, 0.35, sc)).lerp(col(COL.diff), smooth(0.39, 0.42, sc));
  if (colourMode !== 'id') {
    const paneth = st.id === 'niche' && par === 1;
    MO.type = paneth ? 'paneth' : 'x'; MO.ent = st.id !== 'niche' && st.id !== 'ta'; MO.m = params(sc).baM; MO.v = SPEEDV[st.id]; MO.idc = cColor;
    MO.lab = row ? 0 : (sis ? SISC : i === CI || (i >= 0 && i < N && CLONE[i])) ? CLAB : 0;
    modeColourAt(aOfS(sc), MO, cColor);
  }
  return cColor.getHex();
}
// closing the gap: each junction shifts half a cell toward it, one neighbour after the other
const SPEEDV = { niche: 0.0, ta: 0.04, hinge: 0.07, lower: 0.09, upper: 0.13, tip: 0.06, lumen: 0.0 };
// Outline of a dividing cell (or of its two daughters together) in the flat frame: right side (base -> apical level),
// cap above the apical level (right -> left), left side (apical level -> base). 'Rounded' is a round body at the apical
// surface on a thin basal process that stays on the matrix; 'rect' is a plain column; g blends rounded -> rect.
function unitOutline(x0, sw, Rb, dome, hA, rw, g) {
  const yc = hA + dome - Rb, sj = Math.min(sw, Rb * 0.97), yj = yc - Math.sqrt(Math.max(0, Rb * Rb - sj * sj));
  const phR = Math.atan2(yj - yc, sj), phH = Math.asin(clamp((hA - yc) / Rb, -1, 1));
  const rs = [[x0 + sj, 0], [x0 + sj, yj * 0.5], [x0 + sj, yj]], R = [], C = [], L = [];
  for (let i = 1; i <= 4; i++) { const a = phR + (phH - phR) * i / 4; rs.push([x0 + Rb * Math.cos(a), yc + Rb * Math.sin(a)]); }
  for (let i = 0; i < 7; i++) R.push(mix2(rs[i], [x0 + rw, hA * i / 6], g));
  for (let i = 1; i <= 9; i++) { const a = phH + (Math.PI - 2 * phH) * i / 10; C.push(mix2([x0 + Rb * Math.cos(a), yc + Rb * Math.sin(a)], [x0 + rw - 2 * rw * i / 10, hA], g)); }
  for (let i = 6; i >= 0; i--) L.push([2 * x0 - R[i][0], R[i][1]]);
  return { R, C, L, yc, Rb, yj, sj };
}
// pushing by the daughters travels outward, one neighbour after the other
const PDP = (t, d) => smooth(0.1 + 0.12 * (d - 1), 0.62 + 0.12 * (d - 1), t);
const PD = (L, d) => L < 0 ? 0 : smooth(0.25 + 0.32 * (d - 1), 0.25 + 0.32 * (d - 1) + 0.8, L);
const BOOST = (L, d) => { if (L < 0) return 0; const x = L - 0.3 * (d - 1); if (x <= 0) return 0; const A = [0, 0.85, 0.55, 0.35, 0.2, 0.1][Math.min(d, 5)]; return A * (x / 0.5) * Math.exp(1 - x / 0.5); };
const CPULSE = Array.from({ length: N + 4 }, (_, i) => ({ ph: (i * 2.39) % (2 * Math.PI), per: 3 + ((i * 7) % 5) * 0.45 }));

const CLSEEN = {}; let CL_ITEMS = [], clSig = null; const CLT = k => { CLSEEN[k] = CL_NOW; }; let CL_NOW = 0;
function buildCloseup(J, tt) {
  CL_NOW = performance.now();
  [cellPool, segPool, conePool, discPool, ballPool].forEach(p => p.reset()); ncl = 0;
  cloneMask(J);
  const s = J.s, P = params(s), st = stageAt(s), e = J.e, L = J.L, mi = J.mit;
  const h = P.h, tip = s >= 0.80, villus = P.baM > 0.35;
  const compete = tip ? smooth(0.80, 0.83, s) : 0, gone = e >= 1;
  const mp = mi ? mi.p : -1, dA = !mi && J.dA >= 0 ? J.dA : -1;   // mitosis progress; model seconds since the division
  const baseExp = 0.32 * smooth(0.15, 0.35, e);
  // basal myosin per cell: pulses, the weaker followed cell, the transient rise in neighbours once it leaves
  const m = [];
  for (let i = 0; i < N; i++) {
    let v = P.baM * (villus ? 0.55 + 0.45 * Math.max(0, Math.sin(2 * Math.PI * tt / CPULSE[i].per + CPULSE[i].ph)) ** 2 : 1);
    if (i === CI) v *= (1 - 0.5 * compete) * (1 - smooth(0.15, 0.35, e));
    else v += 0.9 * BOOST(L, Math.abs(i - CI));
    m.push(v);
  }
  // Neighbours shorten while the cell leaves (apical-basal length ~20% down at the moment of extrusion), then recover.
  const Sh = e <= 0 ? 0 : smooth(0.4, 0.85, e) * (1 - smooth(1.0, 2.0, Math.max(L, 0)));
  const hj = [];
  for (let j = 0; j <= N; j++) { const d = j <= CI ? CI - j : j - CI - 1; hj.push(h * (1 - Sh * ([0.18, 0.11, 0.04][d] || 0))); }
  // junction positions in a flat frame (x along the basement membrane, y = height above it)
  const XB = [], XA = [];
  // in the crypt the cells come from the column (see closeLayout); later one cell width each around the followed cell
  const kOfJ = j => j <= CI ? CU_KT + (j - CI) - (CU_SPLIT ? 1 : 0) : CU_KT + (j - CI), layC = CU_LAY && CU_KT >= 0;
  for (let j = 0; j <= N; j++) {
    let xb = layC ? uK(kOfJ(j)) - CU_UV : (j - N / 2) * W, xa = xb;
    const tug = (j === CI || j === CI + 1) ? 1 - smooth(0.3, 0.45, e) : 1;
    if (villus && j > 0 && j < N) xb += tug * 0.24 * (m[j] - m[j - 1]) * W;
    if (j === CI) { xb -= baseExp * W / 2; xa -= baseExp * W / 4; }
    if (j === CI + 1) { xb += baseExp * W / 2; xa += baseExp * W / 4; }
    if (j <= CI - 1) { const sh = W / 2 * PD(L, CI - j); xb += sh; xa += sh; }
    if (j >= CI + 2) { const sh = W / 2 * PD(L, j - CI - 1); xb -= sh; xa -= sh; }
    if (dA >= 0 && !layC) {              // the daughters push their neighbours aside; the view re-centres on the followed daughter
      if (j <= CI - 1) { const sh = W / 2 * PDP(dA, CI - j); xb -= sh; xa -= sh; }
      if (j >= CI + 2) { const sh = W / 2 * PDP(dA, j - CI - 1); xb += sh; xa += sh; }
      const offc = -0.5 * W * smooth(0.3, 1.3, dA); xb += offc; xa += offc;
    }
    XB.push(xb); XA.push(xa);
  }
  const PF = (x, y) => { const f = BM(x); return add2(f.p, f.n, y); };
  const J2 = [];
  for (let j = 0; j <= N; j++) { const fb = BM(XB[j]); J2.push({ b: fb.p, a: PF(XA[j], hj[j]), nb: fb.n, tb: fb.t }); }
  const J0 = [];
  // rows behind: evenly over the same stretch as the front row (neighbouring columns)
  const rx = j => lerp(XB[0], XB[N], j / N);
  for (let j = 0; j <= N; j++) { const f = BM(rx(j)); J0.push({ b: f.p, a: add2(f.p, f.n, h), n: f.n, t: f.t }); }
  for (let i = 0; i < N; i++) FSR[i] = Math.abs((rx(i) + rx(i + 1)) / 2) < 3.2 ? 0.05 : 0.17;
  {
    const pos = [], X0 = Math.min(XB[0], -N / 2) - 0.4, X1 = Math.max(XB[N], N / 2) + 0.4, n = 160, zA = -ROWS + 0.45, zB = 0.62;
    for (let i = 0; i < n; i++) {
      const f1 = BM(lerp(X0, X1, i / n)), f2 = BM(lerp(X0, X1, (i + 1) / n));
      const a = add2(f1.p, f1.n, -0.06), b = add2(f2.p, f2.n, -0.06);
      pos.push(a[0], a[1], zA, b[0], b[1], zA, b[0], b[1], zB, a[0], a[1], zA, b[0], b[1], zB, a[0], a[1], zB);
    }
    const ga = bmMesh.geometry.getAttribute('position');
    if (!ga) { bmMesh.geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3)); bmMesh.frustumCulled = false; }
    else { ga.array.set(pos); ga.needsUpdate = true; }
    bmMesh.geometry.computeVertexNormals();
    bmMesh.material.color.set('#B7A8CC').lerp(col('#8E7AB5'), P.lamz);
  }
  const zF1 = ZD / 2, zF0 = -ZD / 2, V = (p, z = zF1 + 0.02) => new T.Vector3(p[0], p[1], z);
  for (let rr = 1; rr < ROWS; rr++) {
    for (let i = 0; i < N; i++) {
      const mm = cellPool.get(), z1 = -rr + ZD / 2, z0 = -rr - ZD / 2;
      prismGeo(mm, [J0[i].b, J0[i + 1].b, J0[i + 1].a, J0[i].a], z0, z1);
      mm.material.color.set(neighbourColor(s, i + rr, rr)); mm.material.opacity = 1; mm.material.emissive.set('#000');
    }
    for (let j = 0; j <= N; j++) cl(V(J0[j].a, -rr + ZD / 2 + 0.01), V(J0[j].a, -rr - ZD / 2));
  }
  // ---- the departing cell and the two neighbours that close around it (no space is ever left open):
  // the neighbours share its outline, meet beneath it as it rises, and it rounds up as it leaves apically.
  let X = null;
  if (e > 0) {
    const x0 = (XB[CI] + XB[CI + 1]) / 2, xa0 = (XA[CI] + XA[CI + 1]) / 2;
    const hb = (XB[CI + 1] - XB[CI]) / 2 * (1 - smooth(0.35, 0.8, e));
    const ha = (XA[CI + 1] - XA[CI]) / 2 * (1 - smooth(0.72, 1.0, e));
    const hl = hj[CI], yb = hl * smooth(0.55, 1.0, e);
    const bul = 0.12 * smooth(0.4, 0.8, e) * (1 - smooth(0.85, 1, e));
    const hc = lerp(0.03 * h, 1.24, smooth(0.35, 1.0, e));
    const T5 = [0, 0.25, 0.5, 0.75, 1], xm = t => lerp(x0, xa0, t);
    const right = T5.map(t => [xm(t) + lerp(hb, ha, t) + bul * Math.sin(Math.PI * t), lerp(yb, hl, t)]);
    const left = T5.map(t => [xm(t) - lerp(hb, ha, t) - bul * Math.sin(Math.PI * t), lerp(yb, hl, t)]);
    const yc = (hc * hc - ha * ha) / (2 * hc), rc = hc - yc, thR = Math.atan2(-yc, ha), thL = Math.PI - thR, cap = [];
    for (let i = 1; i < 12; i++) { const th = thR + (thL - thR) * i / 12; cap.push([xa0 + rc * Math.cos(th), hl + yc + rc * Math.sin(th)]); }
    X = { x0, xa0, hb, ha, hl, yb, left, right, cap, meet: yb > 0.004 };
  }
  // ---- division: round body on a basal process, then two daughters that reach back down and widen
  let U = null;
  const xc0 = (XB[CI] + XB[CI + 1]) / 2, hw0 = (XB[CI + 1] - XB[CI]) / 2;
  CU_C = PF(xc0, 0.62 * h);
  if (mp >= 0) { const r = smooth(0, 0.3, mp); U = unitOutline(xc0, lerp(hw0, 0.07 * W, r), lerp(0.5, 0.62, r) * W, 0.14 * h * r, h, hw0, 1 - r); }
  else if (dA >= 0) U = unitOutline(xc0, 0.14 * W, 0.62 * W, 0.14 * h, h, W, smooth(0.05, 1.3, dA));
  // every other cell of the column that is in mitosis rounds up the same way (the stem at the crypt bottom, the
  // transit-amplifying cells): its neighbours share its outline, and the two daughters then widen and push the cells ahead
  const MU = [], csT = LS.ch[LS.trk.ch].cells;
  for (let i = 0; i < N; i++) {
    const kc = KC[i]; if (i === CI || kc < 0 || kc >= csT.length || ((U || X) && Math.abs(i - CI) <= 1)) continue;
    const c = csT[kc]; if (c.trk || c.mit < 0) continue;
    const r = smooth(0, 0.3, c.mit), xc = (XB[i] + XB[i + 1]) / 2, hw = (XB[i + 1] - XB[i]) / 2;
    MU[i] = unitOutline(xc, lerp(hw, 0.07 * W, r), lerp(0.5, 0.6, r) * W, 0.12 * h * r, hj[i], hw, 1 - r); MU[i].p = c.mit; MU[i].xc = xc;
  }
  const flatPoly = i => {
    if (U && i === CI) return mp >= 0 ? [...U.R, ...U.C, ...U.L] : [[xc0, 0], ...U.R, ...U.C.slice(0, 4), U.C[4]];
    if (MU[i]) return [...MU[i].R, ...MU[i].C, ...MU[i].L];
    if (!(U || X) && (MU[i - 1] || MU[i + 1])) {
      const rs = MU[i + 1] ? MU[i + 1].L.slice().reverse() : [[XB[i + 1], 0], [XA[i + 1], hj[i + 1]]];
      const ls = MU[i - 1] ? MU[i - 1].R.slice().reverse() : [[XA[i], hj[i]], [XB[i], 0]];
      return [...rs, ...ls];
    }
    if (U && i === CI - 1) return [[XB[i], 0], ...U.L.slice().reverse(), [XA[i], hj[i]]];
    if (U && i === CI + 1) return [...U.R, [XA[i + 1], hj[i + 1]], [XB[i + 1], 0]];
    if (X && i === CI) return [X.left[0], X.right[0], X.right[1], X.right[2], X.right[3], X.right[4], ...X.cap, X.left[4], X.left[3], X.left[2], X.left[1]];
    if (X && i === CI - 1) { const p = [[XB[i], 0]]; if (X.meet) p.push([X.x0, 0], [X.x0, X.yb]); p.push(...X.left, [XA[i], hj[i]]); return p; }
    if (X && i === CI + 1) { const p = []; if (X.meet) p.push([X.x0, 0]); p.push([XB[i + 1], 0], [XA[i + 1], hj[i + 1]]); for (let t = 4; t >= 0; t--) p.push(X.right[t]); if (X.meet) p.push([X.x0, X.yb]); return p; }
    return [[XB[i], 0], [XB[i + 1], 0], [XA[i + 1], hj[i + 1]], [XA[i], hj[i]]];
  };
  const cellB = i => {                     // basal extent of each cell in the flat frame
    if (U && i === CI) return mp >= 0 ? [U.L[6][0], U.R[0][0]] : [xc0, U.R[0][0]];
    if (MU[i]) return [MU[i].L[6][0], MU[i].R[0][0]];
    if (!(U || X) && (MU[i - 1] || MU[i + 1])) return [MU[i - 1] ? MU[i - 1].R[0][0] : XB[i], MU[i + 1] ? MU[i + 1].L[6][0] : XB[i + 1]];
    if (U && i === CI - 1) return [XB[i], U.L[6][0]];
    if (U && i === CI + 1) return [U.R[0][0], XB[i + 1]];
    if (X && i === CI) return [X.x0 - X.hb, X.x0 + X.hb];
    if (X && i === CI - 1) return [XB[i], X.meet ? X.x0 : X.x0 - X.hb];
    if (X && i === CI + 1) return [X.meet ? X.x0 : X.x0 + X.hb, XB[i + 1]];
    return [XB[i], XB[i + 1]];
  };
  const centres = [];
  for (let i = 0; i < N; i++) {
    const isT = i === CI;
    if (isT && gone) { centres.push(null); continue; }
    let pts = flatPoly(i).map(([x, y]) => PF(x, y));
    const mm = cellPool.get(), c = prismGeo(mm, pts, zF0, zF1);
    centres.push(c);
    if (isT) {
      mm.material.color.set(colourMode === 'id' ? COL.tracked : neighbourColor(s, i)); mm.material.emissive.set('#E4F05A'); mm.material.emissiveIntensity = 0.8 * bump(0, 0.15, e);
      if (colourMode !== 'id' || FOCP < 1) for (let q2 = 0; q2 < pts.length; q2++) seg(V(pts[q2], zF1 + 0.03), V(pts[(q2 + 1) % pts.length], zF1 + 0.03), 0.035, '#7A55C0', 1);
    }
    else { mm.material.color.set(neighbourColor(s, i)); mm.material.emissive.set('#000'); mm.material.emissiveIntensity = 0; }
    mm.material.opacity = 1;
    for (let q2 = 0; q2 < pts.length; q2++) cl(V(pts[q2], zF1 + 0.012), V(pts[(q2 + 1) % pts.length], zF1 + 0.012));
    const [b0, b1] = cellB(i), hc_ = (hj[i] + hj[i + 1]) / 2;
    const np = PF((b0 + b1) / 2, hc_ * (st.id === 'niche' || st.id === 'ta' ? 0.45 : 0.3));
    if (MU[i]) {
      const M = MU[i], q = M.p, zN = zF1 + 0.02;
      if (q >= 0.15) CLT('ch');
      if (q < 0.32) disc(V(PF(M.xc, lerp(0.3 * h, M.yc, smooth(0, 0.28, q))), zN), lerp(0.2, 0.15, smooth(0, 0.3, q)), lerp(0.3, 0.16, smooth(0, 0.3, q)), q < 0.15 ? '#FFFFFF' : '#3A3F8F', lerp(0.55, 0.9, smooth(0.1, 0.3, q)));
      else { const sep = 0.4 * M.Rb * smooth(0.7, 0.92, q); (sep > 0.01 ? [-sep, sep] : [0]).forEach(sx => seg(V(PF(M.xc + sx, M.yc - 0.28 * M.Rb), zN), V(PF(M.xc + sx, M.yc + 0.28 * M.Rb), zN), 0.04, '#2B2A6B')); }
      if (q > 0.86) cl(V(PF(M.xc, M.yc + M.Rb + 0.12 * h), zN - 0.01), V(PF(M.xc, M.yc - 0.7 * M.Rb), zN - 0.01));
    } else if (!(isT && U)) disc(V(isT && e > 0.3 ? c : np, zF1 + 0.014), 0.2, 0.3, '#FFFFFF', 0.55);
  }
  if (U) {
    const yc = U.yc, Rb = U.Rb, zN = zF1 + 0.02;
    if (mp >= 0) {
      const r = smooth(0, 0.3, mp);
      // prophase: the nucleus moves up to the apical surface and condenses
      if (mp < 0.32) { const np0 = PF(xc0, lerp(0.3 * h, yc, smooth(0, 0.28, mp))); disc(V(np0, zN), lerp(0.2, 0.16, r), lerp(0.3, 0.17, r), mp < 0.15 ? '#FFFFFF' : '#3A3F8F', lerp(0.55, 0.9, smooth(0.1, 0.3, mp))); }
      // spindle parallel to the epithelium, metaphase plate, anaphase
      const os = smooth(0.18, 0.3, mp);
      if (os > 0.02) {
        const sep = 0.42 * Rb * smooth(0.7, 0.92, mp), px = [-0.74 * Rb, 0.74 * Rb];
        CLT('sp'); px.forEach((dx, q) => {
          const pole = PF(xc0 + dx, yc); disc(V(pole, zN + 0.01), 0.06, 0.06, '#3FAE4A', os);
          for (let a = 0; a < 6; a++) { const ang = (q ? 0 : Math.PI) + (a - 2.5) * 0.42; seg(V(pole, zN), V(PF(xc0 + dx + 0.2 * Math.cos(ang), yc + 0.2 * Math.sin(ang)), zN), 0.012, '#3FAE4A', 0.8 * os); }
          const xs = xc0 + (q ? sep : -sep);
          [-0.24, 0, 0.24].forEach(dy => seg(V(pole, zN), V(PF(xs, yc + dy * Rb), zN), 0.01, '#3FAE4A', 0.75 * os));
        });
        if (mp >= 0.15) CLT('ch');
        if (mp >= 0.28) (sep > 0.01 ? [-sep, sep] : [0]).forEach(sx => seg(V(PF(xc0 + sx, yc - (sep > 0.01 ? 0.22 : 0.32) * Rb), zN + 0.02), V(PF(xc0 + sx, yc + (sep > 0.01 ? 0.22 : 0.32) * Rb), zN + 0.02), 0.045, '#2B2A6B'));
      }
      // basal actomyosin in the process while the body rounds up at the apical surface (prophase to metaphase)
      const ob = smooth(0.03, 0.15, mp) * (1 - smooth(0.75, 0.9, mp)), sw = U.sj;
      if (ob > 0.02) {
        [-1, 1].forEach(sg => {
          seg(V(PF(xc0 + sg * sw, 0.03), zN + 0.03), V(PF(xc0 + sg * sw, U.yj * 0.95), zN + 0.03), 0.035, COL.tension, 0.9 * ob);
          const fa = BM(xc0 + sg * (sw + 0.14)); arrow(V(add2(fa.p, fa.n, 0.06), zN + 0.04), new T.Vector3(fa.n[0], fa.n[1], 0), 0.5, 0.03, COL.tension, ob);
        });
        CLT('am');
      }
      if (mp > 0.86) cl(V(PF(xc0, yc + Rb + 0.14 * h), zN + 0.01), V(PF(xc0, yc - 0.7 * Rb), zN + 0.01));   // cleavage furrow
    } else {
      // two daughters side by side: each reaches back to the base; the sister is the left one
      const g = smooth(0.05, 1.3, dA), sis = [[xc0, 0], U.C[4], ...U.C.slice(5), ...U.L].map(([a, b]) => PF(a, b));
      const mm = cellPool.get(), csis = prismGeo(mm, sis, zF0, zF1);
      const base = new T.Color(neighbourColor(s, CI - 1, 0, true)); if (colourMode === 'id') base.lerp(col('#D8CCEE'), 1 - smooth(0.9, 1.35, dA));
      mm.material.color.copy(base); mm.material.emissive.set('#000'); mm.material.emissiveIntensity = 0; mm.material.opacity = 1;
      for (let q2 = 0; q2 < sis.length; q2++) cl(V(sis[q2], zF1 + 0.012), V(sis[(q2 + 1) % sis.length], zF1 + 0.012));
      const dx = lerp(0.3 * Rb, 0.5 * W, g), ny_ = lerp(yc, 0.3 * h, g);
      disc(V(PF(xc0 + dx, ny_), zN), 0.2, lerp(0.17, 0.3, g), '#FFFFFF', 0.6);
      disc(V(PF(xc0 - dx, ny_), zN), 0.2, lerp(0.17, 0.3, g), '#FFFFFF', 0.6);
      // the pushing: neighbours move away from the widening daughters, one after the other
      for (let i = 0; i < N; i++) {
        if (i === CI || !centres[i]) continue;
        const d = i < CI ? CI - i : i - CI, sp = (PDP(dA + 0.05, d) - PDP(dA - 0.05, d)) / 0.1;
        if (sp < 0.3) continue;
        const sg = i < CI ? -1 : 1, t = J2[Math.min(i, N)].tb;
        arrow(V(add2(centres[i], t, -sg * 0.3), zF1 + 0.08), new T.Vector3(t[0] * sg, t[1] * sg, 0), 0.6, 0.045, '#4F7BD8', clamp(sp / 1.5)); CLT('pb');
      }
      void csis;
    }
  }
  // apical junction lines running back into the sheet
  for (let j = 0; j <= N; j++) {
    if (X && (j === CI || j === CI + 1)) continue;
    cl(V(J2[j].a, zF1 + 0.01), V(J2[j].a, zF0));
  }
  if (X) {
    const pl = gone ? [PF(X.xa0, X.hl)] : [PF(X.xa0 - X.ha, X.hl), PF(X.xa0 + X.ha, X.hl)];
    pl.forEach(p => cl(V(p, zF1 + 0.01), V(p, zF0)));
  }
  if (gone) {
    const late = J.phase === 'lumen' || J.phase === 'done';
    let rr = 0.62, colr = COL.tracked;
    if (late && J.tl > 0.85) { const g = smooth(0.85, 1, J.tl); rr *= 1 - 0.18 * g; colr = new T.Color(COL.tracked).lerp(col('#A39DAA'), g).getHex(); }
    const c = PF(X.xa0, X.hl + 0.62 + (late ? J.tl * 1.1 : 0));
    ball(V(c, 0), rr, colr, 1, '#8D6BD0', late ? 0.15 : 0);
    disc(V(c, rr + 0.01), 0.2, 0.22, '#FFFFFF', 0.5);
  }
  // ---- forces
  const zS = zF1 + 0.06;
  for (let i = 0; i < N; i++) {
    if (!centres[i]) continue;
    const isT = i === CI, [xb0, xb1] = cellB(i), f0 = BM(xb0), f1 = BM(xb1), B0 = f0.p, B1 = f1.p, nb = f0.n;
    const A0 = J2[i].a, A1 = J2[i + 1].a;
    if (P.apM > 0.08 && !(X && Math.abs(i - CI) <= 1)) CLT('am'), seg(V(add2(A0, nb, -0.06), zS), V(add2(A1, J2[i + 1].nb, -0.06), zS), 0.02 + 0.05 * P.apM, COL.tension, 0.35 + 0.6 * P.apM);
    const bam = m[i];
    if (bam > 0.08 && !(isT && e > 0.6) && xb1 - xb0 > 0.05) {
      const b0 = add2(B0, nb, 0.08), b1 = add2(B1, f1.n, 0.08);
      seg(V(b0, zS), V(b1, zS), 0.015 + 0.05 * Math.min(bam, 1.6), COL.tension, clamp(0.3 + 0.55 * bam)); CLT('am');
      if (villus) {
        const mid = add2(mix2(B0, B1, 0.5), nb, 0.22);
        [b0, b1, add2(B0, nb, 0.4), add2(B1, f1.n, 0.4)].forEach(p => seg(V(mid, zS), V(p, zS), 0.012 + 0.02 * Math.min(bam, 1.6), COL.tension, clamp(0.35 + 0.5 * bam)));
      }
    }
  }
  // lateral myosin in the neighbours along the shared boundary, strongest at mid-height (rises as the cell leaves)
  if (X) {
    const o = smooth(0.35, 0.5, e) * (1 - smooth(0.4, 1.4, Math.max(L, 0) - 0.4));
    if (o > 0.02) {
      CLT('am');
      const sides = gone ? [[[X.x0, 0], [X.x0, X.hl * 0.25], [X.x0, X.hl * 0.5], [X.x0, X.hl * 0.75], [X.x0, X.hl]]] : [X.left, X.right];
      sides.forEach(side => { for (let t = 0; t < side.length - 1; t++) {
        const w = 0.03 + 0.035 * Math.sin(Math.PI * (t + 0.5) / (side.length - 1));
        seg(V(PF(...side[t]), zS + 0.01), V(PF(...side[t + 1]), zS + 0.01), w, COL.tension, 0.9 * o);
      } });
    }
  }
  const apicalSide = P.apM > P.baM;
  for (let j = 1; j < N; j++) {
    if (e > 0.35 && (j === CI || j === CI + 1)) continue;
    const f = J2[j], lv = apicalSide ? 0.82 : 0.2, p = mix2(f.b, f.a, lv), t = f.tb, Lt = 0.25 + 0.5 * P.tens;
    arrow(V(add2(p, t, -Lt / 2), zS + 0.03), new T.Vector3(t[0], t[1], 0), Lt, 0.02, COL.tension, 0.4 + 0.45 * P.tens, true); CLT('te');
  }
  // traction = force on the matrix (Pérez-González 2021, 2022), for each cell from its own place on the path:
  // the crypt base pushes into it, the crypt wall pulls toward the base, the crypt mouth and villus base point outward,
  // and cells crawling on the upper villus push it backward
  const trChain = CHAINS[TRK_CH];
  for (let i = 0; i < N; i++) {
    const xc = (XB[i] + XB[i + 1]) / 2, f = BM(xc), pb = add2(f.p, f.n, -0.16);
    const sc = SIM.sOfL(trChain, lOfU(CU_UV + xc)), trc = params(sc).trac, push = sc < 0.12 ? 1 - sc / 0.12 : 0;
    const dir = Math.sign(trc) || 1, tr = Math.abs(trc);
    if (X && e > 0.35 && e < 0.75 && (i === CI - 1 || i === CI + 1)) {
      const o = smooth(0.35, 0.45, e) * (1 - smooth(0.65, 0.75, e)), xu = i < CI ? X.x0 - X.hb - 0.15 : X.x0 + X.hb + 0.15, fu = BM(xu);
      arrow(V(add2(fu.p, fu.n, 0.05), zS + 0.05), new T.Vector3(fu.n[0], fu.n[1], 0), 0.75, 0.035, COL.traction, o); if (o > 0.05) CLT('tr');
      continue;
    }
    if (i === CI && e > 0.6) continue;
    CLT('tr');
    if (push > 0.2) { const Ln = 0.2 + 0.4 * push; arrow(V(add2(f.p, f.n, -0.08), zS), new T.Vector3(-f.n[0], -f.n[1], 0), Ln, 0.03, COL.traction, 0.9); continue; }
    if (tr < 0.08) { disc(V(pb, zS), 0.05, 0.05, COL.traction, 0.5); continue; }
    const Lr = 0.2 + 0.45 * tr, dv = new T.Vector3(f.t[0] * dir, f.t[1] * dir, 0);
    arrow(V(add2(pb, f.t, -dir * Lr / 2), zS), dv, Lr, 0.03, COL.traction, 0.9);
  }
  for (let i = 0; i < N; i++) {
    let a = P.adh; if (i === CI) a *= 1 - smooth(0.55, 0.75, e);
    const [xb0, xb1] = cellB(i);
    if (!centres[i] || a < 0.05 || xb1 - xb0 < 0.1) continue;
    CLT('ad'); for (let d = 0; d < 3; d++) { const f = BM(lerp(xb0, xb1, 0.22 + d * 0.28)); disc(V(add2(f.p, f.n, 0.02), zF1 + 0.03), 0.045, 0.045, '#5B2A86', 0.8 * a); }
  }
  // cryptic lamellipodia under the cell ahead
  for (let i = 0; i < N; i++) {
    const crawl = st.id === 'lower' || st.id === 'upper', Lm = P.lam * 0.6 * (crawl ? 0.8 + 0.3 * Math.sin(2 * Math.PI * tt / 2.4 + i * 1.7) : 1);   // protrude and retract while crawling
    if (Lm < 0.05 || !centres[i] || (e > 0.3 && Math.abs(i - CI) <= 1)) continue;
    const xb = XB[i + 1], pts = [[xb - 0.1, 0.01], [xb + Lm, 0.02], [xb + Lm * 0.72, 0.08], [xb + Lm * 0.3, 0.155], [xb - 0.1, 0.23]].map(([a, b]) => PF(a, b));
    const mm = cellPool.get(); prismGeo(mm, pts, zF1 - 0.12, zF1 + 0.05); CLT('la');
    mm.material.color.set('#B03A78'); mm.material.opacity = 1; mm.material.emissive.set('#5A0F35'); mm.material.emissiveIntensity = 0.25;
    for (let q2 = 0; q2 < 3; q2++) seg(V(pts[q2 + 1], zF1 + 0.06), V(pts[q2 + 1 === 3 ? 3 : q2 + 2], zF1 + 0.06), 0.018, '#F2B8D4', 0.9);
  }
  // the neighbours' lamellipodia crawling beneath the departing cell
  if (X && e > 0.3) {
    const g = smooth(0.3, 0.6, e) * (1 - smooth(0.85, 0.95, e));
    if (g > 0.02) CLT('la'), [-1, 1].forEach(sg => {
      const x = X.x0 + sg * X.hb, Lm = 0.47 * g;
      const pts = [[x + sg * 0.1, 0.0], [x - sg * Lm, 0.03], [x - sg * Lm * 0.6, 0.1], [x + sg * 0.1, 0.2]].map(([a, b]) => PF(a, b));
      const mm = cellPool.get(); prismGeo(mm, pts, zF1 - 0.12, zF1 + 0.05);
      mm.material.color.set('#B03A78'); mm.material.opacity = 1; mm.material.emissive.set('#5A0F35'); mm.material.emissiveIntensity = 0.25;
    });
  }
  // pushed by divisions upstream: until 1:00, a freshly divided pair behind the followed cell widens and pushes every cell
  // between it and the followed cell (and the followed cell) toward the tip; the arrow follows how fast the pair widens
  if (layC && dA < 0 && tau() < 62) {
    const fade = 1 - smooth(58, 62, tau()), kEnd = CU_KT - (CU_SPLIT ? 1 : 0), wsp = new Float64Array(N);
    let src = 0;
    for (let k = 0; k < kEnd && k < csT.length; k++) {
      const c = csT[k], t0 = k === 2 ? c.divM : c.bornT; if (!(t0 > -50)) continue;
      const a = LS.mt - t0; if (a <= 0 || a >= 1.4) continue;
      const sp = (smooth(0.05, 1.3, a + 0.05) - smooth(0.05, 1.3, a - 0.05)) / 0.1;   // widening speed, peaks ~1.2
      for (let i = 0; i < N; i++) if (KC[i] > k + 1 && KC[i] <= CU_KT) wsp[i] = Math.max(wsp[i], sp);
      src++;
    }
    if (src) for (let i = 0; i < N; i++) {
      const o = fade * clamp(wsp[i] / 0.8); if (o < 0.05 || !centres[i] || (i === CI && mp >= 0)) continue;
      const t = J2[Math.min(i, N)].tb;
      arrow(V(add2(centres[i], t, -0.3), zF1 + 0.08), new T.Vector3(t[0], t[1], 0), 0.6, 0.045, '#4F7BD8', o); CLT('pb');
    }
  }
  // cells being pulled toward the vacancy: the demand travels outward, one neighbour after the other
  if (L >= 0) {
    for (let i = 0; i < N; i++) {
      if (i === CI || !centres[i]) continue;
      const d = i < CI ? CI - i : i - CI, sp = (PD(L + 0.05, d) - PD(L - 0.05, d)) / 0.1;
      if (sp < 0.25) continue;
      const c = centres[i], t = J2[i].tb, sg = i < CI ? 1 : -1;
      arrow(V(add2(c, t, -sg * 0.3), zF1 + 0.08), new T.Vector3(t[0] * sg, t[1] * sg, 0), 0.6, 0.045, '#7A55C0', clamp(sp / 1.2)); CLT('pu');
    }
  }
  CLT('fl');
  if (tip) {
    const fs = BM(-2.2), p = add2(fs.p, fs.n, h + 0.6); arrow(V(p, 0.2), new T.Vector3(fs.t[0], fs.t[1], 0), 1.1 + (L >= 0 ? 0.6 : 0), 0.07, COL.flow, 0.85);
  } else {
    const f = BM(0), top = add2(f.p, f.n, h + 0.75), push = P.trac < 0.2, Lf = st.id === 'niche' ? 0.5 : st.id === 'upper' ? 1.9 : st.id === 'lower' ? 1.4 : 1.0;
    arrow(V(add2(top, f.t, push ? -Lf - 0.3 : -Lf / 2), 0.2), new T.Vector3(f.t[0], f.t[1], 0), Lf, 0.07, COL.flow, 0.85);
  }
  clGeo.setDrawRange(0, ncl); clGeo.attributes.position.needsUpdate = true;
  $('cL').textContent = tip ? '← villus flank' : FOCP < 1 ? '' : '← crypt base';
  $('cR').textContent = tip ? 'apex →' : 'tip →';
  cLines.visible = outlineMode !== 'none';
}

// =================================================================== UI
const chips = $('chips');
STAGES.forEach(st => {
  const d = document.createElement('div'); d.className = 'chip'; d.textContent = st.name; d.style.background = st.chip;
  d.onclick = () => { const t0 = STAGE_T[st.s0]; if (t0 !== undefined) scrubTo(t0 + (st.id === 'tip' ? 0.05 : 0.5)); };
  chips.appendChild(d); st.el = d;
});
function layoutChips() {
  STAGES.forEach((st, i) => {
    const a = STAGE_T[st.s0] ?? 0, b = i + 1 < STAGES.length ? (STAGE_T[STAGES[i + 1].s0] ?? T_END) : T_END;
    st.el.style.left = (a / T_END * 100) + '%'; st.el.style.width = `calc(${Math.max(0, (b - a) / T_END * 100)}% - 2px)`;
    st.el.title = `${st.name}: ${Math.round(b - a)} s of model time`;
  });
}
layoutChips();
const scrub = $('scrub'), playBtn = $('play');
let target = 0, playing = true, speed = 2, lastStage = null;
let dragging = false, reqT = null;                          // reqT: a requested time the look-ahead has not reached yet
function scrubTo(t) { reqT = clamp(t, 0, T_END); target = Math.min(reqT, computedT()); scrub.value = Math.round(reqT / T_END * 1000); }
scrub.addEventListener('input', () => { reqT = clamp(scrub.value / 1000 * T_END, 0, T_END); target = Math.min(reqT, computedT()); });
scrub.addEventListener('pointerdown', () => { dragging = true; });
window.addEventListener('pointerup', () => { dragging = false; }); window.addEventListener('pointercancel', () => { dragging = false; });
playBtn.onclick = () => { playing = !playing; if (playing && asDone && target >= T_END - 0.01) target = 0; playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play'; };
playBtn.textContent = '❚❚ Pause';
$('speed').onchange = e => speed = +e.target.value;
$('mode').onchange = e => { colourMode = e.target.value; applyModeExtras(); };
let outlineMode = 'white';
function applyOutline() {
  lines.visible = outlineMode !== 'none';
  lines.material.color.set(outlineMode === 'dark' ? '#A86A88' : '#FFFFFF'); lines.material.opacity = outlineMode === 'dark' ? 0.5 : 0.85;
  cLines.material.color.set(outlineMode === 'dark' ? '#8E5A74' : '#FFFFFF'); cLines.material.opacity = outlineMode === 'dark' ? 0.7 : 0.9;
}
$('outl').onchange = e => { outlineMode = e.target.value; applyOutline(); };
function applyModeExtras() { drawLegend(); }
let follow = false; $('follow').onchange = e => { follow = e.target.checked; if (!follow) { orbit.target.copy(HOME.t); orbit.r = HOME.r; orbit.moved = false; orbit.update(); } };
$('cut').onchange = e => { cutaway = e.target.checked; applyCut(); };
$('lab').onchange = e => showLabels = e.target.checked;
const legEl = $('legend');
function showLegend(v) { legEl.style.display = v ? 'block' : 'none'; $('leg').checked = v; }
$('leg').onchange = e => showLegend(e.target.checked);
$('legClose').onclick = () => showLegend(false);
{
  let d = null;
  $('legHead').addEventListener('pointerdown', ev => {
    if (ev.target.tagName === 'BUTTON') return;
    const r = legEl.getBoundingClientRect(), st = $('stage').getBoundingClientRect();
    d = { dx: ev.clientX - r.left, dy: ev.clientY - r.top, st };
    legEl.style.left = (r.left - st.left) + 'px'; legEl.style.top = (r.top - st.top) + 'px'; legEl.style.bottom = 'auto'; legEl.style.right = 'auto';
    $('legHead').setPointerCapture(ev.pointerId);
  });
  $('legHead').addEventListener('pointermove', ev => {
    if (!d) return;
    const w = legEl.offsetWidth, h = legEl.offsetHeight;
    legEl.style.left = clamp(ev.clientX - d.st.left - d.dx, 0, d.st.width - w) + 'px';
    legEl.style.top = clamp(ev.clientY - d.st.top - d.dy, 0, d.st.height - h) + 'px';
  });
  const end = () => { d = null; };
  $('legHead').addEventListener('pointerup', end); $('legHead').addEventListener('pointercancel', end);
}
let showGrad = true;
$('grad').onchange = e => { showGrad = e.target.checked; $('bars').style.display = showGrad ? 'block' : 'none'; };
window.addEventListener('keydown', e => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); playBtn.click(); } });
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function ephChart() {
  const W_ = 300, H_ = 96, x0 = 8, x1 = W_ - 8, y0 = 12, y1 = H_ - 22, A1 = 0.62;
  const X_ = a => x0 + (x1 - x0) * a / A1, Y_ = v => y1 - (y1 - y0) * v;
  const line = (f, c, w, op) => { let d = ''; for (let j = 0; j <= 80; j++) { const a = j / 80 * A1; d += (j ? 'L' : 'M') + X_(a).toFixed(1) + ',' + Y_(f(a)).toFixed(1); } return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" opacity="${op}"/>`; };
  const sel = colourMode, on = k => sel === 'eph' || sel === k;
  let g = `<svg class="chart" width="${W_}" height="${H_}" viewBox="0 0 ${W_} ${H_}">`;
  g += `<line x1="${X_(0.3)}" x2="${X_(0.3)}" y1="${y0 - 4}" y2="${y1}" stroke="#B9A3E3" stroke-dasharray="3 2"/>`;
  g += `<rect x="${X_(0)}" y="${Y_(1)}" width="${X_(0.045) - X_(0)}" height="${y1 - Y_(1)}" fill="#1B2F7A" opacity="${on('ephb3') ? 0.85 : 0.18}"/>`;
  g += line(a => ephLevels(a, 'x')[0], '#2F6FD0', on('ephb2') ? 2.6 : 1.2, on('ephb2') ? 1 : 0.3);
  g += line(a => ephLevels(a, 'x')[2], '#E0701C', on('efnb') ? 2.6 : 1.2, on('efnb') ? 1 : 0.3);
  g += `<line x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}" stroke="#8C8398"/>`;
  g += `<text x="${x0}" y="${H_ - 8}" font-size="9.5" fill="#5E566A">crypt base</text><text x="${X_(0.3)}" y="${H_ - 8}" font-size="9.5" fill="#5E566A" text-anchor="middle">crypt–villus junction</text><text x="${x1}" y="${H_ - 8}" font-size="9.5" fill="#5E566A" text-anchor="end">villus</text>`;
  g += `<text x="${X_(0.05) + 3}" y="${Y_(1) + 8}" font-size="9" fill="#1B2F7A" opacity="${on('ephb3') ? 1 : 0.4}">EphB3 (Paneth, CBC)</text>`;
  g += `<text x="${X_(0.1)}" y="${Y_(1) - 2}" font-size="9" fill="#2F6FD0" opacity="${on('ephb2') ? 1 : 0.4}">EphB2</text>`;
  g += `<text x="${X_(0.36)}" y="${Y_(0.95)}" font-size="9" fill="#E0701C" opacity="${on('efnb') ? 1 : 0.4}">ephrin-B1/B2</text>`;
  g += `<line id="ephMark" x1="0" x2="0" y1="${y0 - 4}" y2="${y1}" stroke="#7A55C0" stroke-width="2"/><circle id="ephDot" cx="0" cy="${y0 - 4}" r="3.5" fill="#B39BE0" stroke="#5B2A86"/>`;
  return g + '</svg>';
}
function drawLegend() {
  const L = $('legBody');
  const sw = c => `<i style="background:${c}"></i>`;
  const ramp = (a, b, c) => `<span class="ramp" style="background:linear-gradient(90deg,${a},${b}${c ? ',' + c : ''})"></span>`;
  const mech = `<div class="mech"><span><svg width="18" height="8"><rect x="0" y="2" width="18" height="4" fill="${COL.tension}"/></svg>basal actomyosin (pulses)</span>`
    + `<span><svg width="16" height="8"><path d="M0 3h9v2H0z M8 0l8 4-8 4z" fill="${COL.traction}"/></svg>traction</span>`
    + `<span><svg width="12" height="10"><path d="M12 5 L0 0 L0 10z" fill="#7A55C0"/></svg>pulled up after an extrusion</span>`
    + `<span><svg width="12" height="10"><path d="M12 5 L0 0 L0 10z" fill="#4F7BD8"/></svg>pushed by a division</span>`
    + `<span><svg width="16" height="8"><path d="M0 8 L16 6 L0 1z" fill="#B03A78"/></svg>cryptic lamellipodia</span>`
    + `<span><svg width="10" height="10"><circle cx="5" cy="5" r="4.5" fill="#E5C9D6"/></svg>extruded cell</span></div>`;
  let body = '';
  if (colourMode === 'id') body = `<div class="row"><span>${sw(COL.stem)}Stem</span><span>${sw(COL.paneth)}Paneth</span><span>${sw(COL.ta)}Transit-amplifying</span><span>${sw(COL.hinge)}Hinge</span><span>${sw(COL.diff)}Differentiated</span><span>${sw(COL.tracked)}Followed cell</span></div>`;
  if (colourMode === 'am') body = `<div class="row">apical ${ramp(COL.apical, COL.neutral, COL.tension)} basal</div><div class="note">Apical in the crypt (Sumigray 2018; Hartl 2019); basal on the villus, pulsing and rising toward the tip (Krueger 2025). Flashes near the tip are neighbours after an extrusion.</div>`;
  if (colourMode === 'tr') body = `<div class="row">toward base ${ramp(COL.apical, COL.neutral, COL.traction)} toward tip</div><div class="note">Traction is the force the cells exert on the matrix. The crypt base pushes into it; along the crypt wall it points toward the base, strongest near the TA zone; at the crypt mouth and villus base it points outward, where cells are dragged toward the villus (organoids, Pérez-González 2021); on the upper villus it points back toward the base, as for cells crawling on their basal protrusions (inferred, Pérez-González 2022). Not measured in tissue.</div>`;
  if (colourMode === 'sig') body = `<div class="row">Wnt / R-spondin ${ramp(COL.wnt, COL.neutral, COL.bmp)} BMP</div><div class="note">Opposed gradients; transition in the transit-amplifying zone</div>`;
  if (colourMode === 'v') body = `<div class="row">slow ${ramp('#EFE8F4', COL.traction)} fast</div><div class="note">Speed of each cell in this model. Streaks running down from the tip are cells pulled up after an extrusion.</div>`;
  if (colourMode === 'ephb2') body = `<div class="row">EphB2 low ${ramp('#F6F3F8', '#2F6FD0')} high</div>${ephChart()}<div class="note">Receptor, a Wnt target: through the proliferative compartment, peaking at positions 4–6 and falling toward the crypt top; crypt base columnar cells positive, Paneth cells negative (Batlle 2002).</div>`;
  if (colourMode === 'ephb3') body = `<div class="row">EphB3 low ${ramp('#F6F3F8', '#1B2F7A')} high</div>${ephChart()}<div class="note">Receptor on the cells below position +4: the Paneth cells and the crypt base columnar cells between them. Without EphB3, Paneth cells scatter along crypt and villus (Batlle 2002).</div>`;
  if (colourMode === 'efnb') body = `<div class="row">ephrin-B low ${ramp('#F6F3F8', '#E0701C')} high</div>${ephChart()}<div class="note">Ligands ephrin-B1 and -B2: highest at the crypt–villus junction, decreasing toward the crypt base; little expressed from the first third of the villus on (Batlle 2002).</div>`;
  if (colourMode === 'eph') body = `<div class="row"><span>${sw('#1B2F7A')}EphB3</span><span>${sw('#2F6FD0')}EphB2</span><span>${sw('#EE8A2E')}ephrin-B1/B2</span><span>${sw('#9B6F8F')}co-expressed</span></div>${ephChart()}<div class="note">Adult jejunum (Batlle 2002). Where receptor- and ligand-expressing cells meet, EphB signalling drives ADAM10 to shed E-cadherin and keeps the compartments apart (Solanas 2011). Above the lower third of the villus ephrin-B1/B2 are low.</div>`;
  if (colourMode === 'conf') {
    const d = h => h === null ? '…' : 'day ' + (h / 24).toFixed(1);
    body = `<div class="row"><span>${sw('#46C05A')}nuclear GFP</span><span>${sw('#F2CC2A')}YFP</span><span>${sw('#E2474C')}RFP</span><span>${sw('#3D8FDB')}membrane CFP</span><span>${sw('#C9C2CF')}unlabelled</span></div>`
      + `<div style="margin:5px 0 3px;font-size:12px"><b id="confDay">day 0.0</b> after tamoxifen <span class="note" style="display:inline">(1 model second ≈ 1 h)</span></div>`
      + `<div class="note" style="color:var(--ink2)">This model: first labelled cells leave the crypt at ${d(CONF_MS.exit)}, reach the villus at ${d(CONF_MS.villus)}, and a labelled ribbon spans crypt to tip at ${d(CONF_MS.tip)}. Every ribbon on the villus runs back into a labelled crypt: villus cells come only from crypts, and each crypt feeds the villus sector next to it. For legibility each labelled crypt has its own colour: red for the followed cell's crypt, yellow for its neighbour, and one crypt carrying two clones side by side (blue and green). In the mouse most labelled crypts carry several colours in the first weeks and drift to one (below). In the close-up only the followed cell's clone is coloured: at each division one daughter stays behind, so the cells behind it fill with label while the cells ahead, born before the label, stay grey; the followed cell is the front of its ribbon.</div>`
      + `<div class="note">Published: labelled Lgr5 stem cells appear 24 h after induction and divide about daily; their progeny spend 2–3 days on the villus (Snippert 2010); villus transit 49–60 h (Parker 2017); the epithelium turns over in ≈ 2.8 d (Darwich 2014). Over weeks, crypts drift to a single colour (5% at 2 wk, 45% at 4 wk, 73% at 8 wk; Snippert 2010), which this model does not include. Each villus is fed by ~10–12 crypts (Cheng & Bjerknes 1985, cited in Lee 2025). In the mouse, GFP is nuclear and CFP sits in the membrane; here all four colours fill the cell.</div>`;
  }
  if (colourMode === 'moor') body = `<div class="row">${MOOR.map((c, z) => `<span>${sw('#' + c.getHexString())}V${z + 1}</span>`).join('')}<span>${sw('#D8D3DE')}crypt / non-enterocyte</span></div><div class="note">Enterocyte zones from landmark genes (Moor 2018), a proxy for maturation. Here the zone is read from the cell's position; cells move through V1 → V6 as they migrate.</div>`;
  L.innerHTML = mech + body;
}
function updateEphMark(s) {
  const m = $('ephMark'); if (!m) return;
  const x = 8 + (300 - 16) * Math.min(aOfS(s), 0.62) / 0.62;
  m.setAttribute('x1', x); m.setAttribute('x2', x); $('ephDot').setAttribute('cx', x);
}
drawLegend();

(() => {
  const ic = {
    tr: `<svg width="18" height="8"><line x1="1" y1="4" x2="12" y2="4" stroke="${COL.traction}" stroke-width="2"/><path d="M11 0 L17 4 L11 8z" fill="${COL.traction}"/></svg>`,
    te: `<svg width="18" height="8"><line x1="5" y1="4" x2="13" y2="4" stroke="${COL.tension}" stroke-width="2"/><path d="M6 0 L0 4 L6 8z M12 0 L18 4 L12 8z" fill="${COL.tension}"/></svg>`,
    am: `<svg width="16" height="10"><path d="M1 9 L8 4 L15 9 M8 4 L8 0" stroke="${COL.tension}" stroke-width="1.6" fill="none"/></svg>`,
    la: `<svg width="16" height="8"><path d="M0 8 L16 6 L0 2z" fill="#B03A78"/></svg>`,
    pu: `<svg width="18" height="8"><line x1="1" y1="4" x2="12" y2="4" stroke="#7A55C0" stroke-width="3"/><path d="M11 0 L17 4 L11 8z" fill="#7A55C0"/></svg>`,
    fl: `<svg width="18" height="10"><line x1="1" y1="5" x2="11" y2="5" stroke="${COL.flow}" stroke-width="4"/><path d="M10 0 L18 5 L10 10z" fill="${COL.flow}"/></svg>`
  };
  ic.sp = `<svg width="16" height="10"><circle cx="3" cy="5" r="2.5" fill="#3FAE4A"/><circle cx="13" cy="5" r="2.5" fill="#3FAE4A"/><line x1="3" y1="5" x2="13" y2="5" stroke="#3FAE4A"/></svg>`;
  ic.pb = `<svg width="18" height="8"><line x1="1" y1="4" x2="12" y2="4" stroke="#4F7BD8" stroke-width="3"/><path d="M11 0 L17 4 L11 8z" fill="#4F7BD8"/></svg>`;
  ic.ch = `<svg width="12" height="10"><rect x="2" y="1" width="3" height="8" fill="#2B2A6B"/><rect x="7" y="1" width="3" height="8" fill="#2B2A6B"/></svg>`;
  ic.ad = `<svg width="16" height="8"><circle cx="3" cy="4" r="2.2" fill="#5B2A86"/><circle cx="8" cy="4" r="2.2" fill="#5B2A86"/><circle cx="13" cy="4" r="2.2" fill="#5B2A86"/></svg>`;
  CL_ITEMS = [['ch', 'condensed chromosomes'], ['sp', 'spindle'], ['pb', 'pushed by division'], ['tr', 'traction'], ['te', 'tension'],
    ['am', 'actomyosin (pulses)'], ['ad', 'matrix adhesions'], ['la', 'lamellipodia'], ['pu', 'pulled toward the gap'], ['fl', 'cell flow']].map(([k, t]) => [k, `<span>${ic[k]}${t}</span>`]);
})();
// the close-up legend lists only the symbols drawn in the last 5 s
function updateCLegend(now) {
  const keys = CL_ITEMS.filter(([k]) => now - (CLSEEN[k] || -1e9) <= 5000).map(([k]) => k), sig = keys.join();
  if (sig === clSig) return; clSig = sig;
  $('cLegend').innerHTML = CL_ITEMS.filter(([k]) => keys.includes(k)).map(([, h]) => h).join('');
}

function renderCard(st) {
  const c = CARDS[st.id];
  let h = `<h2>${st.name}</h2><div class="where">${c.where}</div>`;
  if (c.hl) h += `<div class="open hl"><b>Active migration</b>${c.hl}</div>`;
  ['Shape', 'Forces', 'Signals', 'Notes'].forEach(sec => { if (c[sec]) h += `<h3>${sec === 'Notes' ? 'Also' : sec}</h3><ul>${c[sec].map(x => `<li>${x}</li>`).join('')}</ul>`; });
  h += `<div class="open"><b>Open question</b>${c.open}</div>`;
  $('card').innerHTML = h;
  STAGES.forEach(x => x.el.classList.toggle('on', x === st));
}
const GAUGES = [
  ['wnt', 'Wnt / R-spondin', COL.wnt], ['bmp', 'BMP', COL.bmp], ['ephB', 'EphB2 / EphB3', '#7F9BD6'], ['eprB', 'ephrin-B', '#9FB8E6'],
  ['apM', 'Apical actomyosin', COL.apical], ['baM', 'Basal myosin II', COL.tension], ['tens', 'Intercellular tension', '#E0588E'],
  ['trac', 'Traction  base ↔ tip', COL.traction], ['lam', 'Cryptic lamellipodia', '#C45A8C'], ['ecad', 'E-cadherin', '#6FAE8A'], ['adh', 'Integrin–matrix adhesion', '#8E7AB5']
];
(() => {
  let h = `<h3 style="margin-top:0">State of the followed cell</h3>`;
  GAUGES.forEach(([k, lab_, c]) => h += `<div class="g"><span>${lab_}</span><div class="track">${k === 'trac' ? '<div class="zero"></div>' : ''}<div class="fill" id="g_${k}" style="background:${c}"></div></div><span class="val" id="v_${k}"></span></div>`);
  h += `<div class="g"><span>Migration speed</span><span id="v_speed" style="grid-column:2/4;color:var(--ink2)"></span></div>`;
  h += `<div class="g"><span>Enterocyte zone (Moor)</span><span id="v_moor" style="grid-column:2/4;color:var(--ink2)"></span></div>`;
  h += `<div class="gnote">Bars are schematic: they show the direction of change reported in the cited work, not measured magnitudes. Traction is the force on the matrix after Pérez-González 2021 and 2022: measured in organoids for the crypt and the villus-like domain, inferred for the upper villus. Tension is drawn tip-high after Wen 2026 (preprint); its direction along the villus is disputed (Box 1). Model time runs in seconds; the real journey takes days.</div>`;
  $('gauges').innerHTML = h;
})();
const word = v => v < 0.15 ? 'low' : v < 0.45 ? 'mod.' : v < 0.8 ? 'high' : 'max';
function updateGauges(J) {
  const s = J.s, P = params(s), e = J.e, st = stageAt(s);
  const compete = st.id === 'tip' ? smooth(0.80, 0.83, s) : 0;
  P.baM *= (1 - 0.5 * compete) * (1 - smooth(0.15, 0.35, e));
  P.adh *= 1 - smooth(0.55, 0.75, e);
  if (e > 0.6) { P.trac = 0; P.tens = 0; P.lam = 0; }
  GAUGES.forEach(([k]) => {
    const g = $('g_' + k), v = P[k];
    if (k === 'trac') { const w = Math.abs(v) * 50; g.style.left = (v < 0 ? 50 - w : 50) + '%'; g.style.width = w + '%'; $('v_' + k).textContent = Math.abs(v) < 0.08 ? '≈ 0' : v < 0 ? '→ base' : '→ tip'; }
    else { g.style.width = (clamp(v) * 100) + '%'; $('v_' + k).textContent = word(v); }
  });
  $('v_speed').textContent = SPEED_TXT[st.id];
  const za = s < 0.42 ? 0.3 : 0.36 + 0.64 * clamp((s - 0.42) / 0.4), z = s < 0.37 ? -1 : moorZone(Math.max(za, 0.36));
  $('v_moor').textContent = st.id === 'lumen' ? 'shed from V6' : z < 0 ? 'crypt (not zoned)' : `V${z + 1} · ${MOOR_TXT[z]}`;
}
let barsH = 0;
function drawBars(s) {
  const svg = $('bars'), h = svg.clientHeight, w = svg.clientWidth; if (!h) return;
  const top = 20, bot = h - 125, Ly = x => bot - (bot - top) * (x / 0.94);
  if (h !== barsH) {
    barsH = h;
    const bars = [
      ['Proliferation', '#C0457F', x => bump(-0.02, 0.36, x)],
      ['Pushed by division', '#C0457F', x => 1 - smooth(0.05, 0.62, x)],
      ['Active migration', '#C0457F', x => smooth(0.36, 0.86, x)],
      ['Wnt, R-spondin', COL.bmp, x => 1 - smooth(0.0, 0.34, x)],
      ['BMP', COL.bmp, x => smooth(0.26, 0.9, x)]
    ];
    const bw = Math.min(26, (w - 20) / bars.length - 8);
    let out = '';
    bars.forEach(([name, c, f], i) => {
      const cx = 14 + i * (bw + 10) + bw / 2, Lp = [], Rp = [];
      for (let j = 0; j <= 40; j++) { const x = j / 40 * 0.94, y = Ly(x), hw = 1 + (bw / 2 - 1) * f(x); Lp.push(`${cx - hw},${y}`); Rp.unshift(`${cx + hw},${y}`); }
      out += `<polygon points="${Lp.concat(Rp).join(' ')}" fill="${c}" opacity="0.85"/>`;
      out += `<text x="${cx}" y="${bot + 8}" transform="rotate(-90 ${cx} ${bot + 8})" text-anchor="end" font-size="10.5" font-weight="700" fill="${c}" dy="4">${name}</text>`;
    });
    out += `<line id="bLine" x1="4" x2="${14 + bars.length * (bw + 10)}" stroke="#5B2A86" stroke-width="1.3" stroke-dasharray="3 2"/>`;
    out += `<circle id="bDot" cx="6" r="5" fill="${COL.tracked}" stroke="#5B2A86"/><text x="4" y="${top - 6}" font-size="10" fill="#8C8398">tip</text>`;
    svg.innerHTML = out;
  }
  const y = Ly(Math.min(s, 0.94));
  $('bLine').setAttribute('y1', y); $('bLine').setAttribute('y2', y); $('bDot').setAttribute('cy', y);
}
function fitHome() {
  // keep the whole unit (crypt base to villus tip, both crypts) in view whatever the panel shape
  HOME.r = Math.max(19.5, 15.5 / Math.max(camera.aspect, 0.3));
  if (!follow && !orbit.moved) { orbit.target.copy(HOME.t); orbit.r = HOME.r; orbit.update(); }
}
function resize() {
  const a = $('stage'), w = a.clientWidth, h = a.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  fitHome();
  const b = $('closeWrap'), cw = b.clientWidth, ch = b.clientHeight, A0 = 450 / 330, asp = cw / ch;
  cr.setSize(cw, ch, false); ccam.aspect = asp;
  ccam.fov = asp >= A0 ? 30 : 2 * Math.atan(Math.tan(15 * Math.PI / 180) * A0 / asp) * 180 / Math.PI;
  ccam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();
// The close-up can be resized by dragging the line between the panels or the line below it; the movie pauses meanwhile.
// The sizes are remembered in this browser; a double-click on a line restores the default.
let splitDrag = false;
(() => {
  const app = document.querySelector('.app'), aside = document.querySelector('aside');
  const setW = w => app.style.setProperty('--asideW', Math.round(w) + 'px'), setH = h => app.style.setProperty('--closeH', Math.round(h) + 'px');
  try { const st = JSON.parse(localStorage.getItem('journey3d.split') || 'null'); if (st && st.w) setW(Math.min(st.w, window.innerWidth - 380)); if (st && st.h) setH(Math.min(st.h, window.innerHeight - 300)); resize(); } catch (e) {}
  const save = v => { try { localStorage.setItem('journey3d.split', JSON.stringify(v)); } catch (e) {} };
  const drag = (el, move) => {
    let s0 = null;
    el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} el.classList.add('on'); splitDrag = true; s0 = { x: e.clientX, y: e.clientY, w: aside.clientWidth, h: $('closeWrap').clientHeight }; });
    el.addEventListener('pointermove', e => { if (s0) { move(e, s0); resize(); } });
    const end = () => { if (!s0) return; s0 = null; el.classList.remove('on'); splitDrag = false; save({ w: aside.clientWidth, h: $('closeWrap').clientHeight }); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', () => { app.style.removeProperty('--asideW'); app.style.removeProperty('--closeH'); resize(); save(null); });
  };
  drag($('splitV'), (e, s) => setW(clamp(s.w - (e.clientX - s.x), 300, window.innerWidth - 380)));
  drag($('splitH'), (e, s) => setH(clamp(s.h + (e.clientY - s.y), 180, aside.clientHeight - 110)));
})();
applyCut(); applyOutline(); applyModeExtras();

// ---------------------------------------------------------------- start-up: grow the tissue, then play
let last = performance.now(), ready = false, warm = 0, lastCap = '', lastTm = '', fno = 0, lastFrameStage = null, divHold = 0, rHold = 0, jumped = false, firstFrame = true;
const v3F = new T.Vector3();
const WARM = Math.round(40 / DT);
LS = SIM.create(20260923);
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!ready) {
    const t0 = performance.now();
    while (warm < WARM && performance.now() - t0 < 40) { SIM.step(LS, DT); warm++; }
    $('loadBar').style.width = (warm / WARM * 100) + '%';
    if (warm < WARM) { requestAnimationFrame(frame); return; }
    SIM.startJourney(LS); T0 = LS.t;
    AS = SIM.create(1); SIM.restore(AS, SIM.snapshot(LS)); AS.log = true; AS.events = [];
    ready = true; $('loading').style.display = 'none';
    // optional link parameters, e.g. ?t=131&mode=moor&outline=none&follow=1&cut=0&speed=1
    const Q = new URLSearchParams(location.search);
    const setSel = (id, v) => { const el = $(id); if (v !== null && [...el.options].some(o => o.value === v)) { el.value = v; el.dispatchEvent(new Event('change')); } };
    setSel('outl', Q.get('outline')); setSel('mode', Q.get('mode') || Q.get('overlay')); setSel('speed', Q.get('speed'));
    [['follow', 'follow'], ['cut', 'cut'], ['labels', 'lab']].forEach(([k, id]) => { if (Q.has(k) && $(id).checked !== (Q.get(k) === '1')) $(id).click(); });
    if (Q.has('t')) { let g = 0; while (!asDone && g++ < 400) lookahead(50); playing = false; playBtn.textContent = '▶ Play'; scrubTo(+Q.get('t') || 0); }
  }
  if (reqT !== null) { lookahead(28); target = Math.min(reqT, computedT()); if (asDone || computedT() >= reqT - 1e-6) reqT = null; }
  else lookahead(speed > 4 && playing ? 14 : 6);
  if (tau() > 14 || !playing) $('intro').style.opacity = 0;
  const tgt0 = target;
  if (playing && !dragging && !splitDrag && reqT === null) {
    target += dt * speed;
    if (asDone && target >= T_END) { target = T_END; playing = false; playBtn.textContent = '↺ Replay'; }
    else target = Math.min(target, computedT());
    scrub.value = Math.round(target / T_END * 1000);
  }
  const tPrev = tau(); goTo(target); jumped = firstFrame || Math.abs(tau() - tPrev - (target - tgt0)) > 0.6; firstFrame = false;
  if (jumped) for (const k in CLSEEN) delete CLSEEN[k];
  { const tc = SIM.trackedCell(LS); CLAB = tc ? tc.lab : LS.ch[LS.trk.ch].cells[2].lab; }   // the clone's colour; the stem carries it after the cell has left
  const J = journeyState();
  buildTissue(); updateExtruded();
  if (trkInfo.ok) {
    halo.visible = pinDot.visible = true;
    halo.position.copy(trkInfo.pos); halo.scale.setScalar(0.22 + 0.02 * Math.sin(now / 300));
    pinDot.position.copy(trkInfo.pos); pinDot.scale.setScalar(0.03);
    if (follow) { orbit.target.lerp(MIR(v3F.copy(trkInfo.pos)), jumped ? 1 : 0.06); orbit.r = lerp(orbit.r, 5.5, 0.03); orbit.update(); }
  } else halo.visible = pinDot.visible = false;
  const st = stageAt(J.s);
  if (st !== lastStage) { renderCard(st); lastStage = st; }
  $('slowmo').style.opacity = LS.slow < 0.6 ? 1 : 0;
  if (LS.slow < 0.6) { const txt = (J.mit || J.dA >= 0) ? 'slow motion · the followed cell divides' : 'slow motion · the followed cell leaves'; if ($('slowmo').textContent !== txt) $('slowmo').textContent = txt; }
  closeLayout(J);
  { const div = !!J.mit || J.dA >= 0;
    // on the crypt bottom: the whole bottom in view; then close on the followed cell; closer still while it divides
    if (div) divHold = 1.5; else divHold = Math.max(0, divHold - dt);
    if (st !== lastFrameStage) rHold = 1.5; else rHold = Math.max(0, rHold - dt);
    const tx = div ? CU_C[0] : lerp(0, CU_C[0], FOCP), ty = div ? CU_C[1] : lerp(3.0, CU_C[1], FOCP), rr = div ? 9.5 : lerp(19, 11.5, FOCP);
    corbit.target.x = jumped ? tx : lerp(corbit.target.x, tx, 0.08);
    corbit.target.y = jumped ? ty : lerp(corbit.target.y, ty, 0.08);
    if (jumped) { corbit.r = rr; divHold = 0; } else if (div || divHold > 0 || rHold > 0 || (FOCP > 0 && FOCP < 1)) corbit.r = lerp(corbit.r, rr, 0.06);
    lastFrameStage = st;
    corbit.update(); }
  buildCloseup(J, LS.t); updateCLegend(now);
  const [c1, c2] = captionFor(J.s, J), capH = `${c1}<small>${c2}</small>`;
  if (capH !== lastCap) { $('caption').innerHTML = capH; lastCap = capH; }
  if ((++fno) % 3 === 0) updateGauges(J);
  updateLabels(); if (showGrad) drawBars(J.s); if (isEph(colourMode)) updateEphMark(J.s);
  if (colourMode === 'conf') { const el = $('confDay'); if (el) { const tx = 'day ' + ((LS.mt - LS.mt0) / 24).toFixed(1); if (el.textContent !== tx) el.textContent = tx; } }
  const tm = `${fmt(tau())} / ${fmt(T_END)}` + (reqT !== null ? ' · computing…' : asDone ? '' : ' …'); if (tm !== lastTm) { $('time').textContent = tm; lastTm = tm; }
  renderer.render(scene, camera); cr.render(cs, ccam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
