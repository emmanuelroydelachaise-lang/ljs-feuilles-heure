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
    btn.title='Réinitialiser complètement la feuille de cette semaine';
    btn.onclick=()=>resetAdminTimesheet(account);
    actions.append(btn);
  });
}

async function resetAdminTimesheet(account){
  const weekInput=document.getElementById('adminWeekInput');
  if(!weekInput) return;
  const weekStart=mondayOfWeekValue(weekInput.value);
  const message=`Réinitialiser complètement la feuille de ${account.full_name} pour cette semaine ?\n\nToutes les heures, absences, zones trajet, commentaires et signatures seront effacés. La feuille repassera en brouillon.`;
  if(!confirm(message)) return;
  try{
    if(!isCloud){
      const db=demoDb();
      const s=db.sheets.find(x=>x.technician_id===account.id && x.week_start===weekStart);
      if(!s){alert('Aucune feuille à réinitialiser.');return;}
      s.vehicle_id='';
      s.general_comment='';
      s.status='draft';
      s.submitted_at=null;
      s.approved_at=null;
      s.technician_signature='';
      s.responsible_signature='';
      s.responsible_name='';
      s.admin_changes=[];
      s.days=DAYS.map((name,i)=>({
        date:dateForDay(weekStart,i),name,zone:0,absent:false,comment:'',
        entries:[{project_id:state.projects[0]?.id||'',manual_project_code:'',manual_project_name:'',hours:0}]
      }));
      saveDemoDb(db);
    } else {
      const {data:ts,error}=await sb.from('ljs_timesheets').select('id').eq('technician_id',account.id).eq('week_start',weekStart).maybeSingle();
      if(error) throw error;
      if(!ts){alert('Aucune feuille à réinitialiser.');return;}
      const upd=await sb.from('ljs_timesheets').update({
        vehicle_id:null,
        general_comment:'',
        status:'draft',
        submitted_at:null,
        approved_at:null,
        technician_signature:null,
        responsible_signature:null,
        responsible_name:null,
        admin_changes:[]
      }).eq('id',ts.id);
      if(upd.error) throw upd.error;
      const ddel=await sb.from('ljs_day_entries').delete().eq('timesheet_id',ts.id);
      if(ddel.error) throw ddel.error;
      const wdel=await sb.from('ljs_work_entries').delete().eq('timesheet_id',ts.id);
      if(wdel.error) throw wdel.error;
      if(state.adminSheet?.id===ts.id){
        state.adminSheet=null;
        document.getElementById('adminEditor')?.classList.add('hidden');
      }
    }
    await refreshAdmin();
    alert(`La feuille de ${account.full_name} a été réinitialisée.`);
  }catch(e){
    console.error(e);
    alert('Impossible de réinitialiser la feuille : '+(e.message||e));
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const app=document.getElementById('app');
  if(!app) return;
  const observer=new MutationObserver(()=>enhanceAdminResetButtons());
  observer.observe(app,{childList:true,subtree:true});
});
