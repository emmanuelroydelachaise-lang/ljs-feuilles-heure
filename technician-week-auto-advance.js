(() => {
  const CHECK_INTERVAL_MS = 5000;
  let timer = null;
  let checking = false;
  let moving = false;
  let observedSheetId = null;
  let observedStatus = null;

  function nextWeekStart(weekStart) {
    const date = new Date(`${weekStart}T12:00:00`);
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  }

  function technicianArchivePanelIsOpen() {
    const panel = document.getElementById('technicianArchivesPanel');
    return Boolean(panel && !panel.classList.contains('hidden'));
  }

  function rememberCurrentSheet() {
    observedSheetId = state?.sheet?.id || null;
    observedStatus = state?.sheet?.status || 'draft';
  }

  function showAdvanceMessage() {
    const message = document.getElementById('saveMsg');
    if (!message) return;
    message.textContent = 'La semaine précédente a été validée par le responsable. Passage automatique à la semaine suivante.';
    message.style.fontWeight = '700';
  }

  async function advanceToNextWeek(previousWeekStart) {
    if (moving || !previousWeekStart) return;
    moving = true;
    try {
      const nextStart = nextWeekStart(previousWeekStart);
      const weekInput = document.getElementById('weekInput');
      await loadSheet(nextStart);
      if (weekInput) weekInput.value = weekValueFromMonday(nextStart);
      if (typeof showTechnicianSheetView === 'function') showTechnicianSheetView();
      renderWeek();
      rememberCurrentSheet();
      showAdvanceMessage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Passage automatique à la semaine suivante impossible :', error);
    } finally {
      moving = false;
    }
  }

  async function checkResponsibleApproval() {
    if (checking || moving || !isCloud || currentProfile?.role !== 'technician') return;
    if (technicianArchivePanelIsOpen()) return;

    const sheet = state?.sheet;
    if (!sheet?.id || !sheet?.week_start) {
      rememberCurrentSheet();
      return;
    }

    if (observedSheetId !== sheet.id) {
      rememberCurrentSheet();
      return;
    }

    checking = true;
    try {
      const sheetId = sheet.id;
      const weekStart = sheet.week_start;
      const previousStatus = observedStatus || sheet.status || 'draft';
      const { data, error } = await sb
        .from('ljs_timesheets')
        .select('status')
        .eq('id', sheetId)
        .maybeSingle();

      if (error || !data) return;
      observedStatus = data.status || previousStatus;

      if (
        previousStatus !== 'approved' &&
        data.status === 'approved' &&
        state?.sheet?.id === sheetId
      ) {
        state.sheet.status = 'approved';
        await advanceToNextWeek(weekStart);
      }
    } catch (error) {
      console.warn('Vérification de validation responsable impossible :', error);
    } finally {
      checking = false;
    }
  }

  function startWatcher() {
    if (timer) clearInterval(timer);
    timer = setInterval(checkResponsibleApproval, CHECK_INTERVAL_MS);
  }

  function installShowWeekWrapper() {
    const baseShowWeek = window.showWeek;
    if (typeof baseShowWeek !== 'function' || baseShowWeek.__ljsAutoAdvanceWeek) return;

    const wrapped = async function() {
      const result = await baseShowWeek.apply(this, arguments);
      rememberCurrentSheet();

      // Si le technicien se reconnecte après la validation du responsable,
      // il arrive directement sur la semaine suivante.
      if (state?.sheet?.status === 'approved' && state?.sheet?.week_start) {
        await advanceToNextWeek(state.sheet.week_start);
      }

      startWatcher();
      return result;
    };
    wrapped.__ljsAutoAdvanceWeek = true;
    window.showWeek = wrapped;
  }

  document.addEventListener('change', event => {
    if (event.target?.id === 'weekInput') {
      setTimeout(rememberCurrentSheet, 0);
    }
  });

  installShowWeekWrapper();
})();
