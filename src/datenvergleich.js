// Vergleich für reine JSON-Daten wie das Trainings-Payload.
//
// JSON.stringify eignet sich dafür nicht: Zwei Objekte mit denselben Werten,
// aber anderer Schlüsselreihenfolge ergeben verschiedene Zeichenketten. Genau
// das passiert zwischen localStorage und Supabase und löste unnötige komplette
// Neuzeichnungen des Logs aus.
export function strukturellGleich(a, b) {
  if (Object.is(a, b)) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;

  const aArray = Array.isArray(a);
  if (aArray !== Array.isArray(b)) return false;
  if (aArray) {
    if (a.length !== b.length) return false;
    return a.every((wert, index) => strukturellGleich(wert, b[index]));
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(b, key) && strukturellGleich(a[key], b[key]));
}
