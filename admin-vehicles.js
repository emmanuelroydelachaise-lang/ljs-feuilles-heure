(() => {
  const baseRefreshAdmin = window.refreshAdmin;
  if (typeof baseRefreshAdmin !== 'function') return;

  function normalizeRegistration(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function normalizeBrand(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
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
      <p class="hint">Ajoute une immatriculation et sa marque. « Retirer » désactive temporairement le véhicule ; « Supprimer » le fait disparaître des listes futures tout en conservant les anciennes feuilles.</p>
      <div class="project-add vehicle-add">
        <input id="newVehicleRegistration" placeholder="Immatriculation (ex. AB-123-CD)" autocomplete="off" />
        <input id="newVehicleBrand" placeholder="Marque (ex. Renault)" autocomplete="off" />
        <button id="addVehicleBtn" class="primary">Ajouter</button>
      </div>
      <div id="adminVehicles" class="stack"></div>`;

    projectsCard.insertAdjacentElement('afterend', card);
    card.querySelector('#addVehicleBtn').onclick = addVehicle;
    [card.querySelector('#newVehicleRegistration'), card.querySelector('#newVehicleBrand')].forEach(input => {
      input?.addEventListener('keydown', event => {
        if (event.key === 'Enter') addVehicle();
      });
    });
    return card;
  }

  async function getVehicles() {
    if (!isCloud) return demoDb().vehicles || [];
    const { data, error } = await sb.from('ljs_vehicles').select('*').order('registration');
    if (error) throw error;
    return data || [];
  }

  async function setVehicleState(vehicle, action) {
    try {
      if (!isCloud) {
        const db = demoDb();
        const found = (db.vehicles || []).find(v => v.id === vehicle.id);
        if (!found) throw new Error('Véhicule introuvable.');
        if (action === 'retire') {
          found.active = false;
          found.deleted = false;
        } else if (action === 'reactivate') {
          found.active = true;
          found.deleted = false;
        } else if (action === 'delete') {
          found.active = false;
          found.deleted = true;
        }
        saveDemoDb(db);
      } else {
        const patch = action === 'retire'
          ? { active: false, deleted: false }
          : action === 'reactivate'
            ? { active: true, deleted: false }
            : { active: false, deleted: true };
        const { error } = await sb.from('ljs_vehicles').update(patch).eq('id', vehicle.id);
        if (error) throw error;
      }
      await refreshAdmin();
    } catch (error) {
      alert('Impossible de modifier ce véhicule : ' + (error.message || error));
    }
  }

  async function renderAdminVehicles() {
    const card = ensureVehicleCard();
    const box = card?.querySelector('#adminVehicles');
    if (!box) return;
    box.innerHTML = '<p class="hint">Chargement des véhicules…</p>';

    try {
      const vehicles = (await getVehicles()).filter(vehicle => !vehicle.deleted);
      box.innerHTML = '';
      if (!vehicles.length) {
        box.innerHTML = '<p class="hint">Aucun véhicule enregistré.</p>';
        return;
      }

      vehicles.forEach(vehicle => {
        const row = document.createElement('div');
        row.className = 'admin-item';
        const brand = String(vehicle.brand || '').trim();
        row.innerHTML = `
          <div>
            <strong>${esc(vehicle.registration)}</strong>
            <div class="meta">${brand ? esc(brand) + ' · ' : ''}${vehicle.active === false ? 'Retiré' : 'Actif'}</div>
          </div>
          <div class="admin-row-actions">
            <button class="secondary toggle-vehicle">${vehicle.active === false ? 'Réactiver' : 'Retirer'}</button>
            <button class="secondary delete-vehicle" style="border-color:#d92d20;color:#b42318;background:#fff4f2">Supprimer</button>
          </div>`;

        row.querySelector('.toggle-vehicle').onclick = async () => {
          if (vehicle.active === false) {
            await setVehicleState(vehicle, 'reactivate');
            return;
          }
          if (!confirm(`Retirer temporairement le véhicule ${vehicle.registration} de la liste proposée aux techniciens ?`)) return;
          await setVehicleState(vehicle, 'retire');
        };

        row.querySelector('.delete-vehicle').onclick = async () => {
          if (!confirm(`Supprimer le véhicule ${vehicle.registration} de la liste ?\n\nIl ne sera plus proposé aux techniciens. Les anciennes feuilles utilisant ce véhicule seront conservées.`)) return;
          await setVehicleState(vehicle, 'delete');
        };

        box.appendChild(row);
      });
    } catch (error) {
      box.innerHTML = `<p class="error">Impossible de charger les véhicules : ${esc(error.message || error)}</p>`;
    }
  }

  async function addVehicle() {
    const registrationInput = document.getElementById('newVehicleRegistration');
    const brandInput = document.getElementById('newVehicleBrand');
    const registration = normalizeRegistration(registrationInput?.value);
    const brand = normalizeBrand(brandInput?.value);

    if (!registration) {
      alert('Renseigne une immatriculation.');
      return;
    }
    if (!brand) {
      alert('Renseigne la marque du véhicule.');
      return;
    }

    try {
      const vehicles = await getVehicles();
      const duplicate = vehicles.find(v => normalizeRegistration(v.registration) === registration);
      if (duplicate) {
        if (duplicate.deleted) {
          if (!confirm(`${registration} a déjà été supprimé. Le restaurer avec la marque « ${brand} » ?`)) return;
          if (!isCloud) {
            const db = demoDb();
            const found = (db.vehicles || []).find(v => v.id === duplicate.id);
            if (found) {
              found.active = true;
              found.deleted = false;
              found.brand = brand;
            }
            saveDemoDb(db);
          } else {
            const { error } = await sb.from('ljs_vehicles').update({ active: true, deleted: false, brand }).eq('id', duplicate.id);
            if (error) throw error;
          }
          registrationInput.value = '';
          brandInput.value = '';
          await refreshAdmin();
          return;
        }
        if (duplicate.active === false) {
          if (!confirm(`${registration} existe déjà mais est retiré. Le réactiver avec la marque « ${brand} » ?`)) return;
          if (!isCloud) {
            const db = demoDb();
            const found = (db.vehicles || []).find(v => v.id === duplicate.id);
            if (found) {
              found.active = true;
              found.deleted = false;
              found.brand = brand;
            }
            saveDemoDb(db);
          } else {
            const { error } = await sb.from('ljs_vehicles').update({ active: true, deleted: false, brand }).eq('id', duplicate.id);
            if (error) throw error;
          }
          registrationInput.value = '';
          brandInput.value = '';
          await refreshAdmin();
          return;
        }
        alert('Cette immatriculation existe déjà.');
        return;
      }

      if (!isCloud) {
        const db = demoDb();
        db.vehicles = db.vehicles || [];
        db.vehicles.push({ id: 'v_' + Date.now(), registration, brand, active: true, deleted: false });
        saveDemoDb(db);
      } else {
        const { error } = await sb.from('ljs_vehicles').insert({ registration, brand, active: true, deleted: false });
        if (error) throw error;
      }

      registrationInput.value = '';
      brandInput.value = '';
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
