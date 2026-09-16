(() => {
  let administrativeData = null;

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(String(value).length === 10 ? value + 'T12:00:00' : value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
  }

  function weekPeriod(weekStart) {
    const monday = new Date(weekStart + 'T12:00:00');
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    return `${formatDate(weekStart)} au ${formatDate(saturday.toISOString().slice(0,10))}`;
  }

  function normalizedAdministrativeSheet(sheet) {
    const copy = deepClone(sheet);
    copy.technician_employment_type = copy.technician_employment_type || 'employee';
    return normalizeSheet(copy, copy.week_start);
  }

  async function downloadAdministrativePdf(sheet, technicianName, button) {
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Création PDF…';
    try {
      await window.downloadTimesheetPdf(normalizedAdministrativeSheet(sheet), technicianName);
    } catch (error) {
      console.error(error);
      alert('Impossible de créer le PDF : ' + (error.message || error));
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  function renderAdministrativeArchives(data) {
    administrativeData = data || { sheets:[], projects:[], vehicles:[] };
    state.projects = Array.isArray(administrativeData.projects) ? administrativeData.projects : [];
    state.vehicles = Array.isArray(administrativeData.vehicles) ? administrativeData.vehicles : [];

    const sheets = (Array.isArray(administrativeData.sheets) ? administrativeData.sheets : [])
      .filter(sheet => sheet.status === 'approved')
      .sort((a,b) => {
        const byName = String(a.technician_name || '').localeCompare(String(b.technician_name || ''), 'fr');
        if (byName !== 0) return byName;
        return String(b.week_start || '').localeCompare(String(a.week_start || ''));
      });

    state.technicians = [...new Map(sheets.map(sheet => [sheet.technician_id, {
      id: sheet.technician_id,
      full_name: sheet.technician_name || 'Technicien',
      employment_type: sheet.technician_employment_type || 'employee',
      role: 'technician',
      active: true
    }])).values()];

    app.innerHTML = `
      <section class="toolbar card">
        <div><div class="small muted">Mode</div><strong>Administratif — lecture seule</strong></div>
        <button id="administrativeLogoutBtn" class="ghost" type="button">Quitter</button>
      </section>
      <section class="card">
        <h2>Archives des feuilles d’heures validées</h2>
        <p class="hint">Cet accès affiche uniquement les feuilles validées par le responsable. Aucune modification ni suppression n’est possible.</p>
        <div id="administrativeArchivesList" class="archive-tech-list"></div>
      </section>`;

    document.getElementById('administrativeLogoutBtn').onclick = () => {
      administrativeData = null;
      currentProfile = null;
      currentUser = null;
      state = {projects:[],vehicles:[],technicians:[],sheet:null,adminSheet:null};
      showLogin();
    };

    const box = document.getElementById('administrativeArchivesList');
    if (!sheets.length) {
      box.innerHTML = '<p class="hint">Aucune feuille validée par le responsable pour le moment.</p>';
      return;
    }

    const groups = new Map();
    sheets.forEach(sheet => {
      const key = sheet.technician_id || sheet.technician_name || 'Technicien';
      if (!groups.has(key)) groups.set(key, { name:sheet.technician_name || 'Technicien', sheets:[] });
      groups.get(key).sheets.push(sheet);
    });

    [...groups.values()].forEach(group => {
      const wrapper = document.createElement('div');
      wrapper.className = 'archive-tech-group';
      wrapper.innerHTML = `
        <button class="archive-tech-toggle" type="button">
          <span><strong>${esc(group.name)}</strong></span>
          <span>${group.sheets.length} feuille${group.sheets.length > 1 ? 's' : ''} ▾</span>
        </button>
        <div class="archive-sheet-list hidden"></div>`;

      const list = wrapper.querySelector('.archive-sheet-list');
      group.sheets.forEach(sheet => {
        const normalized = normalizedAdministrativeSheet(sheet);
        const row = document.createElement('div');
        row.className = 'archive-sheet-row';
        const approved = formatDate(sheet.approved_at);
        row.innerHTML = `
          <div class="archive-sheet-info">
            <strong>Semaine ${weekNumber(sheet.week_start)} — ${weekPeriod(sheet.week_start)}</strong>
            <span class="meta">${fmtHours(totalWeek(normalized))}${approved ? ` · Validée le ${approved}` : ' · Validée par le responsable'}</span>
          </div>
          <div class="admin-row-actions">
            <button class="secondary administrative-pdf" type="button">PDF</button>
          </div>`;
        row.querySelector('.administrative-pdf').onclick = event => downloadAdministrativePdf(sheet, group.name, event.currentTarget);
        list.appendChild(row);
      });

      wrapper.querySelector('.archive-tech-toggle').onclick = () => list.classList.toggle('hidden');
      box.appendChild(wrapper);
    });
  }

  async function administrativeLogin() {
    const input = document.getElementById('administrativePinInput');
    const button = document.getElementById('administrativeLoginBtn');
    const errorBox = document.getElementById('administrativeLoginError');
    const pin = String(input?.value || '').trim();
    errorBox.textContent = '';

    if (!/^\d{4}$/.test(pin)) {
      errorBox.textContent = 'Le code doit contenir 4 chiffres.';
      return;
    }
    if (!isCloud) {
      errorBox.textContent = 'L’accès administratif est disponible uniquement sur la version en ligne.';
      return;
    }

    button.disabled = true;
    button.textContent = 'Connexion…';
    try {
      const { data, error } = await sb.rpc('ljs_administrative_archives', { p_pin: pin });
      if (error) throw error;
      currentProfile = { id:'administrative', full_name:'Administratif', role:'administrative' };
      renderAdministrativeArchives(data);
    } catch (error) {
      console.error(error);
      errorBox.textContent = 'Code administratif incorrect.';
      input.value = '';
      input.focus();
      button.disabled = false;
      button.textContent = 'Connexion';
    }
  }

  function showAdministrativeLogin() {
    app.innerHTML = `
      <section class="card login-card">
        <h1>Accès administratif</h1>
        <p class="hint">Accès en lecture seule aux feuilles d’heures validées par le responsable.</p>
        <label>Code administratif</label>
        <input id="administrativePinInput" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*" autocomplete="off" placeholder="••••" />
        <button id="administrativeLoginBtn" class="primary" type="button">Connexion</button>
        <button id="administrativeBackBtn" class="link-btn" type="button">Retour techniciens</button>
        <p id="administrativeLoginError" class="error"></p>
      </section>`;
    document.getElementById('administrativeLoginBtn').onclick = administrativeLogin;
    document.getElementById('administrativeBackBtn').onclick = showLogin;
    document.getElementById('administrativePinInput').addEventListener('keydown', event => {
      if (event.key === 'Enter') administrativeLogin();
    });
    setTimeout(() => document.getElementById('administrativePinInput')?.focus(), 0);
  }

  function addAdministrativeEntryToLogin() {
    const responsibleButton = document.getElementById('adminLoginOpen');
    if (!responsibleButton || document.getElementById('administrativeLoginOpen')) return;
    const button = document.createElement('button');
    button.id = 'administrativeLoginOpen';
    button.type = 'button';
    button.className = 'link-btn';
    button.textContent = 'Accès administratif';
    button.onclick = showAdministrativeLogin;
    responsibleButton.insertAdjacentElement('afterend', button);
  }

  function installShowLoginWrapper() {
    const baseShowLogin = window.showLogin;
    if (typeof baseShowLogin !== 'function' || baseShowLogin.__ljsAdministrativeAccess) {
      addAdministrativeEntryToLogin();
      return;
    }
    const wrappedShowLogin = async function(...args) {
      const result = await baseShowLogin.apply(this, args);
      addAdministrativeEntryToLogin();
      return result;
    };
    wrappedShowLogin.__ljsAdministrativeAccess = true;
    window.showLogin = wrappedShowLogin;
    addAdministrativeEntryToLogin();
  }

  window.showAdministrativeLogin = showAdministrativeLogin;
  installShowLoginWrapper();
})();
