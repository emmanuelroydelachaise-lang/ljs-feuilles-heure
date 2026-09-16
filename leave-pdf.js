(() => {
  let leavePdfLibrariesPromise = null;

  function loadScriptOnce(src, marker, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let script = document.querySelector(`script[data-${marker}]`);
      if (script) {
        script.addEventListener('load', () => ready() ? resolve() : reject(new Error('Bibliothèque PDF indisponible.')), {once:true});
        script.addEventListener('error', () => reject(new Error('Impossible de charger la bibliothèque PDF.')), {once:true});
        return;
      }
      script = document.createElement('script');
      script.src = src;
      script.dataset[marker] = '1';
      script.onload = () => ready() ? resolve() : reject(new Error('Bibliothèque PDF indisponible.'));
      script.onerror = () => reject(new Error('Impossible de charger la bibliothèque PDF.'));
      document.head.appendChild(script);
    });
  }

  function ensureLeavePdfLibraries() {
    if (!leavePdfLibrariesPromise) {
      leavePdfLibrariesPromise = Promise.all([
        loadScriptOnce('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js','leaveHtml2canvas',() => typeof window.html2canvas === 'function'),
        loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js','leaveJspdf',() => Boolean(window.jspdf?.jsPDF))
      ]).catch(error => {
        leavePdfLibrariesPromise = null;
        throw error;
      });
    }
    return leavePdfLibrariesPromise;
  }

  const fmtDate = value => {
    if (!value) return '';
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('fr-FR');
  };

  function safeFilePart(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Technicien';
  }

  function checkbox(checked) {
    return `<span class="leave-pdf-checkbox${checked ? ' checked' : ''}">${checked ? '✓' : ''}</span>`;
  }

  function buildLeavePdfPage(request) {
    const approved = request.status === 'approved';
    const refused = request.status === 'refused';
    const decided = approved || refused;
    const fullName = [request.last_name, request.first_name].filter(Boolean).join(' ').trim();

    const page = document.createElement('div');
    page.className = 'leave-pdf-page';
    page.innerHTML = `
      <div class="leave-pdf-brand">
        <img src="./brand.png" alt="LJS Energies">
        <div class="leave-pdf-brand-name">LJS ENERGIES</div>
      </div>
      <div class="leave-pdf-title">DEMANDE DE CONGÉS OU D’ABSENCE</div>

      <div class="leave-pdf-line leave-pdf-person">
        <div><strong>NOM :</strong> <span>${esc(request.last_name || '')}</span></div>
        <div><strong>PRÉNOM :</strong> <span>${esc(request.first_name || '')}</span></div>
      </div>

      <div class="leave-pdf-main-grid">
        <div class="leave-pdf-left">
          <div class="leave-pdf-field"><strong>DU :</strong> <span>${esc(fmtDate(request.date_from))}</span></div>
          <div class="leave-pdf-field"><strong>AU :</strong> <span>${esc(fmtDate(request.date_to))}</span> <em>(Inclus)</em></div>
          <div class="leave-pdf-field leave-pdf-request-date"><strong>DATE DE VOTRE DEMANDE :</strong> <span>${esc(fmtDate(request.request_date))}</span></div>
          <div class="leave-pdf-copy-note">(Après acceptation une copie de votre demande vous sera remise)</div>
        </div>
        <div class="leave-pdf-right">
          <div class="leave-pdf-motif-title">MOTIF DE L’ABSENCE :</div>
          <div class="leave-pdf-choice">${checkbox(request.request_type === 'conge')} <span>CONGÉ</span></div>
          <div class="leave-pdf-choice">${checkbox(request.request_type === 'absence')} <span>ABSENCE</span></div>
        </div>
      </div>

      <div class="leave-pdf-accord-title">ACCORD DU RESPONSABLE</div>
      <div class="leave-pdf-decision-row">
        <div class="leave-pdf-decision ${approved ? 'selected' : ''}">OUI</div>
        <div class="leave-pdf-decision ${refused ? 'selected' : ''}">NON</div>
      </div>

      <div class="leave-pdf-field leave-pdf-decision-date"><strong>DATE ACCORD OU REFUS :</strong> <span class="leave-pdf-red">${decided ? esc(fmtDate(request.decision_date)) : ''}</span></div>
      <div class="leave-pdf-field leave-pdf-refusal"><strong>MOTIF DU REFUS :</strong> <span>${refused ? esc(request.refusal_reason || '') : ''}</span></div>

      <div class="leave-pdf-reminder">Il est rappelé que <u>tout départ en congés doit être pris une fois<br>ce bordereau visé.</u></div>

      <div class="leave-pdf-signatures">
        <div class="leave-pdf-signature-block">
          <div class="leave-pdf-signature-label">Signature de l’employé</div>
          ${request.employee_signature ? `<img src="${request.employee_signature}" alt="Signature de ${esc(fullName)}">` : ''}
        </div>
        <div class="leave-pdf-signature-block leave-pdf-responsible-signature-block">
          <div class="leave-pdf-signature-label">Signature du responsable<br>de secteur</div>
          ${request.responsible_signature ? `<img class="leave-pdf-red-signature" src="${request.responsible_signature}" alt="Signature responsable">` : ''}
          ${request.responsible_name ? `<div class="leave-pdf-responsible-name">${esc(request.responsible_name)}</div>` : ''}
        </div>
      </div>`;
    return page;
  }

  function ensureLeavePdfStyle() {
    if (document.getElementById('leavePdfStyle')) return;
    const style = document.createElement('style');
    style.id = 'leavePdfStyle';
    style.textContent = `
      .leave-pdf-stage{position:fixed;left:-12000px;top:0;width:210mm;height:297mm;background:#fff;z-index:-1;pointer-events:none}
      .leave-pdf-page{position:relative;width:210mm;height:297mm;box-sizing:border-box;padding:18mm 16mm 16mm;background:#fff;color:#111;font-family:Georgia,'Times New Roman',serif;font-size:11pt;overflow:hidden}
      .leave-pdf-brand{position:absolute;left:13mm;top:8mm;display:flex;align-items:center;gap:3mm;font-family:Arial,Helvetica,sans-serif}
      .leave-pdf-brand img{width:24mm;height:20mm;object-fit:contain}
      .leave-pdf-brand-name{font-size:11pt;font-weight:900;letter-spacing:.4px;color:#222;white-space:nowrap}
      .leave-pdf-title{margin:13mm 18mm 20mm 38mm;background:#879fb2;color:#fff;text-align:center;font-size:18pt;font-style:italic;font-weight:700;padding:6mm 5mm;border-radius:3mm;font-family:Arial,Helvetica,sans-serif}
      .leave-pdf-person{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-bottom:13mm;font-size:12pt}.leave-pdf-person span,.leave-pdf-field span{display:inline-block;border-bottom:.35mm solid #222;min-width:48mm;padding:0 2mm 1mm}
      .leave-pdf-main-grid{display:grid;grid-template-columns:1.45fr .75fr;gap:12mm;align-items:start}.leave-pdf-left{display:flex;flex-direction:column;gap:9mm}.leave-pdf-field{font-size:11.5pt;white-space:nowrap}.leave-pdf-field em{font-style:normal;margin-left:3mm}.leave-pdf-request-date span{min-width:42mm}.leave-pdf-copy-note{font-size:10.5pt;font-style:italic;margin-top:-3mm}.leave-pdf-right{padding-top:0}.leave-pdf-motif-title{font-weight:700;margin-bottom:6mm}.leave-pdf-choice{display:flex;align-items:center;gap:3mm;margin:6mm 0;font-weight:700}.leave-pdf-checkbox{display:inline-flex;width:7mm;height:7mm;border:.55mm solid #111;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;font-size:14pt;line-height:1}.leave-pdf-checkbox.checked{font-weight:900}
      .leave-pdf-accord-title{width:72mm;margin:20mm auto 6mm;text-align:center;border:1.2mm double #748b9b;padding:4mm 3mm;font-size:13pt;font-weight:700}.leave-pdf-decision-row{display:flex;justify-content:space-around;width:105mm;margin:0 auto 15mm;font-weight:700;font-size:12pt}.leave-pdf-decision.selected{color:#d40000;text-decoration:underline;text-decoration-thickness:.5mm;text-underline-offset:1.5mm}.leave-pdf-decision-date{margin-bottom:7mm}.leave-pdf-decision-date span{min-width:42mm}.leave-pdf-refusal span{min-width:105mm}.leave-pdf-red{color:#d40000!important;font-weight:800}
      .leave-pdf-reminder{text-align:center;font-weight:700;font-size:11.5pt;line-height:1.8;margin:15mm auto 13mm}.leave-pdf-signatures{display:grid;grid-template-columns:1fr 1fr;gap:24mm;align-items:start}.leave-pdf-signature-block{text-align:left;min-height:34mm}.leave-pdf-signature-label{font-size:11pt;margin-bottom:3mm}.leave-pdf-signature-block img{display:block;width:62mm;height:25mm;object-fit:contain;object-position:left center}.leave-pdf-responsible-signature-block{color:#d40000}.leave-pdf-red-signature{filter:none}.leave-pdf-responsible-name{font-size:9.5pt;font-weight:700;margin-top:1mm}
    `;
    document.head.appendChild(style);
  }

  async function waitForImages(root) {
    await Promise.all([...root.querySelectorAll('img')].map(img => new Promise(resolve => {
      const done = () => resolve();
      if (img.complete) return done();
      img.addEventListener('load', done, {once:true});
      img.addEventListener('error', done, {once:true});
      setTimeout(done, 4000);
    })));
  }

  async function downloadLeaveRequestPdf(request) {
    if (!request) throw new Error('Demande introuvable.');
    if (!['approved','refused'].includes(request.status)) throw new Error('Le PDF est disponible après décision du responsable.');

    await ensureLeavePdfLibraries();
    ensureLeavePdfStyle();

    const stage = document.createElement('div');
    stage.className = 'leave-pdf-stage';
    const page = buildLeavePdfPage(request);
    stage.appendChild(page);
    document.body.appendChild(stage);

    try {
      await waitForImages(page);
      try { if (document.fonts?.ready) await document.fonts.ready; } catch (_) {}
      const canvas = await window.html2canvas(page, {scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,imageTimeout:5000});
      const {jsPDF} = window.jspdf;
      const pdf = new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      pdf.addImage(canvas.toDataURL('image/jpeg',0.96),'JPEG',0,0,210,297,undefined,'FAST');
      const who = safeFilePart([request.last_name, request.first_name].filter(Boolean).join('_'));
      const date = String(request.date_from || '').replaceAll('-','');
      pdf.save(`Demande_absence_${who}_${date}.pdf`);
    } finally {
      stage.remove();
    }
  }

  window.downloadLeaveRequestPdf = downloadLeaveRequestPdf;
})();