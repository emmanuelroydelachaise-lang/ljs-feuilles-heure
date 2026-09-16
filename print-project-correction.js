(() => {
  const VERSION = '20260916-project-print-fix-1';

  const changed = (sheet, path) => Array.isArray(sheet?.admin_changes) && sheet.admin_changes.includes(path);

  function escPrint(value='') {
    return typeof esc === 'function'
      ? esc(value)
      : String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function projectKey(entry) {
    if (!entry) return '';
    if (entry.project_id === OTHER_PROJECT_ID || !entry.project_id) {
      const code = String(entry.manual_project_code || '').trim().toLowerCase();
      const name = String(entry.manual_project_name || '').trim().toLowerCase();
      return `other:${code}|${name}`;
    }
    return `project:${entry.project_id}`;
  }

  function projectParts(entry) {
    if (!entry) return { code:'', name:'—', text:'—' };
    if (entry.project_id === OTHER_PROJECT_ID || !entry.project_id) {
      const code = String(entry.manual_project_code || '').trim();
      const name = String(entry.manual_project_name || '').trim() || 'Chantier autre';
      return { code, name, text:code ? `${code} — ${name}` : name };
    }
    const p = projectById(entry.project_id);
    if (p) return { code:String(p.code || ''), name:String(p.name || ''), text:`${p.code} — ${p.name}` };
    return { code:'', name:'Chantier historique', text:'Chantier historique' };
  }

  function originalDay(sheet, di) {
    const days = sheet?.technician_original?.days;
    if (!Array.isArray(days)) return null;
    const currentDay = sheet?.days?.[di];
    return (currentDay?.date && days.find(d => d?.date === currentDay.date)) || days[di] || null;
  }

  function projectWasChanged(sheet, di, ei) {
    const prefix = `days.${di}.entries.${ei}`;
    return changed(sheet, `${prefix}.project_id`) ||
      changed(sheet, `${prefix}.manual_project_code`) ||
      changed(sheet, `${prefix}.manual_project_name`);
  }

  function installStyle() {
    if (document.getElementById('printProjectCorrectionStyle')) return;
    const style = document.createElement('style');
    style.id = 'printProjectCorrectionStyle';
    style.textContent = `
      @media print{
        .p-project-vertical.rch-project-header-corrected{overflow:visible!important;color:#000!important}
        .p-project-vertical .rch-project-header-pair{display:flex!important;align-items:center!important;justify-content:center!important;gap:.8mm!important;white-space:nowrap!important;transform:rotate(-90deg)!important;transform-origin:center center!important;max-width:none!important;line-height:1!important}
        .p-project-name .rch-project-header-pair{font-size:4.4pt!important}
        .p-project-code .rch-project-header-pair{font-size:5.2pt!important}
        .p-project-vertical .rch-project-header-pair span{display:inline!important;transform:none!important;max-width:none!important;white-space:nowrap!important}
        .rch-project-header-old{color:#555!important;text-decoration:line-through!important;text-decoration-thickness:.35mm!important;font-weight:700!important}
        .rch-project-header-new{color:#d40000!important;font-weight:900!important}
        .rch-project-header-arrow{color:#777!important;font-weight:700!important}
      }
    `;
    document.head.appendChild(style);
  }

  function pairHtml(oldValue, newValue) {
    return `<div class="rch-project-header-pair"><span class="rch-project-header-old">${escPrint(oldValue || '—')}</span><span class="rch-project-header-arrow">→</span><span class="rch-project-header-new">${escPrint(newValue || '—')}</span></div>`;
  }

  function removeProjectNotesFromComments(root) {
    const comments = root.querySelector('.p-comments');
    if (!comments) return;
    comments.querySelectorAll('.rch-project-print-fix').forEach(el => el.remove());
    comments.querySelectorAll('.rch-print-note').forEach(el => {
      if (/^\s*Chantier\s*:/i.test(el.textContent || '')) el.remove();
    });
  }

  function moveProjectCorrectionsToHeaders(sheet) {
    const root = document.querySelector('#printArea .exact-print-sheet');
    if (!root || !sheet?.technician_original) return;

    const current = normalizeSheet(
      typeof deepClone === 'function' ? deepClone(sheet) : JSON.parse(JSON.stringify(sheet)),
      sheet.week_start
    );

    removeProjectNotesFromComments(root);

    const changesByNewKey = new Map();
    (current.days || []).forEach((newDay, di) => {
      const oldDay = originalDay(current, di);
      if (!oldDay) return;
      (newDay.entries || []).forEach((newEntry, ei) => {
        if (!projectWasChanged(current, di, ei)) return;
        const oldEntry = oldDay.entries?.[ei];
        if (!oldEntry) return;
        const oldParts = projectParts(oldEntry);
        const newParts = projectParts(newEntry);
        if (oldParts.text === newParts.text) return;
        const key = projectKey(newEntry);
        if (key && !changesByNewKey.has(key)) changesByNewKey.set(key, { oldParts, newParts });
      });
    });

    if (!changesByNewKey.size) return;

    const projects = getPrintProjects(current);
    const codeCells = [...root.querySelectorAll('.p-project-code')];
    const nameCells = [...root.querySelectorAll('.p-project-name')];

    projects.forEach((project, index) => {
      const change = changesByNewKey.get(project.key);
      if (!change) return;

      const codeCell = codeCells[index];
      const nameCell = nameCells[index];
      if (codeCell) {
        codeCell.classList.add('rch-project-header-corrected');
        if (change.oldParts.code && change.oldParts.code !== change.newParts.code) {
          codeCell.innerHTML = pairHtml(change.oldParts.code, change.newParts.code);
        } else {
          codeCell.innerHTML = `<div class="rch-project-header-pair"><span class="rch-project-header-new">${escPrint(change.newParts.code || project.code || '')}</span></div>`;
        }
      }
      if (nameCell) {
        nameCell.classList.add('rch-project-header-corrected');
        nameCell.innerHTML = pairHtml(change.oldParts.name, change.newParts.name);
      }
    });
  }

  function afterOtherPrintDecorators(sheet) {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      moveProjectCorrectionsToHeaders(sheet);
    })));
  }

  function wrapPrint() {
    const currentPrint = window.printTimesheet;
    if (typeof currentPrint !== 'function' || currentPrint.__ljsProjectPrintCorrection) return;
    const wrapped = function(sheet, technicianName) {
      const result = currentPrint.apply(this, arguments);
      afterOtherPrintDecorators(sheet);
      return result;
    };
    wrapped.__ljsProjectPrintCorrection = true;
    window.printTimesheet = wrapped;
  }

  installStyle();
  wrapPrint();
  setTimeout(wrapPrint, 0);
  setTimeout(wrapPrint, 400);
  window.LJS_PROJECT_PRINT_CORRECTION = VERSION;
})();
