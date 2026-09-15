// Affichage des chantiers côté responsable : seuls les chantiers actifs sont visibles.
// "Supprimer" désactive le chantier afin de préserver les anciennes feuilles d'heures.
renderAdminProjects = async function() {
  const box=document.getElementById('adminProjects');
  if(!box) return;
  box.innerHTML='';

  let projects=[];
  if(!isCloud){
    projects=(demoDb().projects||[]).filter(p=>p.active!==false);
  } else {
    const {data,error}=await sb.from('ljs_projects').select('*').eq('active',true).order('code');
    if(error){
      box.innerHTML=`<p class="error">${esc(error.message)}</p>`;
      return;
    }
    projects=data||[];
  }

  if(!projects.length){
    box.innerHTML='<p class="hint">Aucun chantier actif.</p>';
    return;
  }

  projects.forEach(p=>{
    const el=document.createElement('div');
    el.className='admin-item';
    el.innerHTML=`
      <div><strong>${esc(p.code)} — ${esc(p.name)}</strong></div>
      <button class="secondary delete-project">Supprimer</button>`;

    el.querySelector('.delete-project').onclick=async()=>{
      if(!confirm(`Supprimer le chantier ${p.code} — ${p.name} de la liste ?\n\nIl disparaîtra de l'onglet responsable mais restera conservé dans les anciennes feuilles d'heures.`)) return;
      try{
        if(!isCloud){
          const db=demoDb();
          const x=db.projects.find(x=>x.id===p.id);
          if(x) x.active=false;
          saveDemoDb(db);
        } else {
          const {error}=await sb.from('ljs_projects').update({active:false}).eq('id',p.id);
          if(error) throw error;
        }
        await refreshAdmin();
      }catch(e){
        alert('Impossible de supprimer le chantier : '+(e.message||e));
      }
    };
    box.append(el);
  });
};
