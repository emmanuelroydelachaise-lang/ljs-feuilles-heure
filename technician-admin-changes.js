(() => {
  const baseRenderWeek = window.renderWeek;
  if (typeof baseRenderWeek !== 'function') return;

  const visibleChange = path => path && path !== 'responsible_signature';
  const changed = (sheet, path) => (sheet?.admin_changes || []).includes(path);
  const changedPrefix = (sheet, prefix) => (sheet?.admin_changes || []).some(p => p === prefix || p.startsWith(prefix + '.'));

  function mark(el) {
    if (!el) return;
    el.classList.add('tech-admin-changed');
    const label = el.querySelector?.('label');
    if (label) label.classList.add('tech-admin-changed-label');
  }

  function addNotice(sheet) {
    document.getElementById('techAdminChangesNotice')?.remove();
    if (sheet?.status !== 'approved') return;
    if (!(sheet.admin_changes || []).some(visibleChange)) return;

    const badge = document.getElementById('statusBadge');
    const host = badge?.closest('.card') || document.getElementById('app');
    if (!host) return;

    const note = document.createElement('div');
    note.id = 'techAdminChangesNotice';
    note.className = 'tech-admin-change-notice';
    note.innerHTML = '<strong>Corrections du responsable</strong><span>Les éléments modifiés sont affichés en rouge.</span>';
    if (badge?.parentElement) badge.parentElement.insertAdjacentElement('afterend', note);
    else host.prepend(note);
  }

  function decorateTechnicianCorrections() {
    const sheet = state?.sheet;
    if (!sheet || sheet.status !== 'approved') return;

    document.querySelectorAll('.tech-admin-changed').forEach(el => el.classList.remove('tech-admin-changed'));
    document.querySelectorAll('.tech-admin-changed-label').forEach(el => el.classList.remove('tech-admin-changed-label'));

    if (changed(sheet, 'vehicle_id')) mark(document.getElementById('vehicleSelect')?.closest('div'));
    if (changed(sheet, 'general_comment')) mark(document.getElementById('weekComment')?.closest('div'));

    const dayCards = [...document.querySelectorAll('#days .day-card')];
    dayCards.forEach((card, di) => {
      const dayPrefix = `days.${di}`;
      if (changed(sheet, `${dayPrefix}.absent`)) mark(card.querySelector('.absence-line'));
      if (changed(sheet, `${dayPrefix}.zone`)) mark(card.querySelector('.zone')?.closest('div'));

      const entries = [...card.querySelectorAll('.work-list .work-row')];
      entries.forEach((row, ei) => {
        const entryPrefix = `${dayPrefix}.entries.${ei}`;
        const wholeEntriesChanged = changed(sheet, `${dayPrefix}.entries`);

        if (wholeEntriesChanged || changed(sheet, `${entryPrefix}.project_id`)) {
          mark(row.querySelector('.project')?.closest('div'));
        }
        if (wholeEntriesChanged || changed(sheet, `${entryPrefix}.hours`)) {
          mark(row.querySelector('.hours')?.closest('div'));
        }
        if (wholeEntriesChanged || changed(sheet, `${entryPrefix}.manual_project_code`)) {
          mark(row.querySelector('.manual-code')?.closest('div'));
        }
        if (wholeEntriesChanged || changed(sheet, `${entryPrefix}.manual_project_name`)) {
          mark(row.querySelector('.manual-name')?.closest('div'));
        }
      });

      if (changedPrefix(sheet, `${dayPrefix}.entries`)) {
        const total = card.querySelector('.day-total');
        if (total) total.classList.add('tech-admin-changed');
      }
    });

    addNotice(sheet);
  }

  window.renderWeek = function() {
    const result = baseRenderWeek.apply(this, arguments);
    requestAnimationFrame(() => requestAnimationFrame(decorateTechnicianCorrections));
    return result;
  };

  if (state?.sheet) requestAnimationFrame(() => requestAnimationFrame(decorateTechnicianCorrections));
})();
