// Menu déroulant aux couleurs du site.
// Le <select> d'origine reste dans la page (caché) : il garde la valeur, et tout le code
// existant (lecture de .value, écouteurs « change ») continue de fonctionner sans modification.
// Usage : <select class="gb-select"> … puis enhanceSelects() au chargement.

const CHEVRON = '<svg class="gb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const CHECK = '<svg class="gb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
let uid = 0;

export function enhanceSelect(sel) {
  if (!sel || sel.dataset.gbs) return;
  sel.dataset.gbs = '1';
  const id = 'gbs' + (++uid);
  const wrap = document.createElement('div');
  wrap.className = 'gbs ' + (sel.dataset.gbsClass || '');
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  sel.classList.add('gbs-native');
  sel.tabIndex = -1;
  sel.setAttribute('aria-hidden', 'true');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gbs-btn';
  btn.id = sel.id ? sel.id + '-btn' : id + '-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  const lbl = sel.getAttribute('aria-label') || sel.title;
  if (lbl) btn.setAttribute('aria-label', lbl);
  // Un <label for="…"> existant pointe désormais vers le bouton
  if (sel.id) document.querySelectorAll(`label[for="${CSS.escape(sel.id)}"]`).forEach(l => {
    l.htmlFor = btn.id; if (!l.id) l.id = btn.id + '-lbl';
    btn.setAttribute('aria-labelledby', l.id + ' ' + btn.id);
  });
  btn.innerHTML = '<span class="gbs-val"></span>' + CHEVRON;

  const list = document.createElement('ul');
  list.className = 'gbs-list';
  list.id = id + '-list';
  list.setAttribute('role', 'listbox');
  list.tabIndex = -1;
  list.hidden = true;
  btn.setAttribute('aria-controls', list.id);
  wrap.append(btn, list);

  let active = -1;
  const opts = () => [...list.children];

  function build() {
    list.innerHTML = [...sel.options].map((o, i) =>
      `<li role="option" id="${id}-o${i}" data-i="${i}" aria-selected="${o.selected}">${CHECK}<span></span></li>`).join('');
    opts().forEach((li, i) => { li.querySelector('span').textContent = sel.options[i].text; });
  }
  function paint() {
    const o = sel.options[sel.selectedIndex];
    btn.querySelector('.gbs-val').textContent = o ? o.text : '';
    opts().forEach((li, i) => li.setAttribute('aria-selected', String(i === sel.selectedIndex)));
  }
  function setActive(i) {
    const all = opts(); if (!all.length) return;
    active = Math.max(0, Math.min(all.length - 1, i));
    all.forEach((li, k) => li.classList.toggle('is-active', k === active));
    list.setAttribute('aria-activedescendant', all[active].id);
    all[active].scrollIntoView({ block: 'nearest' });
  }
  function open() {
    if (!list.hidden) return;
    build(); paint();
    list.hidden = false; wrap.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    setActive(sel.selectedIndex);
    list.focus({ preventScroll: true });
    // Toujours vers le bas : si la liste dépasse de l'écran, on fait défiler la page juste ce qu'il faut.
    // (Sauf en bas de page, où il n'y a plus rien à faire défiler : là seulement, elle s'ouvre vers le haut.)
    const lr = list.getBoundingClientRect();
    const overflow = lr.bottom - (window.innerHeight - 12);
    if (overflow > 0) {
      const room = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      if (room >= overflow) window.scrollBy({ top: overflow, behavior: 'smooth' });
      else wrap.classList.add('up');
    }
  }
  function close(focusBtn = true) {
    if (list.hidden) return;
    list.hidden = true; wrap.classList.remove('is-open', 'up');
    btn.setAttribute('aria-expanded', 'false');
    if (focusBtn) btn.focus();
  }
  function choose(i) {
    const changed = sel.selectedIndex !== i;
    sel.selectedIndex = i; paint(); close();
    if (changed) sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  btn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
  });
  list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) choose(+li.dataset.i); });
  list.addEventListener('mousemove', (e) => { const li = e.target.closest('li'); if (li && +li.dataset.i !== active) setActive(+li.dataset.i); });
  let typed = '', typedT;
  list.addEventListener('keydown', (e) => {
    const n = opts().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(n - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { close(false); }
    else if (e.key.length === 1) {
      clearTimeout(typedT); typed += e.key.toLowerCase(); typedT = setTimeout(() => { typed = ''; }, 600);
      const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const k = [...sel.options].findIndex(o => norm(o.text).startsWith(norm(typed)));
      if (k >= 0) setActive(k);
    }
  });
  document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target)) close(false); });

  // Une valeur posée par le code (sel.value = '10') met aussi le bouton à jour
  const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(sel, 'value', { get() { return proto.get.call(this); }, set(v) { proto.set.call(this, v); paint(); }, configurable: true });
  sel.addEventListener('change', paint);

  build(); paint();
}

export function enhanceSelects(root = document) {
  root.querySelectorAll('select.gb-select').forEach(enhanceSelect);
}
