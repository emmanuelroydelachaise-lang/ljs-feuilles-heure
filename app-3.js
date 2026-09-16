async function showWeek() {
  cloneTemplate('weekTemplate');
  await loadReferenceData(true);
  document.getElementById('who').textContent = currentProfile.full_name;
  const weekInput = document.getElementById('weekInput');
  weekInput.value = currentWeekValue();
  document.getElementById('logoutBtn').onclick = logout;
  weekInput.onchange = async () => { await loadSheet(mondayOfWeekValue(weekInput.value)); renderWeek(); };
  await loadSheet(mondayOfWeekValue(weekInput.value));
  renderWeek();
}
function renderWeek() {
  const s = state.sheet;
  const vehicle = document.getElementById('vehicleSelect');
  vehicle.innerHTML='';
  vehicle.add(new Option('— Aucun véhicule —',''));
  state.vehicles.filter(v=>v.active !== false || v.id===s.vehicle_id).forEach(v=>vehicle.add(new Option(v.registration,v.id)));
  if (s.vehicle_id && !state.vehicles.some(v=>v.id===s.vehicle_id)) vehicle.add(new Option('Véhicule historique',s.vehicle_id));
  vehicle.value = s.vehicle_id || '';
  const locked = s.status === 'submitted' || s.status === 'approved';
  vehicle.disabled = locked;
  document.getElementById('weekComment').value = s.general_comment || '';
  document.getElementById('weekComment').disabled = locked;
  const badge = document.getElementById('statusBadge');
  badge.textContent = s.status === 'submitted' ? 'Validée technicien / en attente responsable' : s.status === 'approved' ? 'Validée par le responsable' : 'En cours';
  badge.className = 'badge ' + (locked ? 'submitted' : 'draft');
  document.getElementById('saveBtn').disabled = locked;
  document.getElementById('submitBtn').disabled = locked;
  document.getElementById('submitBtn').textContent = locked ? (s.status==='approved'?'Feuille validée':'Semaine déjà validée') : 'Signer et valider la semaine';
  document.getElementById('saveBtn').onclick = () => saveWeek(false);
  document.getElementById('submitBtn').onclick = () => saveWeek(true);
  document.getElementById('printTechBtn').onclick = () => printTimesheet(s, currentProfile.full_name);
  vehicle.onchange = () => { s.vehicle_id = vehicle.value; };
  document.getElementById('weekComment').oninput = e => { s.general_comment = e.target.value; };
  const days = document.getElementById('days');
  days.innerHTML='';
  s.days.slice(0,6).forEach((d, idx) => days.append(renderDay(d, idx, locked)));
  renderTechSignature(locked);
  updateTotals();
}
function projectOptions(selected, allowInactive=false) {
  const normal=state.projects.filter(p=>allowInactive || p.active !== false || p.id===selected).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('');
  return normal + `<option value="${OTHER_PROJECT_ID}" ${selected===OTHER_PROJECT_ID?'selected':''}>AUTRE — Saisie manuelle</option>`;
}
function renderDay(day, dayIndex, locked) {
  const sec = document.createElement('section');
  sec.className = 'card day-card' + (locked?' locked':'') + (day.absent?' absent':'');
  sec.innerHTML = `
    <div class="day-title"><h3>${esc(formatDayTitle(day.date))}</h3><div class="day-total" data-day-total="${dayIndex}">0,00 h</div></div>
    <div class="absence-line"><input class="absent-check" type="checkbox" ${day.absent?'checked':''} ${locked?'disabled':''}><label>Technicien absent ce jour</label></div>
    <div class="work-list"></div>
    <button class="secondary add-row" ${locked||day.absent?'disabled':''}>+ Ajouter un chantier</button>
    <div class="zone-only">
      <div><label>Zone trajet</label><select class="zone" ${locked||day.absent?'disabled':''}>${[0,1,2,3,4,5].map(z=>`<option value="${z}" ${Number(day.zone)===z?'selected':''}>Zone ${z}</option>`).join('')}</select></div>
    </div>`;
  const list = sec.querySelector('.work-list');
  function redrawEntries() {
    list.innerHTML='';
    day.entries.forEach((e, entryIndex)=>{
      e.manual_project_code=e.manual_project_code||''; e.manual_project_name=e.manual_project_name||'';
      const disabled=locked||day.absent;
      const row = document.createElement('div');
      row.className='work-row';
      row.innerHTML = `
        <div><label>Chantier</label><select class="project" ${disabled?'disabled':''}>${projectOptions(e.project_id)}</select></div>
        <div><label>Heures</label><input class="hours" type="number" min="0" max="24" step="0.25" value="${e.hours || ''}" inputmode="decimal" ${disabled?'disabled':''}></div>
        <button class="remove" title="Supprimer" ${disabled?'disabled':''}>×</button>
        <div class="manual-project-fields ${e.project_id===OTHER_PROJECT_ID?'':'hidden'}">
          <div><label>N° affaire / réf. (facultatif)</label><input class="manual-code" value="${esc(e.manual_project_code)}" placeholder="AUTRE" ${disabled?'disabled':''}></div>
          <div><label>Nom du chantier / intervention</label><input class="manual-name" value="${esc(e.manual_project_name)}" placeholder="Saisir le chantier manuellement" ${disabled?'disabled':''}></div>
        </div>`;
      row.querySelector('.project').onchange = ev => { e.project_id = ev.target.value; if(e.project_id!==OTHER_PROJECT_ID){e.manual_project_code='';e.manual_project_name='';} redrawEntries(); };
      row.querySelector('.hours').oninput = ev => { e.hours = Math.max(0, Number(ev.target.value || 0)); updateTotals(); };
      row.querySelector('.manual-code').oninput=ev=>{e.manual_project_code=ev.target.value;};
      row.querySelector('.manual-name').oninput=ev=>{e.manual_project_name=ev.target.value;};
      row.querySelector('.remove').onclick = () => {
        if (day.entries.length===1) { day.entries[0]={project_id:state.projects[0]?.id||'',manual_project_code:'',manual_project_name:'',hours:0}; redrawEntries(); updateTotals(); return; }
        day.entries.splice(entryIndex,1); redrawEntries(); updateTotals();
      };
      list.append(row);
    });
  }
  redrawEntries();
  sec.querySelector('.add-row').onclick = () => { day.entries.push({project_id:state.projects[0]?.id||'',manual_project_code:'',manual_project_name:'',hours:0}); redrawEntries(); };
  sec.querySelector('.zone').onchange = e => { day.zone = Number(e.target.value); };
  sec.querySelector('.absent-check').onchange=e=>{
    day.absent=e.target.checked;
    sec.classList.toggle('absent',day.absent);
    if(day.absent){day.zone=0;day.entries.forEach(x=>x.hours=0);sec.querySelector('.zone').value='0';}
    redrawEntries();
    sec.querySelector('.add-row').disabled=locked||day.absent;
    sec.querySelector('.zone').disabled=locked||day.absent;
    updateTotals();
  };
  return sec;
}
function updateTotals() {
  let w=0;
  state.sheet.days.forEach((d,i)=>{
    const t=totalDay(d); w+=t;
    const el=document.querySelector(`[data-day-total="${i}"]`);
    if(el) el.textContent=fmtHours(t);
  });
  const weekEl = document.getElementById('weekTotal');
  if (weekEl) weekEl.textContent = fmtHours(w);
}
function renderTechSignature(locked) {
  const canvas = document.getElementById('techSignatureCanvas');
  const img = document.getElementById('techSignatureImage');
  const clear = document.getElementById('clearTechSignature');
  if (locked) {
    canvas.classList.add('hidden');
    clear.classList.add('hidden');
    if (state.sheet.technician_signature) {
      img.src = state.sheet.technician_signature;
      img.classList.remove('hidden');
    } else {
      img.classList.add('hidden');
    }
    return;
  }
  img.classList.add('hidden');
  canvas.classList.remove('hidden');
  clear.classList.remove('hidden');
  initSignaturePad(canvas, state.sheet.technician_signature, data => { state.sheet.technician_signature = data; });
  clear.onclick = () => {
    clearSignatureCanvas(canvas);
    state.sheet.technician_signature = '';
  };
}
function initSignaturePad(canvas, initialData, onChange, strokeColor='#111') {
  const ctx = canvas.getContext('2d');
  clearSignatureCanvas(canvas);
  if (initialData) {
    const im = new Image();
    im.onload = () => ctx.drawImage(im,0,0,canvas.width,canvas.height);
    im.src = initialData;
  }
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = strokeColor;
  let drawing = false;
  const pos = ev => {
    const r=canvas.getBoundingClientRect();
    return {x:(ev.clientX-r.left)*canvas.width/r.width, y:(ev.clientY-r.top)*canvas.height/r.height};
  };
  canvas.onpointerdown = ev => {
    drawing=true;
    canvas.setPointerCapture(ev.pointerId);
    const p=pos(ev); ctx.beginPath(); ctx.moveTo(p.x,p.y);
    ev.preventDefault();
  };
  canvas.onpointermove = ev => {
    if(!drawing) return;
    const p=pos(ev); ctx.lineTo(p.x,p.y); ctx.stroke();
    ev.preventDefault();
  };
  const end = ev => {
    if(!drawing) return;
    drawing=false;
    try { canvas.releasePointerCapture(ev.pointerId); } catch(_) {}
    onChange(canvas.toDataURL('image/png'));
    ev.preventDefault();
  };
  canvas.onpointerup=end;
  canvas.onpointercancel=end;
  canvas.onpointerleave=ev=>{ if(drawing && ev.buttons===0) end(ev); };
}
function clearSignatureCanvas(canvas) {
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
}
async function saveWeek(submit) {
  const s = state.sheet;
  s.vehicle_id = document.getElementById('vehicleSelect').value || null;
  s.general_comment = document.getElementById('weekComment').value.trim();
  if (submit) {
    const total = totalWeek(s);
    if (total <= 0 && !s.days.some(d=>d.absent)) { alert('Impossible de valider une semaine sans aucune heure ni absence renseignée.'); return; }
    if (!s.technician_signature) { alert('Le technicien doit signer la feuille avant de la valider.'); return; }
    if (!confirm(`Signer et valider définitivement cette semaine (${fmtHours(total)}) ? Après validation, le technicien ne pourra plus la modifier.`)) return;
    s.status = 'submitted';
    s.submitted_at = new Date().toISOString();
  }
  const invalidOther=s.days.some(d=>!d.absent && d.entries.some(e=>Number(e.hours)>0 && e.project_id===OTHER_PROJECT_ID && !String(e.manual_project_name||'').trim()));
  if(invalidOther){alert('Pour « Chantier autre », renseigne le nom du chantier ou de l’intervention.');return;}
  const msg = document.getElementById('saveMsg');
  msg.textContent='Enregistrement…';
  try {
    if (!isCloud) {
      const db = demoDb();
      const idx = db.sheets.findIndex(x=>x.technician_id===s.technician_id && x.week_start===s.week_start);
      if (idx>=0) db.sheets[idx]=deepClone(s); else { s.id='ts_'+Date.now(); db.sheets.push(deepClone(s)); }
      saveDemoDb(db);
    } else {
      const payload = {
        technician_id:currentProfile.id,
        week_start:s.week_start,
        vehicle_id:s.vehicle_id||null,
        general_comment:s.general_comment,
        status:submit?'draft':s.status,
        submitted_at:submit?null:(s.submitted_at||null),
        technician_signature:s.technician_signature||null
      };
      const { data:ts, error } = await sb.from('ljs_timesheets').upsert(payload,{onConflict:'technician_id,week_start'}).select().single();
      if (error) throw error;
      s.id=ts.id;
      const ddel=await sb.from('ljs_day_entries').delete().eq('timesheet_id',s.id); if(ddel.error) throw ddel.error;
      const wdel=await sb.from('ljs_work_entries').delete().eq('timesheet_id',s.id); if(wdel.error) throw wdel.error;
      const dayRows = s.days.map(d=>({timesheet_id:s.id,work_date:d.date,travel_zone:d.absent?0:d.zone,absent:Boolean(d.absent),comment:d.comment||''}));
      const workRows = s.days.flatMap(d=>d.absent?[]:d.entries.filter(e=>Number(e.hours)>0 && e.project_id && (e.project_id!==OTHER_PROJECT_ID || e.manual_project_name.trim())).map(e=>({timesheet_id:s.id,work_date:d.date,project_id:e.project_id===OTHER_PROJECT_ID?null:e.project_id,manual_project_code:e.project_id===OTHER_PROJECT_ID?(e.manual_project_code||null):null,manual_project_name:e.project_id===OTHER_PROJECT_ID?(e.manual_project_name||null):null,hours:Number(e.hours)})));
      const de = await sb.from('ljs_day_entries').insert(dayRows); if(de.error) throw de.error;
      if(workRows.length){ const we=await sb.from('ljs_work_entries').insert(workRows); if(we.error) throw we.error; }
      if(submit){
        const lock=await sb.from('ljs_timesheets').update({status:'submitted',submitted_at:s.submitted_at||new Date().toISOString(),technician_signature:s.technician_signature||null}).eq('id',s.id);
        if(lock.error) throw lock.error;
      }
    }
    msg.textContent = submit ? 'Semaine signée, validée et verrouillée.' : 'Enregistré.';
    if (submit) renderWeek();
  } catch(e) {
    console.error(e);
    msg.textContent='Erreur : '+(e.message||e);
  }
}
