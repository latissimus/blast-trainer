// BLAST-Trainingsvorlage v3 — feste Satzzahlen je Level.
// sets: [Level I, II, III]  (Gesamt-Sätze des Blocks; Wechsel-Split Comp/Iso auf die Übungen).
// typeByTier: optionaler Typ-Wechsel je Level (z.B. Cluster-Tag: Tris/Bis & Abs sind bei
// niedrigen Leveln Pump statt Cluster).
export const TPL = {
  'OK-A': { short: 'OK · Heavy', sub: 'Oberkörper Heavy · Unterkörper Pump', rot: 'A', blocks: [
    { id: 'back',  mus: 'Rücken',    type: 'load', sets: [2, 3, 4], rest: 90,  reps: '6–12', ex: [{ r: 'Comp', n: 'Multipresse Rudern' }, { r: 'Iso', n: 'Latzug Untergriff' }] },
    { id: 'chest', mus: 'Brust',     type: 'load', sets: [1, 2, 4], rest: 90,  reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'Brustpresse Aqua' }, { r: 'Iso', n: 'Flys Maschine' }] },
    { id: 'delt',  mus: 'Schultern', type: 'load', sets: [1, 2, 4], rest: 90,  reps: '6–12', ex: [{ r: 'Comp', n: 'Multi Frontdrücken' }, { r: 'Iso', n: 'KH Seitheben' }] },
    { id: 'p_quad', mus: 'Beine',         type: 'pump', sets: [1, 2, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },
    // Fussnote ‡: Level I nur ein Satz fuer den schwaecheren von beiden, Level II/III je einer.
    { id: 'p_gh',   mus: 'Quads + Hams',  type: 'pump', sets: [1, 1, 1], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }, { n: '' }], exByTier: [[{ n: '' }], [{ n: '' }, { n: '' }], [{ n: '' }, { n: '' }]] },
    { id: 'p_calf', mus: 'Waden',         type: 'pump', sets: [1, 1, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },  ] },
  'UK-A': { short: 'UK · Heavy', sub: 'Unterkörper Heavy · Oberkörper Pump', rot: 'A', blocks: [
    { id: 'legs', mus: 'Beine',       type: 'load', sets: [1, 2, 3], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'Beinpresse 45°' }] },
    { id: 'quad', mus: 'Quads',       type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Iso', n: 'Splitsquats FFE' }] },
    { id: 'gh',   mus: 'Hams',        type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', ex: [{ r: 'Iso', n: 'BX einbeinig' }] },
    { id: 'add',  mus: 'Adduktoren',  type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', free: 1, ex: [{ r: 'Iso', n: 'Adduktion Kabel / Copenhagen' }] },
    { id: 'calf', mus: 'Waden',       type: 'load', sets: [2, 4, 5], rest: 60,  reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'Wadenheben Multipresse' }] },
    { id: 'p_bk', mus: 'Brust + Rücken',  type: 'pump', sets: [1, 2, 2], rest: 60, reps: '15–25', free: 1, stretch: 1, ex: [{ n: '' }, { n: '' }] },
    { id: 'p_da', mus: 'Schultern + Abs', type: 'pump', sets: [1, 2, 3], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }, { n: '' }] },
    { id: 'p_arm', mus: 'Bi + Tri',   type: 'pump', sets: [1, 1, 2], rest: 60, reps: '15–25', free: 1, stretch: 1, ex: [{ n: '' }, { n: '' }] },  ] },
  'OK-B': { short: 'OK · Heavy', sub: 'Oberkörper Heavy · Unterkörper Pump', rot: 'B', blocks: [
    { id: 'back',  mus: 'Rücken',    type: 'load', sets: [2, 3, 4], rest: 90, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'PL Rows' }, { r: 'Iso', n: 'KH Überzüge' }] },
    { id: 'chest', mus: 'Brust',     type: 'load', sets: [1, 2, 4], rest: 90, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'PL Flach' }, { r: 'Iso', n: 'KH Flys' }] },
    { id: 'delt',  mus: 'Schultern', type: 'load', sets: [1, 2, 4], rest: 90, reps: '6–12', ex: [{ r: 'Comp', n: 'Rudern aufrecht Kabel' }, { r: 'Iso', n: 'Seitheben Gewichtheber' }] },
    { id: 'p_quad', mus: 'Beine',         type: 'pump', sets: [1, 2, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },
    { id: 'p_gh',   mus: 'Quads + Hams',  type: 'pump', sets: [1, 1, 1], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }, { n: '' }], exByTier: [[{ n: '' }], [{ n: '' }, { n: '' }], [{ n: '' }, { n: '' }]] },
    { id: 'p_calf', mus: 'Waden',         type: 'pump', sets: [1, 1, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },  ] },
  'UK-B': { short: 'UK · Heavy', sub: 'Unterkörper Heavy · Oberkörper Pump', rot: 'B', blocks: [
    { id: 'legs', mus: 'Beine',       type: 'load', sets: [1, 2, 3], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'Beinpresse 45° Aqua' }] },
    { id: 'quad', mus: 'Quads',       type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Iso', n: 'Splitsquats FFE' }] },
    { id: 'gh',   mus: 'Hams',        type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', ex: [{ r: 'Iso', n: 'BX einbeinig' }] },
    { id: 'add',  mus: 'Adduktoren',  type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', free: 1, ex: [{ r: 'Iso', n: 'Adduktion Kabel / Copenhagen' }] },
    { id: 'calf', mus: 'Waden',       type: 'load', sets: [2, 4, 5], rest: 60,  reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'Wadenheben Multipresse' }] },
    { id: 'p_bk', mus: 'Brust + Rücken',  type: 'pump', sets: [1, 2, 2], rest: 60, reps: '15–25', free: 1, stretch: 1, ex: [{ n: '' }, { n: '' }] },
    { id: 'p_da', mus: 'Schultern + Abs', type: 'pump', sets: [1, 2, 3], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }, { n: '' }] },
    { id: 'p_arm', mus: 'Bi + Tri',   type: 'pump', sets: [1, 1, 2], rest: 60, reps: '15–25', free: 1, stretch: 1, ex: [{ n: '' }, { n: '' }] },  ] },
  'MRs': { short: 'Clusters', sub: 'Ganzkörper · 6×4 · ~15RM · 10 s zwischen Minisätzen', rot: '*', blocks: [
    { id: 'm_bkth', mus: 'Rücken Dicke',  type: 'mr', sets: [1, 2, 2], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }] },
    { id: 'm_bkwi', mus: 'Rücken Breite', type: 'mr', sets: [1, 1, 1], rest: 10, reps: '6×4', free: 1, stretch: 1, ex: [{ n: '' }] },
    { id: 'm_ch',   mus: 'Brust',         type: 'mr', sets: [1, 2, 2], rest: 10, reps: '6×4', free: 1, stretch: 1, ex: [{ n: '' }] },
    { id: 'm_de',   mus: 'Schultern',     type: 'mr', sets: [1, 1, 2], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }] },
    { id: 'm_arm',  mus: 'Tri u/o Bi',    type: 'mr', typeByTier: ['pump', 'mr', 'mr'], sets: [1, 1, 1], rest: 10, reps: '6×4', free: 1, stretch: 1, ex: [{ n: '' }, { n: '' }] },
    { id: 'm_gh',   mus: 'Beine (Hams)',  type: 'mr', sets: [1, 1, 1], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }] },
    // Fussnote ^: je ein Satz fuer Waden und/oder Adduktoren – zwei Felder wie bei Tri/Bi.
    { id: 'm_calf', mus: 'Waden / Add.',  type: 'mr', sets: [1, 1, 1], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }, { n: '' }] },
    { id: 'm_abs',  mus: 'Abs',           type: 'mr', typeByTier: ['pump', 'pump', 'mr'], sets: [1, 1, 1], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }] },
  ] },
};

// Deload (Wochen 7–8): 2–3× pro Woche, ausschliesslich Clusters. Drei Slots teilen sich
// dieselbe Vorlage, damit jede Einheit einzeln geloggt wird; der dritte ist optional.
// Gleiche Referenz genuegt – TPL wird nur gelesen.
TPL['MRs-2'] = TPL['MRs'];
TPL['MRs-3'] = TPL['MRs'];

// Migration alter index-basierter Daten (v1) auf id-basierte Blöcke.
export const LEGACY = {
  'OK-A': ['back', 'chest', 'delt', 'p_quad', 'p_gh', 'p_calf'],
  'OK-B': ['back', 'chest', 'delt', 'p_quad', 'p_gh', 'p_calf'],
  'UK-A': ['legs', 'quad', 'gh', 'add', 'calf', 'p_bk', 'p_da', 'p_arm'],
  'UK-B': ['legs', 'quad', 'gh', 'add', 'calf', 'p_bk', 'p_da', 'p_arm'],
  'MRs':  ['m_bkth', 'm_bkwi', 'm_ch', 'm_de', 'm_arm', 'm_gh', 'm_calf', 'm_abs'],
};

export const TIER_NAMES = ['I', 'II', 'III'];
