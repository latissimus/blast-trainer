// LOGMAN-Trainingsvorlage v3 — feste Satzzahlen je Level.
// sets: [Level I, II, III]  (Gesamt-Sätze des Blocks; Wechsel-Split Comp/Iso auf die Übungen).
// typeByTier: optionaler Typ-Wechsel je Level (z.B. Cluster-Tag: Tris/Bis & Abs sind bei
// niedrigen Leveln Pump statt Cluster).
//
// konten: welche Muskelkonten dieser Block bedienen darf. Steuert, welche
// Übungen der Katalog im Auswahlfeld anbietet. Die Beschriftung (mus) bleibt
// bewusst grob ("Schultern"), die Konten sind fein: Welcher Schulterkopf
// drankommt, ist eine Entscheidung beim Auswählen, keine der Vorlage.
//
// Ein Feld darf eigene konten mitbringen – dann gelten seine statt der des
// Blocks. Genau dafür sind die zusammengesetzten Blöcke da: "Brust + Rücken"
// hat zwei Felder, und das erste ist die Brust, das zweite der Rücken. Ohne das
// böte jedes der beiden Felder alle 65 Übungen beider Muskelgruppen an – auf
// einem Telefon ein Scrollrad, durch das man sich zweimal durchdreht.
//
// Kein Feld hat mehr eine voreingetragene Übung. Früher standen hier Kürzel aus
// Florians Studio ("PL Flach", "Brustpresse Aqua"); seit die Auswahl
// ausschliesslich aus dem Katalog kommt, wären das Namen, die es dort nicht gibt.
// Einmal auswählen genügt – die Wahl gilt für alle Wochen der Rotation.
export const TPL = {
  'OK-A': { short: 'OK · Heavy', sub: 'Oberkörper Heavy · Unterkörper Pump', rot: 'A', blocks: [
    { id: 'back',  mus: 'Rücken',    konten: ['Lat', 'Oberer Rücken'], type: 'load', sets: [2, 3, 4], rest: 90,  reps: '6–12', ex: [{ r: 'Comp', n: '' }, { r: 'Iso', n: '' }] },
    { id: 'chest', mus: 'Brust',     konten: ['Brust'], type: 'load', sets: [1, 2, 4], rest: 90,  reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: '' }, { r: 'Iso', n: '' }] },
    { id: 'delt',  mus: 'Schultern', konten: ['Vordere Schulter', 'Seitliche Schulter', 'Hintere Schulter'], type: 'load', sets: [1, 2, 4], rest: 90,  reps: '6–12', ex: [{ r: 'Comp', n: '' }, { r: 'Iso', n: '' }] },
    { id: 'p_quad', mus: 'Beine',         konten: ['Quads', 'Glutes', 'Hams', 'Adduktoren'], type: 'pump', sets: [1, 2, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },
    // Fussnote ‡: Level I nur ein Satz fuer den schwaecheren von beiden, Level II/III je einer.
    { id: 'p_gh',   mus: 'Quads + Hams/Glutes',  konten: ['Quads', 'Hams', 'Glutes'], type: 'pump', sets: [1, 1, 1], rest: 60, reps: '15–25', free: 1,
      ex: [{ n: '', konten: ['Quads'] }, { n: '', konten: ['Hams', 'Glutes'] }],
      // Level I hat nur ein Feld (der schwaechere von beiden) – dort beide anbieten.
      exByTier: [[{ n: '', konten: ['Quads', 'Hams', 'Glutes'] }], [{ n: '', konten: ['Quads'] }, { n: '', konten: ['Hams', 'Glutes'] }], [{ n: '', konten: ['Quads'] }, { n: '', konten: ['Hams', 'Glutes'] }]] },
    { id: 'p_calf', mus: 'Waden',         konten: ['Waden'], type: 'pump', sets: [1, 1, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },  ] },
  'UK-A': { short: 'UK · Heavy', sub: 'Unterkörper Heavy · Oberkörper Pump', rot: 'A', blocks: [
    { id: 'legs', mus: 'Beine',       konten: ['Quads', 'Glutes'], type: 'load', sets: [1, 2, 3], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: '' }] },
    { id: 'quad', mus: 'Quads',       konten: ['Quads'], type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Iso', n: '' }] },
    { id: 'gh',   mus: 'Hams/Glutes', konten: ['Hams', 'Glutes'], type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', ex: [{ r: 'Iso', n: '' }] },
    { id: 'add',  mus: 'Adduktoren',  konten: ['Adduktoren'], type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', free: 1, ex: [{ r: 'Iso', n: '' }] },
    // Waden sind im Katalog durchgehend Iso – es gibt keine Verbund-Wadenübung.
    // Stand hier frueher auf Comp, dann bot die Auswahl nichts an.
    { id: 'calf', mus: 'Waden',       konten: ['Waden'], type: 'load', sets: [2, 4, 5], rest: 60,  reps: '6–12', stretch: 1, ex: [{ r: 'Iso', n: '' }] },
    { id: 'p_bk', mus: 'Brust + Rücken',  konten: ['Brust', 'Lat', 'Oberer Rücken'], type: 'pump', sets: [1, 2, 2], rest: 60, reps: '15–25', free: 1, stretch: 1,
      ex: [{ n: '', konten: ['Brust'] }, { n: '', konten: ['Lat', 'Oberer Rücken'] }] },
    { id: 'p_da', mus: 'Schultern + Abs', konten: ['Vordere Schulter', 'Seitliche Schulter', 'Hintere Schulter', 'Abs'], type: 'pump', sets: [1, 2, 3], rest: 60, reps: '15–25', free: 1,
      ex: [{ n: '', konten: ['Vordere Schulter', 'Seitliche Schulter', 'Hintere Schulter'] }, { n: '', konten: ['Abs'] }] },
    { id: 'p_arm', mus: 'Bi + Tri',   konten: ['Bizeps', 'Trizeps', 'Unterarme'], type: 'pump', sets: [1, 1, 2], rest: 60, reps: '15–25', free: 1, stretch: 1,
      // Unterarme laufen beim Bizeps mit: Reverse und Hammercurls gehoeren dorthin.
      ex: [{ n: '', konten: ['Bizeps', 'Unterarme'] }, { n: '', konten: ['Trizeps'] }] },  ] },
  'OK-B': { short: 'OK · Heavy', sub: 'Oberkörper Heavy · Unterkörper Pump', rot: 'B', blocks: [
    { id: 'back',  mus: 'Rücken',    konten: ['Lat', 'Oberer Rücken'], type: 'load', sets: [2, 3, 4], rest: 90, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: '' }, { r: 'Iso', n: '' }] },
    { id: 'chest', mus: 'Brust',     konten: ['Brust'], type: 'load', sets: [1, 2, 4], rest: 90, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: '' }, { r: 'Iso', n: '' }] },
    { id: 'delt',  mus: 'Schultern', konten: ['Vordere Schulter', 'Seitliche Schulter', 'Hintere Schulter'], type: 'load', sets: [1, 2, 4], rest: 90, reps: '6–12', ex: [{ r: 'Comp', n: '' }, { r: 'Iso', n: '' }] },
    { id: 'p_quad', mus: 'Beine',         konten: ['Quads', 'Glutes', 'Hams', 'Adduktoren'], type: 'pump', sets: [1, 2, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },
    { id: 'p_gh',   mus: 'Quads + Hams/Glutes',  konten: ['Quads', 'Hams', 'Glutes'], type: 'pump', sets: [1, 1, 1], rest: 60, reps: '15–25', free: 1,
      ex: [{ n: '', konten: ['Quads'] }, { n: '', konten: ['Hams', 'Glutes'] }],
      // Level I hat nur ein Feld (der schwaechere von beiden) – dort beide anbieten.
      exByTier: [[{ n: '', konten: ['Quads', 'Hams', 'Glutes'] }], [{ n: '', konten: ['Quads'] }, { n: '', konten: ['Hams', 'Glutes'] }], [{ n: '', konten: ['Quads'] }, { n: '', konten: ['Hams', 'Glutes'] }]] },
    { id: 'p_calf', mus: 'Waden',         konten: ['Waden'], type: 'pump', sets: [1, 1, 2], rest: 60, reps: '15–25', free: 1, ex: [{ n: '' }] },  ] },
  'UK-B': { short: 'UK · Heavy', sub: 'Unterkörper Heavy · Oberkörper Pump', rot: 'B', blocks: [
    { id: 'legs', mus: 'Beine',       konten: ['Quads', 'Glutes'], type: 'load', sets: [1, 2, 3], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Comp', n: '' }] },
    { id: 'quad', mus: 'Quads',       konten: ['Quads'], type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', stretch: 1, ex: [{ r: 'Iso', n: '' }] },
    { id: 'gh',   mus: 'Hams/Glutes', konten: ['Hams', 'Glutes'], type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', ex: [{ r: 'Iso', n: '' }] },
    { id: 'add',  mus: 'Adduktoren',  konten: ['Adduktoren'], type: 'load', sets: [1, 1, 1], rest: 120, reps: '6–12', free: 1, ex: [{ r: 'Iso', n: '' }] },
    { id: 'calf', mus: 'Waden',       konten: ['Waden'], type: 'load', sets: [2, 4, 5], rest: 60,  reps: '6–12', stretch: 1, ex: [{ r: 'Iso', n: '' }] },
    { id: 'p_bk', mus: 'Brust + Rücken',  konten: ['Brust', 'Lat', 'Oberer Rücken'], type: 'pump', sets: [1, 2, 2], rest: 60, reps: '15–25', free: 1, stretch: 1,
      ex: [{ n: '', konten: ['Brust'] }, { n: '', konten: ['Lat', 'Oberer Rücken'] }] },
    { id: 'p_da', mus: 'Schultern + Abs', konten: ['Vordere Schulter', 'Seitliche Schulter', 'Hintere Schulter', 'Abs'], type: 'pump', sets: [1, 2, 3], rest: 60, reps: '15–25', free: 1,
      ex: [{ n: '', konten: ['Vordere Schulter', 'Seitliche Schulter', 'Hintere Schulter'] }, { n: '', konten: ['Abs'] }] },
    { id: 'p_arm', mus: 'Bi + Tri',   konten: ['Bizeps', 'Trizeps', 'Unterarme'], type: 'pump', sets: [1, 1, 2], rest: 60, reps: '15–25', free: 1, stretch: 1,
      // Unterarme laufen beim Bizeps mit: Reverse und Hammercurls gehoeren dorthin.
      ex: [{ n: '', konten: ['Bizeps', 'Unterarme'] }, { n: '', konten: ['Trizeps'] }] },  ] },
  'MRs': { short: 'Clusters', sub: '6×4 · ~15RM · 10 s zwischen Minisätzen', rot: '*', blocks: [
    // Dicke/Breite deckt sich mit den Konten: Dicke = oberer Rücken (Rudern),
    // Breite = Lat (Ziehen von oben).
    { id: 'm_bkth', mus: 'Rücken Dicke',  konten: ['Oberer Rücken'], type: 'mr', sets: [1, 2, 2], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }] },
    { id: 'm_bkwi', mus: 'Rücken Breite', konten: ['Lat'], type: 'mr', sets: [1, 1, 1], rest: 10, reps: '6×4', free: 1, stretch: 1, ex: [{ n: '' }] },
    { id: 'm_ch',   mus: 'Brust',         konten: ['Brust'], type: 'mr', sets: [1, 2, 2], rest: 10, reps: '6×4', free: 1, stretch: 1, ex: [{ n: '' }] },
    { id: 'm_de',   mus: 'Schultern',     konten: ['Vordere Schulter', 'Seitliche Schulter', 'Hintere Schulter'], type: 'mr', sets: [1, 1, 2], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }] },
    { id: 'm_arm',  mus: 'Tri u/o Bi',    konten: ['Trizeps', 'Bizeps', 'Unterarme'], type: 'mr', typeByTier: ['pump', 'mr', 'mr'], sets: [1, 1, 1], rest: 10, reps: '6×4', free: 1, stretch: 1,
      ex: [{ n: '', konten: ['Trizeps'] }, { n: '', konten: ['Bizeps', 'Unterarme'] }] },
    { id: 'm_gh',   mus: 'Beine (Hams)',  konten: ['Hams'], type: 'mr', sets: [1, 1, 1], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }] },
    // Fussnote ^: je ein Satz fuer Waden und/oder Adduktoren – zwei Felder wie bei Tri/Bi.
    { id: 'm_calf', mus: 'Waden / Add.',  konten: ['Waden', 'Adduktoren'], type: 'mr', sets: [1, 1, 1], rest: 10, reps: '6×4', free: 1,
      ex: [{ n: '', konten: ['Waden'] }, { n: '', konten: ['Adduktoren'] }] },
    { id: 'm_abs',  mus: 'Abs',           konten: ['Abs'], type: 'mr', typeByTier: ['pump', 'pump', 'mr'], sets: [1, 1, 1], rest: 10, reps: '6×4', free: 1, ex: [{ n: '' }] },
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
