(() => {
  const nativePrint = window.print.bind(window);
  let printInProgress = false;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

  async function preloadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = async () => {
        try { if (img.decode) await img.decode(); } catch (_) {}
        resolve();
      };
      img.onerror = resolve;
      img.src = src;
    });
  }

  async function waitForPrintAreaImages(area) {
    const images = [...area.querySelectorAll('img')];
    await Promise.all(images.map(img => new Promise(resolve => {
      if (img.complete) {
        if (img.decode) img.decode().catch(() => {}).finally(resolve);
        else resolve();
        return;
      }
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    })));
  }

  async function preparePrint() {
    const area = document.getElementById('printArea');
    if (!area || !area.querySelector('.exact-print-sheet')) return;

    await preloadImage('./print-template.svg?v=20260915-pwa-10');
    await waitForPrintAreaImages(area);

    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch (_) {}

    const previousStyle = area.getAttribute('style');
    area.style.setProperty('display', 'block', 'important');
    area.style.setProperty('position', 'fixed', 'important');
    area.style.setProperty('left', '-200vw', 'important');
    area.style.setProperty('top', '0', 'important');
    area.style.setProperty('visibility', 'hidden', 'important');
    area.style.setProperty('width', '285.12mm', 'important');
    area.style.setProperty('height', '201.6mm', 'important');

    void area.offsetWidth;
    void area.offsetHeight;
    await nextFrame();
    await nextFrame();
    await wait(180);

    if (previousStyle === null) area.removeAttribute('style');
    else area.setAttribute('style', previousStyle);

    await nextFrame();
    await nextFrame();
    await wait(220);
  }

  window.print = function() {
    if (printInProgress) return;
    printInProgress = true;

    preparePrint()
      .catch(error => console.warn('Préparation impression :', error))
      .finally(async () => {
        await wait(120);
        try {
          nativePrint();
        } finally {
          printInProgress = false;
        }
      });
  };
})();
