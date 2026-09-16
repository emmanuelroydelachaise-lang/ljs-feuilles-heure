(() => {
  let dashboardRenderToken = 0;

  function weekLabel(weekStart) {
    try {
      const start = new Date(weekStart + 'T12:00:00');
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const sameMonth = start.getMonth() === end.getMonth();
      const sameYear = start.getFullYear() === end.getFullYear();
      const startText = start.toLocaleDateString('fr-FR', sameMonth && sameYear ? {day:'numeric'} : {day:'numeric',month:'long',year:sameYear?undefined:'numeric'});
      const endText = end.toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'});
      return `Semaine du ${startText} au ${endText}`;
    } catch (_) {
      return 'Semaine sélectionnée';
    }
  }

  function ensureDashboard() {
    let card = document.getElementById('adminDashboardCard');
    if (card) return card;
    const listCard = document.getElementById('adminListCard');
    if (!listCard) return null;

    card = document.createElement('section');
    card.id = 'adminDashboardCard';
    card.className = 'card admin-dashboard-card';
    card.innerHTML = `
      <div class="admin-dashboard-head">
        <div>
          <h2>Tableau de bord</h2>
          <p id="dashboardWeekLabel" class="hint"></p>
        </div>
      </div>
      <div id="adminDashboardGrid" class="admin-dashboard-grid"></div>
      <div id="adminDashboardDetails" class="dashboard-details hidden"></div>`;
    listCard.insertAdjacentElement('beforebegin', card);
    return card;
  }

  function activeTechnicians() {
    return (state.technicians || [])
      .filter(t => t.active !== false && !t.deleted)
      .sort((a,b) => String(a.full_name||'').localeCompare(String(b.full_name||''), 'fr'));
  }

  async function getWeekSheets(weekStart) {
    if (!isCloud) {
      return (demoDb().sheets || []).filter(s => s.week_start === weekStart);
    }
    const { data, error } = await sb.from('ljs_timesheets')
      .select('id,technician_id,status,week_start')
      .eq('week_start', weekStart);
    if (error) throw error;
    return data || [];
  }

  function showDetails(kind, title, names) {
    const box = document.getElementById('adminDashboardDetails');
    if (!box) return;
    if (box.dataset.kind === kind && !box.classList.contains('hidden')) {
      box.classList.add('hidden');
      box.dataset.kind = '';
      return;
    }
    box.dataset.kind = kind;
    box.innerHTML = `
      <div class="dashboard-details-head"><strong>${esc(title)}</strong><span class="small muted">${names.length} technicien${names.length>1?'s':''}</span></div>
      ${names.length ? `<div class="dashboard-name-list">${names.map(name=>`<span class="dashboard-name">${esc(name)}</span>`).join('')}</div>` : '<p class="dashboard-empty">Aucun technicien dans cette catégorie.</p>'}`;
    box.classList.remove('hidden');
  }

  async function renderAdminDashboard() {
    const card = ensureDashboard();
    const weekInput = document.getElementById('adminWeekInput');
    const grid = document.getElementById('adminDashboardGrid');
    if (!card || !weekInput || !grid) return;

    const token = ++dashboardRenderToken;
    const weekStart = mondayOfWeekValue(weekInput.value || currentWeekValue());
    const weekLabelEl = document.getElementById('dashboardWeekLabel');
    if (weekLabelEl) weekLabelEl.textContent = weekLabel(weekStart);
    grid.innerHTML = '<p class="hint">Mise à jour du tableau de bord…</p>';

    try {
      const techs = activeTechnicians();
      const sheets = await getWeekSheets(weekStart);
      if (token !== dashboardRenderToken) return;

      const byTech = new Map();
      sheets.forEach(s => {
        if (!s.technician_id) return;
        const existing = byTech.get(s.technician_id);
        if (!existing || existing.status !== 'approved') byTech.set(s.technician_id, s);
      });

      const received = techs.filter(t => ['submitted','approved'].includes(byTech.get(t.id)?.status));
      const pending = techs.filter(t => byTech.get(t.id)?.status === 'submitted');
      const approved = techs.filter(t => byTech.get(t.id)?.status === 'approved');
      const missing = techs.filter(t => !['submitted','approved'].includes(byTech.get(t.id)?.status));

      const stats = [
        {kind:'active', label:'Techniciens actifs', value:techs.length, people:techs, title:'Techniciens actifs'},
        {kind:'received', label:'Feuilles reçues', value:received.length, people:received, title:'Feuilles reçues'},
        {kind:'pending', label:'À valider', value:pending.length, people:pending, title:'Feuilles à valider'},
        {kind:'approved', label:'Validées', value:approved.length, people:approved, title:'Feuilles validées'},
        {kind:'missing', label:'Manquantes', value:missing.length, people:missing, title:'Feuilles non remises'}
      ];

      grid.innerHTML = '';
      stats.forEach(stat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dashboard-stat';
        btn.dataset.kind = stat.kind;
        btn.innerHTML = `<span class="dashboard-number">${stat.value}</span><span class="dashboard-label">${esc(stat.label)}</span>`;
        btn.title = `Afficher les techniciens : ${stat.label}`;
        btn.onclick = () => showDetails(stat.kind, stat.title, stat.people.map(t => t.full_name));
        grid.appendChild(btn);
      });
    } catch (error) {
      grid.innerHTML = `<p class="error">Impossible de mettre à jour le tableau de bord : ${esc(error.message || error)}</p>`;
    }
  }

  function installRefreshWrapper() {
    const current = window.refreshAdmin;
    if (typeof current !== 'function' || current.__ljsDashboardWrapped) return false;
    const wrapped = async function(...args) {
      const result = await current.apply(this, args);
      await renderAdminDashboard();
      return result;
    };
    wrapped.__ljsDashboardWrapped = true;
    window.refreshAdmin = wrapped;
    return true;
  }

  let attempts = 0;
  let initialRendered = false;
  const timer = setInterval(() => {
    installRefreshWrapper();
    if (!initialRendered && document.getElementById('adminWeekInput')) {
      initialRendered = true;
      renderAdminDashboard();
    }
    attempts += 1;
    if (attempts >= 30 && window.refreshAdmin?.__ljsDashboardWrapped) clearInterval(timer);
  }, 120);

  window.renderAdminDashboard = renderAdminDashboard;
})();
