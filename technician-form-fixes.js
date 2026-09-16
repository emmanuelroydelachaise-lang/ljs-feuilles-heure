(() => {
  function weekdayLabel(day) {
    try {
      return new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (_) {
      return day.name || day.date || 'jour';
    }
  }

  function installSubmissionGuard() {
    const baseSaveWeek = window.saveWeek;
    if (typeof baseSaveWeek !== 'function' || baseSaveWeek.__ljsZoneGuard) return false;

    const wrapped = async function(submit) {
      if (submit && state?.sheet?.days) {
        const missingZones = state.sheet.days.slice(0, 5).filter(day =>
          !day.absent && typeof totalDay === 'function' && totalDay(day) > 0 && !(Number(day.zone) >= 1 && Number(day.zone) <= 5)
        );
        if (missingZones.length) {
          const labels = missingZones.map(weekdayLabel).join(', ');
          alert(`Zone trajet manquante : sélectionne une zone de 1 à 5 pour ${labels}.\n\nLe samedi est facultatif.`);
          return;
        }
      }
      return baseSaveWeek.apply(this, arguments);
    };
    wrapped.__ljsZoneGuard = true;
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

  let attempts = 0;
  const timer = setInterval(() => {
    const guardReady = installSubmissionGuard();
    const printReady = installPrintFix();
    attempts += 1;
    if ((guardReady || window.saveWeek?.__ljsZoneGuard) && (printReady || window.printTimesheet?.__ljsVehicleBrandFix)) clearInterval(timer);
    else if (attempts > 40) clearInterval(timer);
  }, 100);
})();
