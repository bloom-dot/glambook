// GlamBook — apparitions organiques au scroll.
// Script classique (a inclure via <script defer src="/js/theme.js"></script>).
// Le theme est uniquement sombre : la bascule clair/sombre a ete retiree.
(function () {

  // Apparition progressive : ajoute .reveal (via JS = pas d'ecran vide si JS echoue) puis .in au scroll
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
    // Filet de securite : rien ne doit rester masque (ex. si l'utilisateur ne defile pas)
    setTimeout(function () { els.forEach(function (el) { el.classList.add('in'); }); }, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initReveal);
  else initReveal();
})();
