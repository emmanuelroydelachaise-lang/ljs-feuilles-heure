(() => {
  const baseRefreshAdmin = window.refreshAdmin;
  if (typeof baseRefreshAdmin !== 'function') return;

  function normalizeRegistration(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function ensureVehicleCard() {
    let card = document.getElementById('adminVehiclesCard');
    if (card) return card;

    const projectsBox = document.getElementById('adminProjects');
    const projectsCard = projectsBox?.closest('.card');
    if (!projectsCard) return null;

    card = document.createElement('section');
    card.id = 'adminVehiclesCard';
    card.className = 'card';
    card.innerHTML = `
      <h2>Véhicules</h2>
      <p class="hint">Ajoute ou retire les immatriculations proposées aux techniciens dans leurs feuilles d’heures.</p>
      <div class="project-add vehicle-add">
        <input id="newVehicleRegistration" placeholder="Immatriculation (ex. AB-123-CD)" autocomplete="off" />
        <button id="addVehicleBtn" class="primary">Ajouter</button>
      </div>
      <div id="adminVehicles" class="stack"></div>`;

    projectsCard.insertAdjacentElement('afterend', card);
    card.querySelector('#addVehicleBtn').onclick = addVehicle;
    card.querySelector('#newVehicleRegistration').addEventListener('keydown', event => {
      if (event.key === 'Enter') addVehicle();
    });
    return card;
  }

  async function getVehicles() {
    if (!isCloud) return demoDb().vehicles || [];
    const { data, error } = await sb.from('ljs_vehicles').select('*').order('registration');
    if (error) throw error;
    return data || [];
  }

  async function renderAdminVehicles() {
    const card = ensureVehicleCard();
    const box = card?.querySelector('#adminVehicles');
    if (!box) return;
    box.innerHTML = '<p class="hint">Chargement des véhicules…</p>';

    try {
      const vehicles = await getVehicles();
      box.innerHTML = '';
      if (!vehicles.length) {
        box.innerHTML = '<p class="hint">Aucun véhicule enregistré.</p>';
        return;
      }

      vehicles.forEach(vehicle => {
        const row = document.createElement('div');
        row.className = 'admin-item';
        row.innerHTML = `
          <div>
            <strong>${esc(vehicle.registration)}</strong>
            <div class="meta">${vehicle.active === false ? 'Retiré' : 'Actif'}</div>
          </div>
          <button class="secondary toggle-vehicle">${vehicle.active === false ? 'Réactiver' : 'Retirer'}</button>`;

        row.querySelector('.toggle-vehicle').onclick = async () => {
          const nextActive = vehicle.active === false;
          if (!nextActive && !confirm(`Retirer le véhicule ${vehicle.registration} de la liste proposée aux techniciens ?`)) return;
          try {
            if (!isCloud) {
              const db = demoDb();
              const found = (db.vehicles || []).find(v => v.id === vehicle.id);
              if (found) found.active = nextActive;
              saveDemoDb(db);
            } else {
              const { error } = await sb.from('ljs_vehicles').update({ active: nextActive }).eq('id', vehicle.id);
              if (error) throw error;
            }
            await refreshAdmin();
          } catch (error) {
            alert('Impossible de modifier ce véhicule : ' + (error.message || error));
          }
        };
        box.appendChild(row);
      });
    } catch (error) {
      box.innerHTML = `<p class="error">Impossible de charger les véhicules : ${esc(error.message || error)}</p>`;
    }
  }

  async function addVehicle() {
    const input = document.getElementById('newVehicleRegistration');
    const registration = normalizeRegistration(input?.value);
    if (!registration) {
      alert('Renseigne une immatriculation.');
      return;
    }

    try {
      const vehicles = await getVehicles();
      const duplicate = vehicles.find(v => normalizeRegistration(v.registration) === registration);
      if (duplicate) {
        if (duplicate.active === false) {
          if (!confirm(`${registration} existe déjà mais est retiré. Le réactiver ?`)) return;
          if (!isCloud) {
            const db = demoDb();
            const found = (db.vehicles || []).find(v => v.id === duplicate.id);
            if (found) found.active = true;
            saveDemoDb(db);
          } else {
            const { error } = await sb.from('ljs_vehicles').update({ active: true }).eq('id', duplicate.id);
            if (error) throw error;
          }
          input.value = '';
          await refreshAdmin();
          return;
        }
        alert('Cette immatriculation existe déjà.');
        return;
      }

      if (!isCloud) {
        const db = demoDb();
        db.vehicles = db.vehicles || [];
        db.vehicles.push({ id: 'v_' + Date.now(), registration, active: true });
        saveDemoDb(db);
      } else {
        const { error } = await sb.from('ljs_vehicles').insert({ registration, active: true });
        if (error) throw error;
      }

      input.value = '';
      await refreshAdmin();
    } catch (error) {
      alert('Impossible d’ajouter ce véhicule : ' + (error.message || error));
    }
  }

  window.renderAdminVehicles = renderAdminVehicles;
  window.refreshAdmin = async function() {
    await baseRefreshAdmin();
    ensureVehicleCard();
    await renderAdminVehicles();
  };

  if (document.getElementById('adminProjects')) {
    ensureVehicleCard();
    renderAdminVehicles();
  }
})();
