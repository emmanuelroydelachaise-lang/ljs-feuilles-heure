(() => {
  const VERSION = '20260915-clean-1';
  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function freshenAssets() {
    document.querySelectorAll('img[src*="logo-ljs-v2.png"]').forEach(img => {
      img.src = `./logo-ljs-v2.png?v=${VERSION}`;
    });
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.href = `./manifest.webmanifest?v=${VERSION}`;
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = `./icon-192-v2.png?v=${VERSION}`;
    const touch = document.querySelector('link[rel="apple-touch-icon"]');
    if (touch) touch.href = `./icon-192-v2.png?v=${VERSION}`;
    const printCss = document.querySelector('link[href*="print-vector.css"]');
    if (printCss) printCss.href = `./print-vector.css?v=${VERSION}`;
  }

  freshenAssets();

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    const btn = document.getElementById('installBtn');
    if (btn && !isStandalone()) {
      btn.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Installer l’application';
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const btn = document.getElementById('installBtn');
    if (btn) btn.classList.add('hidden');
  });

  document.addEventListener('DOMContentLoaded', async () => {
    freshenAssets();

    let btn = document.getElementById('installBtn');
    if (btn) {
      const cleanBtn = btn.cloneNode(true);
      btn.replaceWith(cleanBtn);
      btn = cleanBtn;
      if (isStandalone()) {
        btn.classList.add('hidden');
      } else {
        btn.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Installer l’application';
        btn.addEventListener('click', async () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            return;
          }
          try {
            if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
            await new Promise(resolve => setTimeout(resolve, 700));
            if (deferredPrompt) {
              deferredPrompt.prompt();
              await deferredPrompt.userChoice;
              deferredPrompt = null;
              return;
            }
          } catch (_) {}
          alert('Chrome ne propose pas encore la fenêtre automatique. Ouvre le menu ⋮ puis choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».');
        });
      }
    }

    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.filter(name => name.startsWith('ljs-')).map(name => caches.delete(name)));
        }
        await navigator.serviceWorker.register(`./sw.js?v=${VERSION}`, { scope: './', updateViaCache: 'none' });
      } catch (error) {
        console.error('PWA registration error', error);
      }
    }
  });
})();
