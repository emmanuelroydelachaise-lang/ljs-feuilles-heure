(() => {
  function weekdayLabel(day) {
    try {
      return new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (_) {
      return day.name || day.date || 'jour';
    }
  }

  function installProjectPlaceholder() {
    if (typeof window.projectOptions === 'function' && !window.projectOptions.__ljsPlaceholder) {
      const baseProjectOptions = window.projectOptions;
      const wrappedProjectOptions = function(selected, allowInactive = false) {
        const placeholder = `<option value="" ${!selected ? 'selected' : ''}>Sélectionner chantier</option>`;
        return placeholder + baseProjectOptions.call(this, selected, allowInactive);
      };
      wrappedProjectOptions.__ljsPlaceholder = true;
      window.projectOptions = wrappedProjectOptions;
    }

    if (typeof window.normalizeSheet === 'function' && !window.normalizeSheet.__ljsBlankProject) {
      const baseNormalizeSheet = window.normalizeSheet;
      const wrappedNormalizeSheet = function(...args) {
        const sheet = baseNormalizeSheet.apply(this, args);
        if (sheet?.status === 'draft' && Array.isArray(sheet.days)) {
          sheet.days.forEach(day => {
            (day.entries || []).forEach(entry => {
              if (Number(entry.hours || 0) <= 0 && !String(entry.manual_project_name || '').trim()) {
                entry.project_id = '';
              }
            });
          });
        }
        return sheet;
      };
      wrappedNormalizeSheet.__ljsBlankProject = true;
      window.normalizeSheet = wrappedNormalizeSheet;
    }
  }

  function clearAutomaticProjectSelections() {
    if (state?.sheet?.status && state.sheet.status !== 'draft') return;
    const cards = [...document.querySelectorAll('#days .day-card')];
    cards.forEach((card, dayIndex) => {
      const day = state?.sheet?.days?.[dayIndex];
      if (!day || day.absent) return;
      const rows = [...card.querySelectorAll('.work-row')];
      rows.forEach((row, entryIndex) => {
        const hours = row.querySelector('.hours');
        const select = row.querySelector('.project');
        const entry = day.entries?.[entryIndex];
        if (!hours || !select || !entry) return;
        if (Number(hours.value || 0) > 0 || String(entry.manual_project_name || '').trim()) return;
        if (entry.project_id && entry.project_id !== OTHER_PROJECT_ID) {
          entry.project_id = '';
          select.value = '';
        }
      });
    });
  }

  function installProjectUiGuard() {
    if (document.documentElement.dataset.ljsProjectGuard === '1') return;
    document.documentElement.dataset.ljsProjectGuard = '1';

    document.addEventListener('click', event => {
      const button = event.target.closest?.('.add-row, .remove');
      if (!button) return;
      setTimeout(clearAutomaticProjectSelections, 0);
    });

    const observer = new MutationObserver(() => {
      if (document.getElementById('days')) setTimeout(clearAutomaticProjectSelections, 0);
    });
    observer.observe(document.getElementById('app'), { childList: true, subtree: true });
  }

  function installSubmissionGuard() {
    const baseSaveWeek = window.saveWeek;
    if (typeof baseSaveWeek !== 'function' || baseSaveWeek.__ljsCompleteGuard) return false;

    const wrapped = async function(submit) {
      if (submit && state?.sheet?.days) {
        const weekdays = state.sheet.days.slice(0, 5);
        const missingHours = weekdays.filter(day => !day.absent && totalDay(day) <= 0);
        const missingZones = weekdays.filter(day =>
          !day.absent && totalDay(day) > 0 && !(Number(day.zone) >= 1 && Number(day.zone) <= 5)
        );
        const missingProjects = weekdays.filter(day =>
          !day.absent && (day.entries || []).some(entry => Number(entry.hours || 0) > 0 && !entry.project_id)
        );

        if (missingHours.length || missingZones.length || missingProjects.length) {
          const lines = ['Feuille incomplète :'];
          if (missingHours.length) {
            lines.push(`• Heures non renseignées : ${missingHours.map(weekdayLabel).join(', ')}.`);
          }
          if (missingZones.length) {
            lines.push(`• Zone trajet non renseignée : ${missingZones.map(weekdayLabel).join(', ')}.`);
          }
          if (missingProjects.length) {
            lines.push(`• Chantier non sélectionné : ${missingProjects.map(weekdayLabel).join(', ')}.`);
          }
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
    span.style.overflow = 'visible';
  }

  function installPrintFix() {
    const basePrintTimesheet = window.printTimesheet;
    if (typeof basePrintTimesheet !== 'function' || basePrintTimesheet.__ljsVehicleBrandFix) return false;

    const wrapped = function(sheet, technicianName) {
      const result = basePrintTimesheet.apply(this, arguments);
      const area = document.getElementById('printArea') || window.printArea;
      const fields = area ? [...area.querySelectorAll('.exact-print-sheet .p-field')] : [];
      if (fields.length) fitPrintedName(fields[0]);
      if (fields.length > 1) {
        const label = printedVehicleLabel(sheet);
        const span = fields[1].querySelector('span');
        if (span) span.textContent = label;
        fields[1].classList.add('p-vehicle-label');
        fields[1].style.fontSize = label.length > 30 ? '5pt' : label.length > 24 ? '5.8pt' : '7pt';
        fields[1].style.whiteSpace = 'nowrap';
        if (span) span.style.whiteSpace = 'nowrap';
      }
      return result;
    };
    wrapped.__ljsVehicleBrandFix = true;
    window.printTimesheet = wrapped;
    return true;
  }

  installProjectPlaceholder();
  installProjectUiGuard();

  let attempts = 0;
  const timer = setInterval(() => {
    installProjectPlaceholder();
    const guardReady = installSubmissionGuard();
    const printReady = installPrintFix();
    attempts += 1;
    if ((guardReady || window.saveWeek?.__ljsCompleteGuard) && (printReady || window.printTimesheet?.__ljsVehicleBrandFix) && window.projectOptions?.__ljsPlaceholder) {
      clearInterval(timer);
    } else if (attempts > 40) {
      clearInterval(timer);
    }
  }, 100);
})();
