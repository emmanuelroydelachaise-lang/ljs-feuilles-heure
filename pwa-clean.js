(() => {
  const VERSION = '20260915-pwa-5';
  const CLEAN_KEY = 'ljs_pwa_clean_version';
  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function setFreshAssetUrls() {
    document.querySelectorAll('.header-logo, .login-brand img').forEach(img => {
      img.src = `./brand.png?v=${VERSION}`;
    });
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.href = `./manifest.webmanifest?v=${VERSION}`;
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = `./icon-192-v2.png?v=${VERSION}`;
    const touch = document.querySelector('link[rel="apple-touch-icon"]');
    if (touch) touch.href = `./icon-192-v2.png?v=${VERSION}`;
  }

  function installButton() { return document.getElementById('installBtn'); }

  function showInstallButton() {
    const btn = installButton();
    if (!btn || isStandalone()) return;
    btn.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Installer l’application';
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const btn = installButton();
    if (btn) btn.classList.add('hidden');
  });

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const alreadyCleaned = localStorage.getItem(CLEAN_KEY) === VERSION;
      if (!alreadyCleaned) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.filter(name => name.startsWith('ljs-')).map(name => caches.delete(name)));
        }
        localStorage.setItem(CLEAN_KEY, VERSION);
      }
      const reg = await navigator.serviceWorker.register(`./sw.js?v=${VERSION}`, {
        scope: './',
        updateViaCache: 'none'
      });
      await reg.update();
      await navigator.serviceWorker.ready;
    } catch (error) {
      console.error('PWA registration error', error);
    }
  }

  async function requestInstall() {
    if (isStandalone()) return;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      return;
    }
    await registerServiceWorker();
    alert('L’application est prête à être installée. Dans Chrome, ouvre le menu ⋮ puis choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    setFreshAssetUrls();
    let btn = installButton();
    if (btn) {
      const cleanBtn = btn.cloneNode(true);
      btn.replaceWith(cleanBtn);
      btn = cleanBtn;
      if (isStandalone()) btn.classList.add('hidden');
      else {
        showInstallButton();
        btn.addEventListener('click', requestInstall);
      }
    }
    await registerServiceWorker();
    setFreshAssetUrls();
  });
})();
