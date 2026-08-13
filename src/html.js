export function escapeHtml(wert) {
  return String(wert ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function sichereBildUrl(wert) {
  if (!wert) return '';
  try {
    const url = new URL(String(wert), window.location.href);
    return ['http:', 'https:', 'data:', 'blob:'].includes(url.protocol) ? url.href : '';
  } catch (e) {
    return '';
  }
}
