import { describe, expect, it } from 'vitest';
import {
  gewichtAus, schwerstesGewicht, steigerungsWarnung, staerksteSteigerung, steigerungsErklaerung,
} from './steigerung.js';

describe('Steigerungswarnung', () => {
  it('warnt beim Sprung von 175 auf 200 kg (+14 %)', () => {
    const w = steigerungsWarnung(175, '200');
    expect(w).toMatchObject({ kg: 25, prozent: 14, von: 185, bis: 192.5 });
  });

  it('warnt genau ab 10 % – auch ohne Gleitkomma-Ausrutscher', () => {
    expect(steigerungsWarnung(175, '192,5')).not.toBeNull();
    expect(steigerungsWarnung(175, '190')).toBeNull();
  });

  it('warnt nicht bei kleinen Gewichten, deren kleinster Schritt schon viele Prozent ist', () => {
    expect(steigerungsWarnung(20, '22,5')).toBeNull();   // Kabel: +12,5 %, aber nur 2,5 kg
    expect(steigerungsWarnung(10, '12')).toBeNull();     // Kurzhantel: +20 %, nur 2 kg
    expect(steigerungsWarnung(25, '27,5')).toBeNull();   // genau 2,5 kg bleiben erlaubt
    expect(steigerungsWarnung(30, '33')).not.toBeNull(); // +3 kg und +10 %
  });

  it('warnt nicht bei gleichem oder geringerem Gewicht und nicht bei leeren Feldern', () => {
    expect(steigerungsWarnung(175, '175')).toBeNull();
    expect(steigerungsWarnung(175, '150')).toBeNull();
    expect(steigerungsWarnung(175, '')).toBeNull();
    expect(steigerungsWarnung(null, '200')).toBeNull();
    expect(steigerungsWarnung(175, 'abc')).toBeNull();
  });

  it('vergleicht mit dem schwersten Satz vom letzten Mal', () => {
    const vorher = [{ w: '160', r: '10' }, { w: '175', r: '8' }, { w: '', r: '' }];
    expect(schwerstesGewicht(vorher)).toBe(175);
    expect(staerksteSteigerung(vorher, [{ w: '180' }, { w: '200' }])).toMatchObject({ jetzt: 200, prozent: 14 });
    expect(staerksteSteigerung(vorher, [{ w: '180' }, { w: '185' }])).toBeNull();
    expect(staerksteSteigerung(null, [{ w: '200' }])).toBeNull();
  });

  it('liest Komma und Punkt als Dezimaltrennzeichen', () => {
    expect(gewichtAus('187,5')).toBe(187.5);
    expect(gewichtAus('187.5')).toBe(187.5);
    expect(gewichtAus('0')).toBeNull();
  });

  it('erklaert den Sprung mit einem sinnvollen Bereich in 2,5-kg-Schritten', () => {
    const text = steigerungsErklaerung(steigerungsWarnung(175, '200'));
    expect(text).toContain('+25 kg (+14 %)');
    expect(text).toContain('185–192,5 kg');
  });
});
