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
      const summary = sheets[index];
      if (!summary) return;

      row.querySelectorAll('button').forEach(button => {
        if (!button.classList.contains('tech-archive-pdf')) button.remove();
      });

      let button = row.querySelector('.tech-archive-pdf');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary tech-archive-pdf';
        row.appendChild(button);
      }
      button.textContent = 'PDF';
      button.title = 'Télécharger la feuille au format PDF';
      button.onclick = () => technicianPdf(summary, button);
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

  async function verifyResponsiblePinForArchiveDelete() {
    const pin = prompt('Code responsable requis pour supprimer définitivement cette feuille :');
    if (pin === null) return false;
    if (!/^\d{4}$/.test(pin.trim())) {
      alert('Le code responsable doit contenir 4 chiffres.');
      return false;
    }
    if (typeof window.verifyResponsiblePinEntry !== 'function') {
      alert('La vérification du code responsable n’est pas disponible. Reconnecte-toi à l’accès responsable puis réessaie.');
      return false;
    }
    const ok = await window.verifyResponsiblePinEntry(pin.trim());
    if (!ok) alert('Code responsable incorrect.');
    return ok;
  }

  async function deleteAdminArchiveSheet(sheet, technicianName, button) {
    if (!(await verifyResponsiblePinForArchiveDelete())) return;
    const label = `Semaine ${weekNumber(sheet.week_start)} — ${technicianName}`;
    if (!confirm(`Supprimer définitivement la feuille ${label} ?\n\nCette action est irréversible.`)) return;

    button.disabled = true;
    button.textContent = 'Suppression…';
    try {
      if (!isCloud) {
        const db = demoDb();
        const idx = (db.sheets || []).findIndex(x => x.id === sheet.id);
        if (idx < 0) throw new Error('Feuille introuvable.');
        db.sheets.splice(idx, 1);
        saveDemoDb(db);
      } else {
        const workDelete = await sb.from('ljs_work_entries').delete().eq('timesheet_id', sheet.id);
        if (workDelete.error) throw workDelete.error;
        const dayDelete = await sb.from('ljs_day_entries').delete().eq('timesheet_id', sheet.id);
        if (dayDelete.error) throw dayDelete.error;
        const sheetDelete = await sb.from('ljs_timesheets').delete().eq('id', sheet.id);
        if (sheetDelete.error) throw sheetDelete.error;
      }

      if (state.adminSheet?.id === sheet.id) {
        state.adminSheet = null;
        document.getElementById('adminEditor')?.classList.add('hidden');
      }

      await refreshAdmin();
      alert(`La feuille ${label} a été supprimée.`);
    } catch (error) {
      console.error(error);
      alert('Impossible de supprimer cette feuille : ' + (error.message || error));
      button.disabled = false;
      button.textContent = 'Supprimer';
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
        if (!sheet) return;

        const actions = row.querySelector('.admin-row-actions');
        if (!actions) return;
        actions.innerHTML = '';

        const pdfButton = document.createElement('button');
        pdfButton.type = 'button';
        pdfButton.className = 'secondary archive-pdf-only';
        pdfButton.textContent = 'PDF';
        pdfButton.title = 'Télécharger la feuille au format PDF';
        pdfButton.onclick = () => adminPdf(sheet, name, pdfButton);
        actions.appendChild(pdfButton);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'secondary archive-delete-only';
        deleteButton.textContent = 'Supprimer';
        deleteButton.title = 'Supprimer définitivement cette feuille';
        deleteButton.style.borderColor = '#d92d20';
        deleteButton.style.color = '#b42318';
        deleteButton.style.background = '#fff4f2';
        deleteButton.onclick = () => deleteAdminArchiveSheet(sheet, name, deleteButton);
        actions.appendChild(deleteButton);
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