// BLAST-Trainingsvorlage v2 — stabile Block-IDs, Tier-Spannen, Pausen, Rollen.
// sets:[min,max] -> Tier I = min, Tier II = Mitte, Tier III = max.
// Gemeinsame Struktur fuer alle Nutzer; jeder traegt eigene Uebungen/Werte ein.
export const TPL = {
  'OK-A': { label: 'OK-A', short: 'OK · Load', sub: 'Oberkörper Loading · Unterkörper Pump', rot: 'A', blocks: [
    { id: 'back',  mus: 'Rücken',    type: 'load', sets: [2, 4], rest: 90,  reps: '6–12', ex: [{ r: 'Comp', n: 'Multipresse Rudern' }, { r: 'Iso', n: 'Latzug Untergriff' }] },
    { id: 'chest', mus: 'Brust',     type: 'load', sets: [1, 4], rest: 90,  reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'Brustpresse Aqua' }, { r: 'Iso', n: 'Flys Maschine' }] },
    { id: 'delt',  mus: 'Schultern', type: 'load', sets: [1, 4], rest: 90,  reps: '6–12', ex: [{ r: 'Comp', n: 'Multi Frontdrücken' }, { r: 'Iso', n: 'KH Seitheben' }] },
    { id: 'p_quad', mus: 'Quads',       type: 'pump', sets: [1, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },
    { id: 'p_gh',   mus: 'Glutes/Hams', type: 'pump', sets: [1, 1], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },
    { id: 'p_calf', mus: 'Waden',       type: 'pump', sets: [1, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },    { id: 'p_fore', mus: 'Unterarme',   type: 'pump', sets: [1, 2], rest: 60, reps: 'Halt/Wdh', ex: [{ n: 'Fat-Gripz Halt 30–60 s' }, { n: 'Reverse Curls' }] },
  ] },
  'UK-A': { label: 'UK-A', short: 'UK · Load', sub: 'Unterkörper Loading · Oberkörper Pump', rot: 'A', blocks: [
    { id: 'legs', mus: 'Beine',       type: 'load', sets: [1, 3], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'Beinpresse 45°' }] },
    { id: 'quad', mus: 'Quads',       type: 'load', sets: [1, 1], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'Splitsquats FFE' }] },
    { id: 'gh',   mus: 'Glutes/Hams', type: 'load', sets: [1, 1], rest: 120, reps: '10–15', ex: [{ r: 'Iso', n: 'BX einbeinig' }] },
    { id: 'add',  mus: 'Adduktoren',  type: 'load', sets: [1, 1], rest: 120, reps: '10–15', free: 1, ex: [{ r: 'Iso', n: 'Adduktion Kabel / Copenhagen' }] },
    { id: 'calf', mus: 'Waden',       type: 'load', sets: [2, 5], rest: 90,  reps: '8–12', stretch: 1, ex: [{ r: 'Comp', n: 'Wadenheben Multipresse' }] },
    { id: 'p_bk', mus: 'Brust + Rücken',  type: 'pump', sets: [1, 2], rest: 60, reps: '15–25', free: 1, stretch: 1, ex: [{ n: '' }, { n: '' }] },
    { id: 'p_da', mus: 'Schultern + Abs', type: 'pump', sets: [1, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }, { n: '' }] },
    { id: 'p_arm', mus: 'Bi + Tri',   type: 'pump', sets: [1, 2], rest: 60, reps: '12–20', free: 1, stretch: 1, ex: [{ n: 'Trizeps Überkopf' }, { n: 'Bizeps' }] },
    { id: 'p_fore', mus: 'Unterarme', type: 'pump', sets: [1, 2], rest: 60, reps: 'Halt/Wdh', ex: [{ n: 'Hammer Curls' }, { n: 'Handgelenk-Curls' }] },
  ] },
  'OK-B': { label: 'OK-B', short: 'OK · Load', sub: 'Oberkörper Loading · Unterkörper Pump', rot: 'B', blocks: [
    { id: 'back',  mus: 'Rücken',    type: 'load', sets: [2, 4], rest: 90, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'PL Rows' }, { r: 'Iso', n: 'KH Überzüge' }] },
    { id: 'chest', mus: 'Brust',     type: 'load', sets: [1, 4], rest: 90, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'PL Flach' }, { r: 'Iso', n: 'KH Flys' }] },
    { id: 'delt',  mus: 'Schultern', type: 'load', sets: [1, 4], rest: 90, reps: '6–12', ex: [{ r: 'Comp', n: 'Rudern aufrecht Kabel' }, { r: 'Iso', n: 'Seitheben Gewichtheber' }] },
    { id: 'p_quad', mus: 'Quads',       type: 'pump', sets: [1, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },
    { id: 'p_gh',   mus: 'Glutes/Hams', type: 'pump', sets: [1, 1], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },
    { id: 'p_calf', mus: 'Waden',       type: 'pump', sets: [1, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },    { id: 'p_fore', mus: 'Unterarme',   type: 'pump', sets: [1, 2], rest: 60, reps: 'Halt/Wdh', ex: [{ n: 'Fat-Gripz Halt 30–60 s' }, { n: 'Reverse Curls' }] },
  ] },
  'UK-B': { label: 'UK-B', short: 'UK · Load', sub: 'Unterkörper Loading · Oberkörper Pump', rot: 'B', blocks: [
    { id: 'legs', mus: 'Beine',       type: 'load', sets: [1, 3], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'Beinpresse 45° Aqua' }] },
    { id: 'quad', mus: 'Quads',       type: 'load', sets: [1, 1], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: 'Splitsquats FFE' }] },
    { id: 'gh',   mus: 'Glutes/Hams', type: 'load', sets: [1, 1], rest: 120, reps: '10–15', ex: [{ r: 'Iso', n: 'BX einbeinig' }] },
    { id: 'add',  mus: 'Adduktoren',  type: 'load', sets: [1, 1], rest: 120, reps: '10–15', free: 1, ex: [{ r: 'Iso', n: 'Adduktion Kabel / Copenhagen' }] },
    { id: 'calf', mus: 'Waden',       type: 'load', sets: [2, 5], rest: 90,  reps: '8–12', stretch: 1, ex: [{ r: 'Comp', n: 'Wadenheben Multipresse' }] },
    { id: 'p_bk', mus: 'Brust + Rücken',  type: 'pump', sets: [1, 2], rest: 60, reps: '15–25', free: 1, stretch: 1, ex: [{ n: '' }, { n: '' }] },
    { id: 'p_da', mus: 'Schultern + Abs', type: 'pump', sets: [1, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }, { n: '' }] },
    { id: 'p_arm', mus: 'Bi + Tri',   type: 'pump', sets: [1, 2], rest: 60, reps: '12–20', free: 1, stretch: 1, ex: [{ n: 'Trizeps Überkopf' }, { n: 'Bizeps' }] },
    { id: 'p_fore', mus: 'Unterarme', type: 'pump', sets: [1, 2], rest: 60, reps: 'Halt/Wdh', ex: [{ n: 'Hammer Curls' }, { n: 'Handgelenk-Curls' }] },
  ] },
  'MRs': { label: 'MRs', short: 'Muscle Rounds', sub: 'Ganzkörper · 6×4 · ~15RM · 10 s zwischen Minisätzen', rot: '*', blocks: [
    { id: 'm_bkth', mus: 'Rücken Dicke',  type: 'mr', sets: [1, 2], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }] },
    { id: 'm_bkwi', mus: 'Rücken Breite', type: 'mr', sets: [1, 1], rest: 10, reps: '6×4', free: 1, stretch: 1, ex: [{ n: '' }] },
    { id: 'm_ch',   mus: 'Brust',         type: 'mr', sets: [1, 2], rest: 10, reps: '6×4', free: 1, stretch: 1, ex: [{ n: '' }] },
    { id: 'm_de',   mus: 'Schultern',     type: 'mr', sets: [1, 2], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }] },
    { id: 'm_arm',  mus: 'Tri u/o Bi',    type: 'mr', sets: [1, 1], rest: 10, reps: '6×4', free: 1, stretch: 1, ex: [{ n: '' }] },
    { id: 'm_gh',   mus: 'Opt: Glutes/Hams', type: 'mr', sets: [0, 1], rest: 10, reps: '6×4', free: 1, opt: 1, ex: [{ n: '' }] },
    { id: 'm_calf', mus: 'Opt: Waden/Add.',  type: 'mr', sets: [0, 1], rest: 10, reps: '6×4', free: 1, opt: 1, ex: [{ n: '' }] },
    { id: 'm_abs',  mus: 'Opt: Abs',         type: 'mr', sets: [0, 1], rest: 10, reps: '—',   free: 1, opt: 1, ex: [{ n: '' }] },
  ] },
};

// Migration alter index-basierter Daten (v1) auf id-basierte Blöcke (v2).
export const LEGACY = {
  'OK-A': ['back', 'chest', 'delt', 'p_quad', 'p_gh', 'p_calf', 'p_fore'],
  'OK-B': ['back', 'chest', 'delt', 'p_quad', 'p_gh', 'p_calf', 'p_fore'],
  'UK-A': ['legs', 'quad', 'gh', 'add', 'calf', 'p_bk', 'p_da', 'p_arm', 'p_fore'],
  'UK-B': ['legs', 'quad', 'gh', 'add', 'calf', 'p_bk', 'p_da', 'p_arm', 'p_fore'],
  'MRs':  ['m_bkth', 'm_bkwi', 'm_ch', 'm_de', 'm_arm', 'm_gh', 'm_calf', 'm_abs'],
};

export const TIER_NAMES = ['I', 'II', 'III'];
