(() => {
  function installStyles() {
    if (document.getElementById('ljsResponsibleCommentsStyles')) return;
    const style = document.createElement('style');
    style.id = 'ljsResponsibleCommentsStyles';
    style.textContent = `
      .ljs-comments-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px;align-items:stretch}
      .ljs-comments-row .admin-field{margin:0;min-width:0}
      .ljs-comments-row textarea{width:100%;box-sizing:border-box;min-height:92px;resize:vertical}
      .ljs-tech-comment-readonly textarea{background:#f3f5f7;color:#44515c;border-color:#cbd3da;cursor:not-allowed}
      .ljs-comment-owner{display:block;margin-top:5px;font-size:.76rem;color:#667480;font-weight:650}
      @media (max-width:760px){.ljs-comments-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function decorateComments() {
    const sheet = state?.adminSheet;
    const editor = document.getElementById('adminEditor');
    const techTextarea = document.getElementById('adminWeekComment');
    if (!sheet || !editor || !techTextarea) return;

    installStyles();

    let techField = techTextarea.closest('.admin-field');
    if (!techField || techField.dataset.ljsSeparatedComment === '1') return;
    techField.dataset.ljsSeparatedComment = '1';
    techField.classList.remove('admin-changed');
    techField.classList.add('ljs-tech-comment-readonly');

    const techLabel = techField.querySelector('label');
    if (techLabel) techLabel.textContent = 'Commentaire technicien';
    techTextarea.readOnly = true;
    techTextarea.disabled = false;
    techTextarea.oninput = null;
    techTextarea.setAttribute('aria-readonly', 'true');
    techTextarea.title = 'Le commentaire saisi par le technicien est en lecture seule pour le responsable.';

    if (!techField.querySelector('.ljs-comment-owner')) {
      const note = document.createElement('span');
      note.className = 'ljs-comment-owner';
      note.textContent = sheet.general_comment
        ? 'Saisi par le technicien — non modifiable par le responsable.'
        : 'Aucun commentaire saisi par le technicien.';
      techField.appendChild(note);
    }

    const row = document.createElement('div');
    row.className = 'ljs-comments-row';
    techField.parentNode.insertBefore(row, techField);
    row.appendChild(techField);

    const responsibleField = document.createElement('div');
    responsibleField.className = 'admin-field ljs-responsible-comment-field';
    responsibleField.innerHTML = `
      <label for="adminResponsibleComment">Commentaire responsable</label>
      <textarea id="adminResponsibleComment" rows="3" placeholder="Ajouter un commentaire du responsable…"></textarea>
      <span class="ljs-comment-owner">Commentaire distinct du commentaire technicien.</span>`;
    row.appendChild(responsibleField);

    const responsibleTextarea = responsibleField.querySelector('#adminResponsibleComment');
    responsibleTextarea.value = String(sheet.responsible_comment || '');
    responsibleTextarea.oninput = event => {
      sheet.responsible_comment = event.target.value;
    };
  }

  const baseRenderAdminEditor = window.renderAdminEditor;
  if (typeof baseRenderAdminEditor === 'function' && !baseRenderAdminEditor.__ljsResponsibleComments) {
    const wrapped = function(...args) {
      const result = baseRenderAdminEditor.apply(this, args);
      decorateComments();
      return result;
    };
    wrapped.__ljsResponsibleComments = true;
    window.renderAdminEditor = wrapped;
  }

  const baseSaveAdminSheet = window.saveAdminSheet;
  if (typeof baseSaveAdminSheet === 'function' && !baseSaveAdminSheet.__ljsResponsibleComments) {
    const wrapped = async function(...args) {
      const sheet = state?.adminSheet;
      if (sheet && typeof sheet.responsible_comment !== 'string') sheet.responsible_comment = '';

      const result = await baseSaveAdminSheet.apply(this, args);
      if (!sheet) return result;

      const message = document.getElementById('adminSaveMsg')?.textContent || '';
      const saved = message === 'Corrections enregistrées.' || message === 'Feuille validée par le responsable.';
      if (!saved || !isCloud) return result;

      const { error } = await sb
        .from('ljs_timesheets')
        .update({ responsible_comment: sheet.responsible_comment || '' })
        .eq('id', sheet.id);

      if (error) {
        console.error(error);
        const box = document.getElementById('adminSaveMsg');
        if (box) box.textContent = 'Erreur : le commentaire responsable n’a pas été enregistré.';
        alert('Impossible d’enregistrer le commentaire responsable : ' + (error.message || error));
      }
      return result;
    };
    wrapped.__ljsResponsibleComments = true;
    window.saveAdminSheet = wrapped;
  }

  installStyles();
})();
