// Bannière d'installation PWA
(function () {
  const DISMISSED_KEY = 'glambook_pwa_dismissed';

  // Ne pas afficher si déjà installé ou déjà rejeté
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true ||
    sessionStorage.getItem(DISMISSED_KEY)
  ) return;

  let deferredPrompt = null;

  const banner = document.createElement('div');
  banner.id = 'pwa-banner';
  banner.innerHTML = `
    <div id="pwa-banner-inner">
      <img src="/icons/icon-192.png" alt="GlamBook" id="pwa-banner-icon"/>
      <div id="pwa-banner-text">
        <strong>Installer GlamBook</strong>
        <span>Accédez à l'app depuis votre écran d'accueil</span>
      </div>
      <button id="pwa-btn-install">Installer</button>
      <button id="pwa-btn-close" aria-label="Fermer">✕</button>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #pwa-banner {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 9999;
      padding: 12px 16px 16px;
      background: #fff;
      box-shadow: 0 -4px 24px rgba(0,0,0,.15);
      border-radius: 20px 20px 0 0;
      transform: translateY(110%);
      transition: transform .35s cubic-bezier(.34,1.56,.64,1);
    }
    #pwa-banner.show { transform: translateY(0); }
    #pwa-banner-inner {
      display: flex; align-items: center; gap: 12px;
      max-width: 500px; margin: 0 auto;
    }
    #pwa-banner-icon {
      width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
    }
    #pwa-banner-text {
      flex: 1; display: flex; flex-direction: column;
    }
    #pwa-banner-text strong {
      font-size: .95rem; font-weight: 800; color: #1A0A12;
    }
    #pwa-banner-text span {
      font-size: .78rem; color: #888; margin-top: 2px;
    }
    #pwa-btn-install {
      background: #E8547A; color: #fff;
      border: none; border-radius: 10px;
      padding: 9px 18px; font-size: .85rem; font-weight: 700;
      cursor: pointer; flex-shrink: 0; white-space: nowrap;
    }
    #pwa-btn-install:hover { background: #d43d65; }
    #pwa-btn-close {
      background: none; border: none;
      font-size: 1rem; color: #aaa; cursor: pointer;
      padding: 4px 6px; flex-shrink: 0;
    }
    /* Message iOS (Safari) */
    #pwa-ios-hint {
      text-align: center; font-size: .8rem; color: #555;
      padding: 4px 0 0;
    }
  `;
  document.head.appendChild(style);

  function showBanner() {
    document.body.appendChild(banner);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => banner.classList.add('show'));
    });
  }

  function hideBanner() {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 400);
    sessionStorage.setItem(DISMISSED_KEY, '1');
  }

  document.addEventListener('click', e => {
    if (e.target.id === 'pwa-btn-close') hideBanner();

    if (e.target.id === 'pwa-btn-install') {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(choice => {
          deferredPrompt = null;
          hideBanner();
        });
      }
    }
  });

  // Android / Chrome — événement natif
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(showBanner, 3000); // apparaît après 3s
  });

  // iOS Safari — pas d'événement natif, on détecte manuellement
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
  if (isIOS && isSafari && !navigator.standalone) {
    setTimeout(() => {
      banner.querySelector('#pwa-banner-text span').textContent =
        'Appuyez sur Partager puis "Sur l\'écran d\'accueil"';
      document.getElementById('pwa-btn-install') &&
        (banner.querySelector('#pwa-btn-install').style.display = 'none');
      showBanner();
    }, 3000);
  }
})();
