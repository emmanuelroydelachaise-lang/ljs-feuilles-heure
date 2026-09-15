(() => {
  const baseRefreshAdmin = window.refreshAdmin;
  if (typeof baseRefreshAdmin !== 'function') return;

  function archiveStatusLabel(status) {
    if (status === 'approved') return 'Validée responsable';
    if (status === 'submitted') return 'À valider';
    return 'En cours';
  }

  function formatArchiveDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR');
    } catch (_) {
      return dateStr;
    }
  }

  function technicianByArchiveId(id, name) {
    return (state.technicians || []).find(t => t.id === id) ||
      (state.technicians || []).find(t => t.full_name === name) || null;
  }

  function ensureArchiveCard() {
    let card = document.getElementById('adminArchivesCard');
    if (card) return card;

    const projectsBox = document.getElementById('adminProjects');
    const projectsCard = projectsBox?.closest('.card');
    if (!projectsCard) return null;

    card = document.createElement('section');
    card.id = 'adminArchivesCard';
    card.className = 'card';
    card.innerHTML = `
      <div class="archive-title-row">
        <div>
          <h2>Archives des feuilles d’heures</h2>
          <p class="hint">Toutes les anciennes feuilles sont conservées ici, classées par technicien, y compris après suppression d’un technicien.</p>
        </div>
        <button id="refreshArchivesBtn" class="secondary">Actualiser</button>
      </div>
      <div id="adminArchives" class="archive-tech-list"></div>`;
    projectsCard.insertAdjacentElement('afterend', card);
    card.querySelector('#refreshArchivesBtn').onclick = renderAdminArchives;
    return card;
  }

  async function deleteTechnician(t) {
    if (!confirm(`Supprimer ${t.full_name} de la liste des techniciens ?\n\nSes anciennes feuilles d’heures seront conservées dans les archives.`)) return;
    try {
      if (!isCloud) {
        const db = demoDb();
        const row = db.technicians.find(x => x.id === t.id);
        if (row) row.active = false;
        saveDemoDb(db);
      } else {
        const { data, error } = await sb.functions.invoke('manage-technician', {
          body: { action: 'set_active', technician_id: t.id, active: false }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
      await refreshAdmin();
    } catch (e) {
      alert('Impossible de supprimer le technicien : ' + (e.message || e));
    }
  }

  function applyTechnicianDeleteUi() {
    const technicians = [...(state.technicians || [])];

    const techCard = document.getElementById('adminTechnicians')?.closest('.card');
    const hint = techCard?.querySelector('p.hint');
    if (hint) hint.textContent = 'Ajoute, modifie ou supprime un technicien. La suppression le retire des listes actives mais conserve toutes ses anciennes feuilles dans les archives.';

    const techRows = [...document.querySelectorAll('#adminTechnicians .tech-admin-item')];
    techRows.forEach((row, index) => {
      const t = technicians[index];
      if (!t) return;
      if (t.active === false) {
        row.remove();
        return;
      }
      const btn = row.querySelector('.toggle-tech');
      if (btn) {
        btn.textContent = 'Supprimer';
        btn.classList.add('delete-tech');
        btn.onclick = () => deleteTechnician(t);
      }
      const meta = row.querySelector('.meta');
      if (meta && meta.textContent.startsWith('Actif')) meta.textContent = meta.textContent.replace(/^Actif/, 'Actif');
    });

    const sheetRows = [...document.querySelectorAll('#adminTimesheets .admin-sheet-row')];
    sheetRows.forEach((row, index) => {
      const t = technicians[index];
      if (t?.active === false) row.remove();
    });
  }

  async function getArchiveSheets() {
    if (!isCloud) {
      const db = demoDb();
      return (db.sheets || []).map(s => {
        const t = (db.technicians || []).find(x => x.id === s.technician_id);
        let total = 0;
        try { total = totalWeek(normalizeSheet(deepClone(s), s.week_start)); } catch (_) {}
        return {
          ...s,
          technician_name: t?.full_name || s.technician_id || 'Technicien',
          technician_employment_type: t?.employment_type || 'employee',
          total
        };
      });
    }

    const { data, error } = await sb.from('ljs_timesheets_admin').select('*');
    if (error) throw error;
    return data || [];
  }

  async function renderAdminArchives() {
    const card = ensureArchiveCard();
    const box = card?.querySelector('#adminArchives');
    if (!box) return;
    box.innerHTML = '<p class="hint">Chargement des archives…</p>';

    try {
      const sheets = await getArchiveSheets();
      sheets.sort((a, b) => {
        const na = String(a.technician_name || '').localeCompare(String(b.technician_name || ''), 'fr');
        if (na !== 0) return na;
        return String(b.week_start || '').localeCompare(String(a.week_start || ''));
      });

      const groups = new Map();
      sheets.forEach(s => {
        const key = s.technician_id || `name:${s.technician_name || 'Technicien'}`;
        if (!groups.has(key)) groups.set(key, { name: s.technician_name || 'Technicien', id: s.technician_id || '', sheets: [] });
        groups.get(key).sheets.push(s);
      });

      box.innerHTML = '';
      if (!groups.size) {
        box.innerHTML = '<p class="hint">Aucune feuille d’heures archivée pour le moment.</p>';
        return;
      }

      [...groups.values()].forEach(group => {
        const profile = technicianByArchiveId(group.id, group.name);
        const wrapper = document.createElement('div');
        wrapper.className = 'archive-tech-group';
        wrapper.innerHTML = `
          <button class="archive-tech-toggle" type="button">
            <span><strong>${esc(group.name)}</strong>${profile?.active === false ? '<span class="archive-deleted-badge">Supprimé</span>' : ''}</span>
            <span>${group.sheets.length} feuille${group.sheets.length > 1 ? 's' : ''} ▾</span>
          </button>
          <div class="archive-sheet-list hidden"></div>`;

        const list = wrapper.querySelector('.archive-sheet-list');
        group.sheets.forEach(s => {
          const row = document.createElement('div');
          row.className = 'archive-sheet-row';
          const total = Number(s.total || 0);
          row.innerHTML = `
            <div class="archive-sheet-info">
              <strong>Semaine ${weekNumber(s.week_start)}</strong>
              <span class="meta">à partir du ${formatArchiveDate(s.week_start)} · ${fmtHours(total)} · ${archiveStatusLabel(s.status)}</span>
            </div>
            <div class="admin-row-actions">
              <button class="secondary archive-open">Ouvrir / modifier</button>
              <button class="secondary archive-print">Imprimer</button>
            </div>`;

          row.querySelector('.archive-open').onclick = () => openAdminSheet(s.id, group.name);
          row.querySelector('.archive-print').onclick = async () => {
            try {
              const full = await loadAdminSheet(s.id, group.name);
              printTimesheet(full, group.name);
            } catch (e) {
              alert('Impossible d’ouvrir cette feuille : ' + (e.message || e));
            }
          };
          list.appendChild(row);
        });

        wrapper.querySelector('.archive-tech-toggle').onclick = () => list.classList.toggle('hidden');
        box.appendChild(wrapper);
      });
    } catch (e) {
      console.error(e);
      box.innerHTML = `<p class="error">Impossible de charger les archives : ${esc(e.message || e)}</p>`;
    }
  }

  window.renderAdminArchives = renderAdminArchives;
  window.refreshAdmin = async function() {
    await baseRefreshAdmin();
    applyTechnicianDeleteUi();
    ensureArchiveCard();
    await renderAdminArchives();
  };
})();
