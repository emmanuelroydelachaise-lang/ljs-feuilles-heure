(() => {
  function weekdayLabel(day) {
    try {
      return new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (_) {
      return day.name || day.date || 'jour';
    }
  }

  function ensureSelectPlaceholders() {
    const cards = [...document.querySelectorAll('#days .day-card')];
    cards.forEach((card, dayIndex) => {
      const day = state?.sheet?.days?.[dayIndex];
      if (!day) return;

      const zone = card.querySelector('select.zone');
      const zoneZero = zone?.querySelector('option[value="0"]');
      if (zoneZero) zoneZero.textContent = 'Sélectionner zone';

      const rows = [...card.querySelectorAll('.work-row')];
      rows.forEach((row, entryIndex) => {
        const select = row.querySelector('select.project');
        const entry = day.entries?.[entryIndex];
        if (!select || !entry) return;
        if (!select.querySelector('option[value=""]')) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'Sélectionner chantier';
          select.insertBefore(option, select.firstChild);
        }
        select.value = entry.project_id || '';
      });
    });
  }

  function clearAutomaticProjectsForNewSheet() {
    const sheet = state?.sheet;
    if (!sheet || sheet.status !== 'draft' || sheet.id) return;
    (sheet.days || []).slice(0, 6).forEach(day => {
      (day.entries || []).forEach(entry => {
        if (Number(entry.hours || 0) <= 0 && !String(entry.manual_project_name || '').trim()) entry.project_id = '';
      });
    });
  }

  function installRenderWrapper() {
    const baseRenderWeek = window.renderWeek;
    if (typeof baseRenderWeek !== 'function' || baseRenderWeek.__ljsStablePlaceholders) return false;
    const wrapped = function(...args) {
      clearAutomaticProjectsForNewSheet();
      const result = baseRenderWeek.apply(this, args);
      ensureSelectPlaceholders();
      return result;
    };
    wrapped.__ljsStablePlaceholders = true;
    window.renderWeek = wrapped;
    return true;
  }

  function installRowHandlers() {
    if (document.documentElement.dataset.ljsStableRowHandlers === '1') return;
    document.documentElement.dataset.ljsStableRowHandlers = '1';

    document.addEventListener('click', event => {
      const add = event.target.closest?.('.add-row');
      if (add) {
        const card = add.closest('.day-card');
        const cards = [...document.querySelectorAll('#days .day-card')];
        const dayIndex = cards.indexOf(card);
        setTimeout(() => {
          const day = state?.sheet?.days?.[dayIndex];
          const entry = day?.entries?.[day.entries.length - 1];
          if (entry && Number(entry.hours || 0) <= 0) entry.project_id = '';
          ensureSelectPlaceholders();
        }, 0);
        return;
      }

      if (event.target.closest?.('.remove')) setTimeout(ensureSelectPlaceholders, 0);
    });

    document.addEventListener('change', event => {
      if (event.target.matches?.('select.project, select.zone')) setTimeout(ensureSelectPlaceholders, 0);
    });
  }

  function installSubmissionGuard() {
    const baseSaveWeek = window.saveWeek;
    if (typeof baseSaveWeek !== 'function' || baseSaveWeek.__ljsCompleteGuard) return false;

    const wrapped = async function(submit) {
      if (submit && state?.sheet?.days) {
        const weekdays = state.sheet.days.slice(0, 5);
        const missingHours = weekdays.filter(day => !day.absent && totalDay(day) <= 0);
        const missingZones = weekdays.filter(day => !day.absent && totalDay(day) > 0 && !(Number(day.zone) >= 1 && Number(day.zone) <= 5));
        const missingProjects = weekdays.filter(day =>
          !day.absent && (day.entries || []).some(entry => Number(entry.hours || 0) > 0 && !entry.project_id)
        );

        if (missingHours.length || missingZones.length || missingProjects.length) {
          const lines = ['Feuille incomplète :'];
          if (missingHours.length) lines.push(`• Heures non renseignées : ${missingHours.map(weekdayLabel).join(', ')}.`);
          if (missingZones.length) lines.push(`• Zone trajet non renseignée : ${missingZones.map(weekdayLabel).join(', ')}.`);
          if (missingProjects.length) lines.push(`• Chantier non sélectionné : ${missingProjects.map(weekdayLabel).join(', ')}.`);
          lines.push('', 'Complète les éléments indiqués avant de valider. Le samedi est facultatif.');
          alert(lines.join('\n'));
          return;
        }
      }
      return baseSaveWeek.apply(this, arguments);
    };
    wrapped.__ljsCompleteGuard = true;
    window.saveWeek = wrapped;
    return true;
  }

  function printedVehicleLabel(sheet) {
    if (!sheet?.vehicle_id || typeof vehicleById !== 'function') return '';
    const vehicle = vehicleById(sheet.vehicle_id);
    if (!vehicle) return '';
    const brand = String(vehicle.brand || '').trim();
    const registration = String(vehicle.registration || '').trim();
    return brand ? `${brand.toUpperCase()} — ${registration}` : registration;
  }

  function fitPrintedName(field) {
    if (!field) return;
    const span = field.querySelector('span');
    if (!span) return;
    const text = String(span.textContent || '').trim();
    const length = text.length;
    const fontSize = length > 48 ? 3.8 : length > 40 ? 4.3 : length > 33 ? 4.9 : length > 27 ? 5.5 : length > 21 ? 6.3 : 7.5;
    field.classList.add('p-technician-name');
    field.style.fontSize = `${fontSize}pt`;
    field.style.whiteSpace = 'nowrap';
    span.style.whiteSpace = 'nowrap';
    span.style.display = 'block';
    span.style.maxWidth = '100%';
  }

  function installPrintFix() {
    const basePrintTimesheet = window.printTimesheet;
    if (typeof basePrintTimesheet !== 'function' || basePrintTimesheet.__ljsVehicleBrandFix) return false;
    const wrapped = function(sheet) {
      const result = basePrintTimesheet.apply(this, arguments);
      const area = document.getElementById('printArea') || window.printArea;
      const fields = area ? [...area.querySelectorAll('.exact-print-sheet .p-field')] : [];
      if (fields.length) fitPrintedName(fields[0]);
      if (fields.length > 1) {
        const label = printedVehicleLabel(sheet);
        const span = fields[1].querySelector('span');
        if (span) span.textContent = label;
        fields[1].style.fontSize = label.length > 30 ? '5pt' : label.length > 24 ? '5.8pt' : '7pt';
        fields[1].style.whiteSpace = 'nowrap';
      }
      return result;
    };
    wrapped.__ljsVehicleBrandFix = true;
    window.printTimesheet = wrapped;
    return true;
  }

  installRowHandlers();
  installRenderWrapper();
  installSubmissionGuard();
  installPrintFix();
})();
