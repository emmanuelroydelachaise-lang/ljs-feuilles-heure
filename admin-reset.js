function enhanceAdminResetButtons(){
  const box=document.getElementById('adminTimesheets');
  if(!box) return;
  const rows=[...box.querySelectorAll('.admin-sheet-row')];
  rows.forEach((row,index)=>{
    if(row.querySelector('.reset-sheet')) return;
    if(!row.querySelector('.open-sheet')) return;
    const account=state.technicians[index];
    const actions=row.querySelector('.admin-row-actions');
    if(!account||!actions) return;
    const btn=document.createElement('button');
    btn.className='secondary reset-sheet';
    btn.textContent='RAZ feuille';
    btn.title='Supprimer complètement la feuille de cette semaine';
    btn.onclick=()=>resetAdminTimesheet(account);
    actions.append(btn);
  });
}

async function resetAdminTimesheet(account){
  const weekInput=document.getElementById('adminWeekInput');
  if(!weekInput) return;
  const weekStart=mondayOfWeekValue(weekInput.value);
  const message=`Supprimer définitivement la feuille de ${account.full_name} pour cette semaine ?\n\nToutes les heures, absences, zones trajet, commentaires et signatures seront supprimés. La ligne repassera ensuite à « Aucune feuille ».\n\nCette action est irréversible.`;
  if(!confirm(message)) return;
  try{
    if(!isCloud){
      const db=demoDb();
      const idx=db.sheets.findIndex(x=>x.technician_id===account.id && x.week_start===weekStart);
      if(idx<0){alert('Aucune feuille à supprimer.');return;}
      db.sheets.splice(idx,1);
      saveDemoDb(db);
    } else {
      const {data:ts,error}=await sb.from('ljs_timesheets').select('id').eq('technician_id',account.id).eq('week_start',weekStart).maybeSingle();
      if(error) throw error;
      if(!ts){alert('Aucune feuille à supprimer.');return;}

      const wdel=await sb.from('ljs_work_entries').delete().eq('timesheet_id',ts.id);
      if(wdel.error) throw wdel.error;
      const ddel=await sb.from('ljs_day_entries').delete().eq('timesheet_id',ts.id);
      if(ddel.error) throw ddel.error;
      const tdel=await sb.from('ljs_timesheets').delete().eq('id',ts.id);
      if(tdel.error) throw tdel.error;

      if(state.adminSheet?.id===ts.id){
        state.adminSheet=null;
        document.getElementById('adminEditor')?.classList.add('hidden');
      }
    }
    await refreshAdmin();
    alert(`La feuille de ${account.full_name} a été supprimée.`);
  }catch(e){
    console.error(e);
    alert('Impossible de supprimer la feuille : '+(e.message||e));
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const app=document.getElementById('app');
  if(!app) return;
  const observer=new MutationObserver(()=>enhanceAdminResetButtons());
  observer.observe(app,{childList:true,subtree:true});
});
