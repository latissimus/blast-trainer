// BLAST-Trainingsvorlage – gemeinsame Struktur fuer alle Nutzer.
// Jeder Nutzer traegt eigene Uebungen, Gewichte, Wdh und RIR ein.
export const TPL = {
  'OK-A': { sub: 'Oberkörper Load · Unterkörper Pump', blocks: [
    { mus: 'Rücken',    type: 'load', rr: '6–12',     ex: ['Multipresse Rudern', 'Latzug Untergriff'] },
    { mus: 'Brust',     type: 'load', rr: '6–12', stretch: true, ex: ['Brustpresse Aqua', 'Flys Maschine'] },
    { mus: 'Schultern', type: 'load', rr: '6–12',     ex: ['Multi Frontdrücken', 'KH Seitheben'] },
    { mus: 'Beine',       type: 'pump', rr: '15–25', free: true, ex: [''] },
    { mus: 'Glutes/Hams', type: 'pump', rr: '15–25', free: true, ex: [''] },
    { mus: 'Waden',       type: 'pump', rr: '15–25', free: true, ex: [''] },
    { mus: 'Unterarme',   type: 'pump', rr: 'Halt/Wdh', ex: ['Fat-Gripz Halt', 'Reverse Curls'] },
  ] },
  'UK-A': { sub: 'Unterkörper Load · Oberkörper Pump', blocks: [
    { mus: 'Beine',       type: 'load', rr: '6–12',  stretch: true, ex: ['Beinpresse 45°'] },
    { mus: 'Quads',       type: 'load', rr: '6–12',  stretch: true, ex: ['Splitsquats FFE'] },
    { mus: 'Glutes/Hams', type: 'load', rr: '10–15', ex: ['BX einbeinig'] },
    { mus: 'Adduktoren',  type: 'load', rr: '10–15', free: true, ex: ['Adduktion (Kabel/Maschine)'] },
    { mus: 'Waden',       type: 'load', rr: '8–12',  stretch: true, ex: ['Wadenheben Multipresse'] },
    { mus: 'Brust+Rücken',   type: 'pump', rr: '15–25', free: true, ex: [''] },
    { mus: 'Schultern+Abs',  type: 'pump', rr: '15–25', free: true, ex: [''] },
    { mus: 'Bi+Tri',         type: 'pump', rr: '12–20', free: true, ex: ['Trizeps (Overhead)', 'Bizeps'] },
    { mus: 'Unterarme',      type: 'pump', rr: 'Halt/Wdh', ex: ['Hammer Curls', 'Handgelenk-Curls'] },
  ] },
  'OK-B': { sub: 'Oberkörper Load · Unterkörper Pump', blocks: [
    { mus: 'Rücken',    type: 'load', rr: '6–12', stretch: true, ex: ['PL Rows', 'KH Überzüge'] },
    { mus: 'Brust',     type: 'load', rr: '6–12', stretch: true, ex: ['PL Flach', 'KH Flys'] },
    { mus: 'Schultern', type: 'load', rr: '6–12', ex: ['Rudern aufrecht Kabel', 'Seitheben Gewichtheber'] },
    { mus: 'Beine',       type: 'pump', rr: '15–25', free: true, ex: [''] },
    { mus: 'Glutes/Hams', type: 'pump', rr: '15–25', free: true, ex: [''] },
    { mus: 'Waden',       type: 'pump', rr: '15–25', free: true, ex: [''] },
    { mus: 'Unterarme',   type: 'pump', rr: 'Halt/Wdh', ex: ['Fat-Gripz Halt', 'Reverse Curls'] },
  ] },
  'UK-B': { sub: 'Unterkörper Load · Oberkörper Pump', blocks: [
    { mus: 'Beine',       type: 'load', rr: '6–12',  stretch: true, ex: ['Beinpresse 45°'] },
    { mus: 'Quads',       type: 'load', rr: '6–12',  stretch: true, ex: ['Splitsquats FFE'] },
    { mus: 'Glutes/Hams', type: 'load', rr: '10–15', ex: ['BX einbeinig'] },
    { mus: 'Adduktoren',  type: 'load', rr: '10–15', free: true, ex: ['Adduktion (Kabel/Maschine)'] },
    { mus: 'Waden',       type: 'load', rr: '8–12',  stretch: true, ex: ['Wadenheben Multipresse'] },
    { mus: 'Brust+Rücken',   type: 'pump', rr: '15–25', free: true, ex: [''] },
    { mus: 'Schultern+Abs',  type: 'pump', rr: '15–25', free: true, ex: [''] },
    { mus: 'Bi+Tri',         type: 'pump', rr: '12–20', free: true, ex: ['Trizeps (Overhead)', 'Bizeps'] },
    { mus: 'Unterarme',      type: 'pump', rr: 'Halt/Wdh', ex: ['Hammer Curls', 'Handgelenk-Curls'] },
  ] },
  'MRs': { sub: 'Muscle Rounds · 6×4 · ~15RM', blocks: [
    { mus: 'Rücken Dicke',      type: 'mr', rr: '6×4', free: true, ex: [''] },
    { mus: 'Rücken Breite',     type: 'mr', rr: '6×4', free: true, ex: [''] },
    { mus: 'Brust',             type: 'mr', rr: '6×4', stretch: true, free: true, ex: [''] },
    { mus: 'Schultern',         type: 'mr', rr: '6×4', free: true, ex: [''] },
    { mus: 'Tri u/o Bi',        type: 'mr', rr: '6×4', stretch: true, free: true, ex: [''] },
    { mus: 'Opt: Glutes/Hams',  type: 'mr', rr: '6×4', free: true, ex: [''] },
    { mus: 'Opt: Waden/Add.',   type: 'mr', rr: '6×4', free: true, ex: [''] },
    { mus: 'Opt: Abs',          type: 'mr', rr: '—',   free: true, ex: [''] },
  ] },
};

export const DAYS = Object.keys(TPL);
