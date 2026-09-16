(() => {
  let adminInstallTimer = null;

  function setBusy(button, busy) {
    if (!button) return;
    if (busy) {
      button.dataset.previousText = button.textContent;
      button.disabled = true;
      button.textContent = 'Création PDF…';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.previousText || 'PDF';
    }
  }

  async function technicianPdf(summary, button) {
    const previousSheet = state.sheet ? deepClone(state.sheet) : null;
    setBusy(button, true);
    try {
      await loadSheet(summary.week_start);
      const fullSheet = deepClone(state.sheet);
      await window.downloadTimesheetPdf(fullSheet, currentProfile.full_name);
    } catch (error) {
      alert('Impossible de créer le PDF : ' + (error.message || error));
    } finally {
      if (previousSheet) state.sheet = previousSheet;
      setBusy(button, false);
    }
  }

  async function installTechnicianArchivePdfButtons() {
    if (typeof window.getTechnicianApprovedSheets !== 'function') return;
    const rows = [...document.querySelectorAll('#technicianArchivesList .tech-archive-item')];
    if (!rows.length) return;

    let sheets = [];
    try { sheets = await window.getTechnicianApprovedSheets(); }
    catch (_) { return; }

    rows.forEach((row, index) => {
      if (row.querySelector('.tech-archive-pdf')) return;
      const summary = sheets[index];
      if (!summary) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary tech-archive-pdf';
      button.textContent = 'PDF';
      button.onclick = () => technicianPdf(summary, button);
      row.appendChild(button);
    });
  }

  async function getAdminArchiveSheetsForPdf() {
    if (!isCloud) {
      const db = demoDb();
      return (db.sheets || []).map(s => {
        const t = (db.technicians || []).find(x => x.id === s.technician_id);
        return { ...s, technician_name:t?.full_name || s.technician_id || 'Technicien' };
      });
    }
    const { data, error } = await sb.from('ljs_timesheets_admin').select('*');
    if (error) throw error;
    return data || [];
  }

  async function adminPdf(sheet, technicianName, button) {
    setBusy(button, true);
    try {
      const full = await loadAdminSheet(sheet.id, technicianName);
      await window.downloadTimesheetPdf(full, technicianName);
    } catch (error) {
      alert('Impossible de créer le PDF : ' + (error.message || error));
    } finally {
      setBusy(button, false);
    }
  }

  async function installAdminArchivePdfButtons() {
    const groups = [...document.querySelectorAll('#adminArchives .archive-tech-group')];
    if (!groups.length) return;

    let sheets = [];
    try { sheets = await getAdminArchiveSheetsForPdf(); }
    catch (_) { return; }

    sheets.sort((a, b) => {
      const na = String(a.technician_name || '').localeCompare(String(b.technician_name || ''), 'fr');
      if (na !== 0) return na;
      return String(b.week_start || '').localeCompare(String(a.week_start || ''));
    });

    const byName = new Map();
    sheets.forEach(sheet => {
      const name = sheet.technician_name || 'Technicien';
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(sheet);
    });

    groups.forEach(group => {
      const name = group.querySelector('.archive-tech-toggle strong')?.textContent?.trim() || 'Technicien';
      const groupSheets = byName.get(name) || [];
      const rows = [...group.querySelectorAll('.archive-sheet-row')];
      rows.forEach((row, index) => {
        const sheet = groupSheets[index];
        const button = row.querySelector('.archive-print');
        if (!button || !sheet) return;
        button.textContent = 'PDF';
        button.title = 'Télécharger la feuille au format PDF';
        button.onclick = () => adminPdf(sheet, name, button);
        button.dataset.pdfReady = '1';
      });
    });
  }

  function scheduleAdminInstall() {
    clearTimeout(adminInstallTimer);
    adminInstallTimer = setTimeout(() => installAdminArchivePdfButtons(), 80);
  }

  function installObservers() {
    const app = document.getElementById('app');
    if (!app) return;
    const observer = new MutationObserver(mutations => {
      const relevant = mutations.some(m => [...m.addedNodes].some(node => node.nodeType === 1 && (
        node.matches?.('#technicianArchivesList, #adminArchives, .tech-archive-item, .archive-tech-group, .archive-sheet-row') ||
        node.querySelector?.('#technicianArchivesList, #adminArchives, .tech-archive-item, .archive-tech-group, .archive-sheet-row')
      )));
      if (!relevant) return;
      setTimeout(() => installTechnicianArchivePdfButtons(), 50);
      scheduleAdminInstall();
    });
    observer.observe(app, { childList:true, subtree:true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    installObservers();
    setTimeout(() => installTechnicianArchivePdfButtons(), 300);
    scheduleAdminInstall();
  });
})();