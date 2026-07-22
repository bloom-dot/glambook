// GlamBook — Thème Sombre Luxe : bascule + apparitions organiques au scroll.
// Script classique (à inclure via <script defer src="/js/theme.js"></script>).
(function () {
  var KEY = 'gb-theme';
  var root = document.documentElement;

  function apply(t) { root.classList.toggle('theme-light', t === 'light'); }

  var theme;
  try { theme = localStorage.getItem(KEY) || 'dark'; } catch (e) { theme = 'dark'; }
  apply(theme); // sombre par défaut

  function mountToggle() {
    if (document.querySelector('.theme-toggle')) return;
    var b = document.createElement('button');
    b.className = 'theme-toggle';
    b.setAttribute('aria-label', 'Changer de thème');
    function refresh() {
      b.textContent = theme === 'light' ? '☀️' : '🌙';
      b.title = theme === 'light' ? 'Passer en thème sombre' : 'Passer en thème clair';
    }
    refresh();
    b.addEventListener('click', function () {
      theme = theme === 'light' ? 'dark' : 'light';
      apply(theme);
      try { localStorage.setItem(KEY, theme); } catch (e) {}
      refresh();
    });
    document.body.appendChild(b);
  }

  // Apparition progressive : ajoute .reveal (via JS = pas d'écran vide si JS échoue) puis .in au scroll
  function initReveal() {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    var els = document.querySelectorAll('.reveal, .artist-card, [data-reveal]');
    els.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (Math.min(i, 8) * 0.05) + 's';
      io.observe(el);
    });
  }

  function boot() { mountToggle(); initReveal(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
