// Ein einziger Scrollbereich fuer die installierte App. Auth-, Lade- und
// Recovery-Seiten behalten den normalen Fenster-Scroll; innerhalb der
// angemeldeten App scrollt ausschliesslich #view.
export function appScroller() {
  const view = document.getElementById('view');
  if (document.documentElement.classList.contains('app-shell') && view) return view;
  return document.scrollingElement || document.documentElement;
}

export function appScrollTop() {
  const scroller = appScroller();
  if (scroller.id === 'view') return scroller.scrollTop;
  return window.scrollY || scroller.scrollTop || 0;
}

export function appScrollTo(options) {
  const scroller = appScroller();
  if (scroller.id === 'view') {
    if (typeof scroller.scrollTo === 'function') scroller.scrollTo(options);
    else scroller.scrollTop = Number(options?.top) || 0;
    return;
  }
  window.scrollTo(options);
}

export function appScrollBy(options) {
  const scroller = appScroller();
  if (scroller.id === 'view') {
    if (typeof scroller.scrollBy === 'function') scroller.scrollBy(options);
    else scroller.scrollTop += Number(options?.top) || 0;
    return;
  }
  window.scrollBy(options);
}
