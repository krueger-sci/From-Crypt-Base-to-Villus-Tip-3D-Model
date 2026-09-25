// Tissue model for the crypt-to-tip page.
// Every epithelial cell sits in a chain: a column of cells along a continuous path
// (crypt base -> crypt wall -> hinge -> surface -> villus -> tip). Cells tile each
// chain edge to edge, so the sheet never opens. Motion = a guiding flow field
// (division-driven in the crypt, crawling on the villus) plus spring-like coupling
// between neighbours, so a vacancy at the tip pulls the cells behind it upward.
const SIM = (() => {
'use strict';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const PI = Math.PI, TAU = 2 * PI;

// ---------------------------------------------------------------- anatomy (1 unit ~ 10 µm, stylised)
const G = { R: 0.9, H: 6.0, HV: 0.30, RC: 0.33, D: 2.3, HC: 0.2, HS: 0.22, CR: 2.05, RHO1: 0.15, RHO2: 0.45, RCAP: 1.7, ROUT: 2.95, NV: 30, NCC: 12 };
G.DTH = TAU / G.NV; G.DPH = TAU / G.NCC; G.Y0 = -G.D + G.RC;
const { R, H, HV, RC, HC, HS, CR, RHO1, RHO2, RCAP, ROUT, NV, NCC, DTH, DPH, Y0 } = G;
const CRYPTS = [0, 1, 2, 3, 4, 5].map(k => { const th = k * PI / 3; return { k, th, x: CR * Math.cos(th), z: CR * Math.sin(th) }; });

// sample layout: centre(3) normal(3) left(3) leftNormal(3) right(3) rightNormal(3) height(1)
const ST = 19, DS = 0.01;
const set3 = (o, i, x, y, z) => { o[i] = x; o[i + 1] = y; o[i + 2] = z; };

function hemiPt(C, ph, a, o, i, ni) {
  const sa = Math.sin(a), ca = Math.cos(a), dx = Math.cos(ph), dz = Math.sin(ph);
  set3(o, i, C.x + RC * sa * dx, Y0 - RC * ca, C.z + RC * sa * dz); set3(o, ni, -sa * dx, ca, -sa * dz);
}
const segHemi = (C, ph) => ({ len: RC * PI / 2, f(u, o) { const a = Math.max(u / RC, 0.003); hemiPt(C, ph, a, o, 0, 3); hemiPt(C, ph - DPH / 2, a, o, 6, 9); hemiPt(C, ph + DPH / 2, a, o, 12, 15); o[18] = HC; } });
function wallPt(C, ph, y, o, i, ni) { const dx = Math.cos(ph), dz = Math.sin(ph); set3(o, i, C.x + RC * dx, y, C.z + RC * dz); set3(o, ni, -dx, 0, -dz); }
const segWall = (C, ph) => ({ len: -RHO1 - Y0, f(u, o) { const y = Y0 + u; wallPt(C, ph, y, o, 0, 3); wallPt(C, ph - DPH / 2, y, o, 6, 9); wallPt(C, ph + DPH / 2, y, o, 12, 15); o[18] = HC; } });
function rimPt(C, ph, b, o, i, ni) {
  const dx = Math.cos(ph), dz = Math.sin(ph), ud = RC + RHO1 - RHO1 * Math.cos(b), y = -RHO1 + RHO1 * Math.sin(b);
  set3(o, i, C.x + ud * dx, y, C.z + ud * dz); set3(o, ni, -Math.cos(b) * dx, Math.sin(b), -Math.cos(b) * dz);
}
const segRim = (C, ph) => ({ len: RHO1 * PI / 2, f(u, o) { const b = u / RHO1; rimPt(C, ph, b, o, 0, 3); rimPt(C, ph - DPH / 2, b, o, 6, 9); rimPt(C, ph + DPH / 2, b, o, 12, 15); o[18] = lerp(HC, HS, b / (PI / 2)); } });
function segLine(S, E) {
  const len = Math.hypot(E.c[0] - S.c[0], E.c[1] - S.c[1]);
  return { len, f(u, o) {
    const t = u / len;
    set3(o, 0, lerp(S.c[0], E.c[0], t), 0, lerp(S.c[1], E.c[1], t));
    set3(o, 6, lerp(S.l[0], E.l[0], t), 0, lerp(S.l[1], E.l[1], t));
    set3(o, 12, lerp(S.r[0], E.r[0], t), 0, lerp(S.r[1], E.r[1], t));
    set3(o, 3, 0, 1, 0); set3(o, 9, 0, 1, 0); set3(o, 15, 0, 1, 0); o[18] = HS;
  } };
}
const radPt = (th, rr) => [rr * Math.cos(th), rr * Math.sin(th)];
function bfPt(th, g, o, i, ni) {
  const cx = Math.cos(th), cz = Math.sin(th), r = R + RHO2 - RHO2 * Math.sin(g), y = RHO2 - RHO2 * Math.cos(g);
  set3(o, i, r * cx, y, r * cz); set3(o, ni, Math.sin(g) * cx, Math.cos(g), Math.sin(g) * cz);
}
const segBase = (th, fl) => ({ len: RHO2 * PI / 2, f(u, o) { const g = u / RHO2; bfPt(th, g, o, 0, 3); bfPt(th - fl * DTH / 2, g, o, 6, 9); bfPt(th + fl * DTH / 2, g, o, 12, 15); o[18] = lerp(HS, HV, g / (PI / 2)); } });
function vwPt(th, y, o, i, ni) { const cx = Math.cos(th), cz = Math.sin(th); set3(o, i, R * cx, y, R * cz); set3(o, ni, cx, 0, cz); }
const segVWall = (th, fl) => ({ len: H - RHO2, f(u, o) { const y = RHO2 + u; vwPt(th, y, o, 0, 3); vwPt(th - fl * DTH / 2, y, o, 6, 9); vwPt(th + fl * DTH / 2, y, o, 12, 15); o[18] = HV; } });
function vtPt(th, be, o, i, ni) {
  const cx = Math.cos(th), cz = Math.sin(th), cb = Math.cos(be), sb = Math.sin(be);
  set3(o, i, R * cb * cx, H + R * sb, R * cb * cz); set3(o, ni, cb * cx, sb, cb * cz);
}
const segVTip = (th, fl) => ({ len: R * PI / 2, f(u, o) { const be = Math.min(u / R, PI / 2); vtPt(th, be, o, 0, 3); vtPt(th - fl * DTH / 2, be, o, 6, 9); vtPt(th + fl * DTH / 2, be, o, 12, 15); o[18] = HV; } });

function buildChain(segs, info) {
  const L = segs.reduce((s, g) => s + g.len, 0), M = Math.ceil(L / DS) + 2;
  const S = new Float32Array(M * ST), o = new Float64Array(ST), starts = [];
  let acc = 0; segs.forEach(g => { starts.push(acc); acc += g.len; });
  for (let m = 0; m < M; m++) {
    const l = Math.min(m * DS, L - 1e-6); let k = 0;
    while (k < segs.length - 1 && l >= starts[k + 1]) k++;
    segs[k].f(l - starts[k], o);
    for (let q = 0; q < ST; q++) S[m * ST + q] = o[q];
  }
  return Object.assign({ S, M, L, starts }, info);
}
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function flipFor(Sl, Sr, th, rr) {
  const El = radPt(th - DTH / 2, rr), Er = radPt(th + DTH / 2, rr);
  return dist2(Sl, El) + dist2(Sr, Er) <= dist2(Sl, Er) + dist2(Sr, El) ? 1 : -1;
}
const rimEnd = (C, ph) => [C.x + (RC + RHO1) * Math.cos(ph), C.z + (RC + RHO1) * Math.sin(ph)];
const angEq = (a, b) => { const d = ((a - b) % TAU + TAU) % TAU; return d < 1e-6 || TAU - d < 1e-6; };

const CHAINS = [], IN_BY_COL = new Array(NV).fill(-1);
CRYPTS.forEach(C => {
  for (let j = 0; j < NCC; j++) {
    const ph0 = j * DPH, ph = ph0 + DPH / 2;
    const near = angEq(ph0, C.th + PI) || angEq(ph0 + DPH, C.th + PI);
    const far = angEq(ph0, C.th) || angEq(ph0 + DPH, C.th);
    const base = [segHemi(C, ph), segWall(C, ph), segRim(C, ph)];
    const ci = { crypt: true, cryptK: C.k, cc: j, parity: (j + C.k) % 2, lN: 0.515, lTA: base[0].len + base[1].len - 0.15, lCE: base[0].len + base[1].len + base[2].len };
    const Sc = rimEnd(C, ph), Sl = rimEnd(C, ph - DPH / 2), Sr = rimEnd(C, ph + DPH / 2);
    const thS = ((Math.atan2(Sc[1], Sc[0]) % TAU) + TAU) % TAU, col = Math.floor(thS / DTH) % NV, thc = (col + 0.5) * DTH;
    if (near) {
      const fl = flipFor(Sl, Sr, thc, R + RHO2);
      const E = { c: radPt(thc, R + RHO2), l: radPt(thc - fl * DTH / 2, R + RHO2), r: radPt(thc + fl * DTH / 2, R + RHO2) };
      const segs = base.concat([segLine({ c: Sc, l: Sl, r: Sr }, E), segBase(thc, fl), segVWall(thc, fl), segVTip(thc, fl)]);
      const lV0 = ci.lCE + segs[3].len + segs[4].len;
      IN_BY_COL[col] = CHAINS.length;
      CHAINS.push(buildChain(segs, Object.assign({ kind: 'in', col, lV0, lTip0: lV0 + segs[5].len, fl }, ci)));
    } else if (far) {
      const fl = flipFor(Sl, Sr, thc, ROUT);
      const E = { c: radPt(thc, ROUT), l: radPt(thc - fl * DTH / 2, ROUT), r: radPt(thc + fl * DTH / 2, ROUT) };
      CHAINS.push(buildChain(base.concat([segLine({ c: Sc, l: Sl, r: Sr }, E)]), Object.assign({ kind: 'out', col }, ci)));
    } else CHAINS.push(buildChain(base, Object.assign({ kind: 'crypt' }, ci)));
  }
});
for (let c = 0; c < NV; c++) {
  if (IN_BY_COL[c] >= 0) continue;
  const thc = (c + 0.5) * DTH;
  const S = { c: radPt(thc, RCAP), l: radPt(thc - DTH / 2, RCAP), r: radPt(thc + DTH / 2, RCAP) };
  const E = { c: radPt(thc, R + RHO2), l: radPt(thc - DTH / 2, R + RHO2), r: radPt(thc + DTH / 2, R + RHO2) };
  const segs = [segLine(S, E), segBase(thc, 1), segVWall(thc, 1), segVTip(thc, 1)];
  const lV0 = segs[0].len + segs[1].len;
  IN_BY_COL[c] = CHAINS.length;
  CHAINS.push(buildChain(segs, { kind: 'in', crypt: false, col: c, lV0, lTip0: lV0 + segs[2].len, lCE: 0, fl: 1 }));
}
// in the mouse every villus cell comes from a crypt: a villus column without its own crypt column in this model takes its
// cells' lineage label from the nearest crypt-fed column (what leaves that crypt enters the neighbouring villus columns too)
CHAINS.forEach(ch => {
  if (ch.kind !== 'in' || ch.crypt) return;
  const th = (ch.col + 0.5) * DTH; let best = -1, bd = 9;
  CHAINS.forEach((c2, i) => { if (c2.kind !== 'in' || !c2.crypt) return; const d = Math.abs((((c2.col + 0.5) * DTH - th) % TAU + TAU + PI) % TAU - PI); if (d < bd - 1e-9) { bd = d; best = i; } });
  ch.src = best;
});
const PHI_END = c => [29, 7, 15, 22].includes(c) ? 90 : [3, 11, 18, 26].includes(c) ? 82 : [1, 5, 9, 13, 17, 20, 24, 28].includes(c) ? 74 : 60;
CHAINS.forEach(ch => {
  if (ch.kind === 'in') { ch.lP = Math.min(ch.L, ch.lTip0 + R * PHI_END(ch.col) * PI / 180); ch.lTZ = ch.lTip0 + R * 0.35; ch.lTrk = ch.lTZ + 0.3; }
  let mL = 0, mR = 0, mC = -1e9;
  for (let m = 0; m < ch.M; m++) { mL = Math.max(mL, Math.abs(ch.S[m * ST + 8])); mR = Math.max(mR, Math.abs(ch.S[m * ST + 14])); mC = Math.max(mC, ch.S[m * ST + 2]); }
  ch.back = mC <= 1e-3;
  ch.cut = ch.back ? (mL < 2e-3 ? 'l' : mR < 2e-3 ? 'r' : null) : null;
});
const SECTION = CHAINS.map((c, i) => c.cut ? i : -1).filter(i => i >= 0);
const TRK_CH = CHAINS.findIndex(c => c.cut && c.kind === 'in' && c.cryptK === 0);

function samp(ch, l, out) {
  const x = clamp(l / DS, 0, ch.M - 1.001), i = x | 0, f = x - i, A = ch.S, o0 = i * ST;
  for (let k = 0; k < ST; k++) out[k] = A[o0 + k] + (A[o0 + ST + k] - A[o0 + k]) * f;
  return out;
}

// ---------------------------------------------------------------- dynamics
const P = { MIT_TRK: 5.0, VR: 0.08, V0: 0.08, V1: 0.115, AC: 0.17, KS: 6, VCL: 0.35, DT: 1 / 20, MIT: 1.2, EXD: 1.0, TCOMP: 4, TEXT: 10, TLUM: 8 };
P.PHI = P.VR / P.AC;
const BDEC = Math.exp(-P.DT / 2.5);
function vField(ch, l) {
  if (ch.crypt && l < ch.lCE) {
    if (l < ch.lN) return 0;
    if (l < ch.lTA) return P.VR * (0.15 + 0.85 * (l - ch.lN) / (ch.lTA - ch.lN));
    return P.VR;
  }
  if (ch.kind !== 'in') return P.VR;
  if (l < ch.lV0) return P.V0;
  return P.V0 + (P.V1 - P.V0) * clamp((l - ch.lV0) / (ch.lTip0 - ch.lV0));
}
function restLen(ch, l) { if (ch.crypt && l < ch.lTA) return P.AC; return clamp(vField(ch, l) / P.PHI, P.AC, 0.26); }
const TB = 0.005;
CHAINS.forEach(ch => { if (ch.kind === 'in') ch.tzCap = 0.92 * (ch.lP - ch.lTZ) / restLen(ch, ch.lTZ); });
CHAINS.forEach(ch => {
  const n = Math.ceil(ch.L / TB) + 2; ch.vT = new Float32Array(n); ch.aT = new Float32Array(n);
  for (let m = 0; m < n; m++) { ch.vT[m] = vField(ch, m * TB); ch.aT[m] = restLen(ch, m * TB); }
  ch.nT = n - 1;
});
const tv = (ch, l) => { let m = (l / TB) | 0; if (m < 0) m = 0; else if (m > ch.nT) m = ch.nT; return ch.vT[m]; };
const ta = (ch, l) => { let m = (l / TB) | 0; if (m < 0) m = 0; else if (m > ch.nT) m = ch.nT; return ch.aT[m]; };
function rnd(S) {
  S.rng = (S.rng + 0x6D2B79F5) >>> 0; let t = S.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function newCell(S, l, type, divLeft) {
  return { id: S.nextId++, l, v: 0, A: P.AC, sig: 1, fixed: false, type, divLeft: divLeft || 0, divT: 3 + 3 * rnd(S), mit: -1,
    boost: 0, close: 0, dwell: -1, ext: -1, ph: rnd(S) * TAU, per: 3 + 2 * rnd(S), eec: rnd(S) < 0, trk: false,
    q: 0.6 + 0.7 * rnd(S), tz: false, tzT: 0, bornT: -99, lab: 0, cl: false, divM: -99 };
}
function create(seed) {
  const S = { t: 0, mt: 0, rng: seed >>> 0, nextId: 1, ch: [], events: [], log: false, trk: null, slow: 1 };
  CHAINS.forEach(ch => {
    const cells = [], D = { cells, stemT: 1 + 9 * rnd(S), demand: 0, wait: 0.5, busy: 0 };
    let l;
    if (ch.crypt) {
      const types = ch.parity ? ['paneth', 'stem', 'stem'] : ['stem', 'paneth', 'stem'];
      [0.085, 0.255, 0.425].forEach((x, k) => { const c = newCell(S, x, types[k]); c.fixed = true; cells.push(c); });
      l = ch.lN + P.AC / 2;
    } else l = restLen(ch, 0) / 2;
    while (l < ch.L - 0.05) {
      const ta = ch.crypt && l < ch.lTA;
      const c = newCell(S, l, ta ? 'ta' : 'diff', ta ? Math.floor(rnd(S) * 3) : 0);
      if (ch.kind === 'in' && l >= ch.lTZ) c.tz = true;
      cells.push(c);
      l += restLen(ch, l);
    }
    S.ch.push(D);
  });
  return S;
}
const qEff = c => c.q - 0.02 * c.tzT;
function removeAt(S, i, k) {
  const D = S.ch[i], cs = D.cells, gone = cs.splice(k, 1)[0];
  if (S.log) S.events.push({ t: S.t, ch: i, l: gone.l, trk: gone.trk });
  const below = cs[k - 1], above = cs[k], b2 = cs[k - 2], a2 = cs[k + 1];
  if (below && !below.fixed) { below.close = 1.2; below.boost = Math.max(below.boost, 1); }
  if (above) above.boost = Math.max(above.boost, 0.8);
  if (b2 && !b2.fixed) b2.boost = Math.max(b2.boost, 0.6);
  if (a2) a2.boost = Math.max(a2.boost, 0.4);
  const col = CHAINS[i].col;
  [-1, 1].forEach(dc => {
    const c2 = S.ch[IN_BY_COL[(col + dc + NV) % NV]].cells; let best = null, bd = 0.25;
    for (let m = c2.length - 1; m >= 0; m--) { const d = Math.abs(c2[m].l - gone.l); if (d < bd) { bd = d; best = c2[m]; } }
    if (best && !best.fixed) best.boost = Math.max(best.boost, 0.5);
  });
  D.busy = Math.max(0, D.busy - (gone.trk ? 0 : 1));
  return gone;
}
// Removal in the tip zone: one cell out for each that arrives, chosen among the weakest (lowest contractility).
// Contractility declines with time spent in the zone, so no cell stays forever.
function pickVictim(S, ch, cs) {
  let tot = 0;
  for (let k = 0; k < cs.length; k++) { const c = cs[k]; if (c.l < ch.lTZ || c.trk || c.ext >= 0) continue; tot += Math.exp(-qEff(c) / 0.1) * (0.75 + 0.25 * (c.l - ch.lTZ) / (ch.lP - ch.lTZ)); }
  if (tot <= 0) return -1;
  let r = rnd(S) * tot;
  for (let k = 0; k < cs.length; k++) { const c = cs[k]; if (c.l < ch.lTZ || c.trk || c.ext >= 0) continue; r -= Math.exp(-qEff(c) / 0.1) * (0.75 + 0.25 * (c.l - ch.lTZ) / (ch.lP - ch.lTZ)); if (r <= 0) return k; }
  return -1;
}
function stepChain(S, i, dt) {
  const ch = CHAINS[i], D = S.ch[i], cs = D.cells, n = cs.length, KS = P.KS, isIn = ch.kind === 'in';
  for (let k = 0; k < n; k++) { const c = cs[k]; c.A = ta(ch, c.l) * c.sig; }
  for (let k = 0; k < n; k++) {
    const c = cs[k]; if (c.fixed) { c.v = 0; continue; }
    let F = 0, g = 1;
    if (k + 1 < n) { const up = cs[k + 1], r = (c.A + up.A) * 0.5, e = up.l - c.l - r; F = KS * e; g = 1 + e / (0.3 * r); }
    else if (isIn) { const r = c.A * 0.5, e = ch.lP - c.l - r; if (e < 0) F = KS * e; g = 1 + e / (0.3 * (r > 0.03 ? r : 0.03)); }
    if (k > 0) { const dn = cs[k - 1]; F -= KS * (c.l - dn.l - (c.A + dn.A) * 0.5); }
    g = g < 0 ? 0 : g > 1 ? 1 : g;
    let v = tv(ch, c.l) * g + F;
    if (c.close > 0) { v += P.VCL * g; c.close -= dt; }
    c.v = v;
    if (c.boost > 0.001) c.boost *= BDEC; else c.boost = 0;
  }
  for (let k = 0; k < n; k++) { const c = cs[k]; if (!c.fixed) c.l += c.v * dt; }
  for (let k = 1; k < n; k++) { const a = cs[k - 1], b = cs[k], s2 = a.sig + b.sig, mn = a.l + 0.22 * P.AC * (s2 < 1 ? s2 : 1); if (b.l < mn) b.l = mn; }
  if (isIn && n) { const top = cs[n - 1], mx = ch.lP - 0.12 * top.A; if (top.l > mx) top.l = mx; }
  if (ch.crypt) {
    for (let k = 0; k < cs.length; k++) {
      const c = cs[k]; if (c.fixed) continue;
      if (c.mit >= 0) {
        c.mit += c.trk ? dt / Math.max(S.slow, 0.05) / P.MIT_TRK : dt / P.MIT;
        if (c.mit >= 1) {
          c.mit = -1; c.divLeft--;
          // the daughters straddle the mother's place, each kept on its own side of the neighbours
          const lo = k > 0 ? (cs[k - 1].l + c.l) / 2 : c.l - P.AC / 4, hi = k + 1 < cs.length ? (c.l + cs[k + 1].l) / 2 : c.l + P.AC / 4;
          const d = newCell(S, Math.min(c.l + P.AC / 4, hi), 'ta', c.divLeft); d.eec = false; d.lab = c.lab; d.cl = c.cl;
          c.l = Math.max(c.l - P.AC / 4, lo); c.divT = 3 + 3 * rnd(S); c.bornT = d.bornT = S.mt;
          if (c.trk) { c.trk = false; d.trk = true; d.divT = 3.5; S.trk.id = d.id; S.trk.births.push(S.t); S.trk.splitM = S.mt; }
          cs.splice(k + 1, 0, d); k++;
        }
        continue;
      }
      if (c.divLeft > 0 && c.l < ch.lTA) { c.divT -= dt; if (c.divT <= 0) c.mit = 0; }
    }
    D.stemT -= dt;
    const stem = cs[2];
    if (stem.mit >= 0) {
      stem.mit += stem.trk ? dt / Math.max(S.slow, 0.05) / P.MIT_TRK : dt / P.MIT;
      if (stem.mit >= 1) {
        stem.mit = -1; stem.divM = S.mt;
        // the daughter goes between the stem and the cell above it, so the column stays in order along the path
        const d = newCell(S, cs.length > 3 ? Math.min(ch.lN + P.AC * 0.3, (stem.l + cs[3].l) / 2) : ch.lN + P.AC * 0.3, 'ta', 2);
        d.eec = false; d.bornT = S.mt; d.lab = stem.lab; d.cl = stem.cl;
        if (stem.trk) { stem.trk = false; d.trk = true; d.divT = 2.2; S.trk.phase = 'flow'; S.trk.id = d.id; S.trk.births.push(S.t); S.trk.splitM = S.mt; }
        cs.splice(3, 0, d); D.stemT = 5 + 6 * rnd(S);
      }
    } else if (D.stemT <= 0) stem.mit = 0;
  }
  if (ch.kind === 'in') {
    if (!ch.crypt) {
      const A0 = restLen(ch, 0);
      let vl = 0; { const sc = S.ch[ch.src].cells, lE = CHAINS[ch.src].lCE; for (let k = 0; k < sc.length; k++) if (sc[k].l >= lE) { vl = sc[k].lab; break; } }
      if (!cs.length) { cs.push(newCell(S, A0 / 2, 'diff', 0)); cs[0].lab = vl; }
      else if (cs[0].l - cs[0].A / 2 > 0.55 * A0) { cs.unshift(newCell(S, Math.max(0.2 * A0, cs[0].l - A0), 'diff', 0)); cs[0].lab = vl; }
    }
    let occ = 0;
    for (let k = 0; k < cs.length; k++) {
      const c = cs[k];
      if (c.l >= ch.lTZ) { c.tz = true; c.tzT += dt; occ += c.sig; }
      if (c.ext >= 0 && !c.trk) { c.ext += dt / P.EXD; c.sig = Math.max(0.001, 1 - c.ext); if (c.ext >= 1) { removeAt(S, i, k); k--; } }
    }
    // a weak cell leaves whenever the tip zone holds more than ~92% of its rest capacity (the zone stays under tension)
    if (occ > ch.tzCap && D.busy < 2) {
      D.wait -= dt;
      if (D.wait <= 0) { const k = pickVictim(S, ch, cs); if (k >= 0) { cs[k].ext = 0; D.busy++; } D.wait = 0.1 + 0.4 * rnd(S); }
    }
  } else {
    while (cs.length && cs[cs.length - 1].l - cs[cs.length - 1].A / 2 > ch.L) cs.pop();
  }
}
function trackedCell(S) {
  const J = S.trk; if (!J || J.gone) return null;
  const cs = S.ch[J.ch].cells; for (let k = cs.length - 1; k >= 0; k--) if (cs[k].trk) return cs[k];
  return null;
}
// Close-up layout in the crypt (v10). The close-up first stays on the crypt bottom and counts the followed daughter's
// distance from the stem in cells (the sim packs crypt cells tighter than a cell width near the base, so positions are
// not used): each cell is one width, and a freshly divided pair widens from half to full width over ~1.3 model s.
const XSW = 4.5;                                                  // cells from the stem at which the close-up turns to follow the cell
function cuWidth(S, cs, k) {
  const c = cs[k], t0 = k === 2 ? c.divM : c.bornT;
  return t0 > -50 ? 0.5 + 0.5 * smooth(0.05, 1.3, S.mt - t0) : 1;
}
function cuDisp(S) {
  const cs = S.ch[S.trk.ch].cells; let x = cuWidth(S, cs, 2) / 2;
  for (let k = 3; k < cs.length; k++) { const w = cuWidth(S, cs, k); if (cs[k].trk) return x + w / 2; x += w; }
  return 0;
}
function step(S, dt) {
  S.t += dt;
  const J = S.trk;
  if (J) {
    let dividing = false;
    if (J.phase === 'niche') dividing = S.ch[J.ch].cells[2].mit >= 0;
    else if (!J.gone) { const cs0 = S.ch[J.ch].cells; for (let m = cs0.length - 1; m >= 0; m--) if (cs0[m].trk) { dividing = cs0[m].mit >= 0; break; } }
    const fresh = S.mt - J.splitM < 1.4;
    const target = (J.phase === 'compete' || (J.phase === 'extrude' && !J.gone)) ? 0.15 : (dividing || fresh) ? 0.22 : 1;
    S.slow += (target - S.slow) * Math.min(1, dt / (target < S.slow ? 0.6 : 1.5));
  } else S.slow = 1;
  const dd = dt * S.slow;
  S.mt += dd;
  for (let i = 0; i < CHAINS.length; i++) stepChain(S, i, dd);
  if (!J) return;
  const ch = CHAINS[J.ch], cs = S.ch[J.ch].cells;
  let k = -1; if (!J.gone) for (let m = cs.length - 1; m >= 0; m--) if (cs[m].trk) { k = m; break; }
  const c = k >= 0 ? cs[k] : null;
  if (c && ch.kind === 'in') { const lu = ch.lV0 + 0.45 * (ch.lTip0 - ch.lV0); c.q = 1 - 0.5 * smooth(lu, ch.lTrk, c.l); }
  if (J.phase === 'flow') {
    if (J.swT < -50 && c && c.mit < 0 && S.mt - J.splitM > 1.4 && cuDisp(S) >= XSW) J.swT = S.t;
    if (c && ch.kind === 'in' && c.l >= ch.lTrk) { J.phase = 'compete'; J.tc = 0; }
  } else if (J.phase === 'compete') {
    J.tc += dt; if (J.tc >= P.TCOMP) { J.phase = 'extrude'; J.te = 0; }
  } else if (J.phase === 'extrude') {
    J.te = Math.min(1, J.te + dt / P.TEXT);
    if (!J.gone && c) {
      c.sig = Math.max(0.001, 1 - smooth(0.6, 0.88, J.te));
      if (J.te >= 0.88) { J.exitL = c.l; J.gone = true; J.goneT = S.t; removeAt(S, J.ch, k); }
    }
    if (J.te >= 1) { J.phase = 'lumen'; J.tl = 0; }
  } else if (J.phase === 'lumen') {
    J.tl = Math.min(1, J.tl + dt / P.TLUM); if (J.tl >= 1) J.phase = 'done';
  }
}
// Confetti: at day 0, a fraction of stem cells recombines to one of four colours (nuclear GFP rarer than the other three).
const CONF_P = 0.3;
const confColour = S => { const x = rnd(S); return x < 0.1 ? 1 : x < 0.4 ? 2 : x < 0.7 ? 3 : 4; };   // 1 nGFP, 2 YFP, 3 RFP, 4 mCFP
// Which stems are labelled: one colour per labelled crypt, so each crypt's ribbons can be told apart, and one crypt
// carrying two clones side by side. Per crypt: [in-column A, in-column B, out-column A, out-column B]; 0 = unlabelled.
// Only the dividing stem cell of a column that leaves the crypt (onto this villus, or outward to the next villi) is
// labelled, so every labelled stripe in a crypt continues as a ribbon.
const CONF_PLAN = { 0: [3, 3, 3, 0], 1: [2, 2, 2, 0], 3: [4, 1, 1, 4] };   // crypt 3: in the cutaway its section shows green (villus side) and blue (outer wall)
function startJourney(S) {
  S.ch.forEach((D, i) => { const ch = CHAINS[i]; if (ch.crypt && ch.kind !== 'crypt' && rnd(S) < CONF_P) confColour(S); });   // same random stream as v8
  CRYPTS.forEach(C => {
    const plan = CONF_PLAN[C.k]; if (!plan) return;
    const ins = CRYPT_CH[C.k].filter(i => CHAINS[i].kind === 'in'), outs = CRYPT_CH[C.k].filter(i => CHAINS[i].kind === 'out');
    [ins[0], ins[1], outs[0], outs[1]].forEach((ci, j) => { if (ci !== undefined && plan[j]) S.ch[ci].cells[2].lab = plan[j]; });
  });
  S.mt0 = S.mt;
  const cs = S.ch[TRK_CH].cells, stem = cs[2];
  stem.lab = 3; stem.cl = true;                                    // the followed clone
  stem.trk = true; stem.mit = -1; S.ch[TRK_CH].stemT = 5.0;
  S.trk = { ch: TRK_CH, id: stem.id, phase: 'niche', t0: S.t, tc: 0, te: 0, tl: 0, gone: false, exitL: 0, goneT: 0, births: [], splitM: -99, swT: -99 };
}
function trackedMitosis(S) {
  const J = S.trk; if (!J) return null;
  if (J.phase === 'niche') { const st = S.ch[J.ch].cells[2]; return st.mit >= 0 ? { p: st.mit, kind: 'stem' } : null; }
  const c = trackedCell(S); return c && c.mit >= 0 ? { p: c.mit, kind: 'ta' } : null;
}
// stage (0-1) of a place on a column's path, as journeyS gives it for the followed cell there; the crypt pole is 0 and
// the far side of the crypt bottom (negative l) mirrors the near side
function sOfL(ch, l) {
  l = Math.abs(l);
  if (l < ch.lN) return 0.12 * l / ch.lN;
  if (l < ch.lTA) return 0.12 + 0.20 * (l - ch.lN) / (ch.lTA - ch.lN);
  if (l < ch.lV0) return 0.32 + 0.10 * (l - ch.lTA) / (ch.lV0 - ch.lTA);
  const lu = ch.lV0 + 0.45 * (ch.lTip0 - ch.lV0);
  if (l < lu) return 0.42 + 0.18 * (l - ch.lV0) / (lu - ch.lV0);
  return Math.min(0.86, 0.60 + 0.20 * (l - lu) / (ch.lTrk - lu));
}
function journeyS(S) {
  const J = S.trk, ch = CHAINS[J.ch];
  if (J.phase === 'niche') return 0.12 * clamp((S.t - J.t0) / (5.0 + P.MIT_TRK + 1.0));
  if (J.phase === 'compete') return 0.80 + 0.04 * clamp(J.tc / P.TCOMP);
  if (J.phase === 'extrude') return 0.84 + 0.10 * J.te;
  if (J.phase === 'lumen' || J.phase === 'done') return 0.94 + 0.06 * J.tl;
  const c = trackedCell(S), l = c.l;
  if (l < ch.lTA) return 0.12 + 0.20 * clamp((l - ch.lN) / (ch.lTA - ch.lN));
  if (l < ch.lV0) return 0.32 + 0.10 * clamp((l - ch.lTA) / (ch.lV0 - ch.lTA));
  const lu = ch.lV0 + 0.45 * (ch.lTip0 - ch.lV0);
  if (l < lu) return 0.42 + 0.18 * (l - ch.lV0) / (lu - ch.lV0);
  return Math.min(0.7999, 0.60 + 0.20 * (l - lu) / (ch.lTrk - lu));
}
// cells are copied field by field in one fixed order: Object.assign copies end up as slow dictionary objects in V8,
// which made every restored state (the look-ahead, scrubbing) several times slower and the snapshots four times larger
const copyCell = c => ({ id: c.id, l: c.l, v: c.v, A: c.A, sig: c.sig, fixed: c.fixed, type: c.type, divLeft: c.divLeft, divT: c.divT, mit: c.mit,
  boost: c.boost, close: c.close, dwell: c.dwell, ext: c.ext, ph: c.ph, per: c.per, eec: c.eec, trk: c.trk, q: c.q, tz: c.tz, tzT: c.tzT,
  bornT: c.bornT, lab: c.lab, cl: c.cl, divM: c.divM });
const copyCells = cells => cells.map(copyCell);
function snapshot(S) { return { t: S.t, mt: S.mt, mt0: S.mt0, slow: S.slow, rng: S.rng, nextId: S.nextId, trk: S.trk && Object.assign({}, S.trk, { births: S.trk.births.slice() }), ch: S.ch.map(D => ({ stemT: D.stemT, demand: D.demand, wait: D.wait, busy: D.busy, cells: copyCells(D.cells) })) }; }
function restore(S, sn) { S.t = sn.t; S.mt = sn.mt; S.mt0 = sn.mt0; S.slow = sn.slow; S.rng = sn.rng; S.nextId = sn.nextId; S.trk = sn.trk && Object.assign({}, sn.trk, { births: sn.trk.births.slice() }); S.ch = sn.ch.map(D => ({ stemT: D.stemT, demand: D.demand, wait: D.wait, busy: D.busy, cells: copyCells(D.cells) })); }

const CRYPT_CH = CRYPTS.map(C => { const a = []; CHAINS.forEach((ch, i) => { if (ch.crypt && ch.cryptK === C.k) a[ch.cc] = i; }); return a; });
return { CRYPT_CH, G, CRYPTS, CHAINS, IN_BY_COL, SECTION, TRK_CH, P, ST, samp, qEff, vField, restLen, create, step, startJourney, trackedCell, trackedMitosis, journeyS, sOfL, snapshot, restore, cuWidth, cuDisp, XSW };
})();
if (typeof module !== 'undefined') module.exports = SIM;
