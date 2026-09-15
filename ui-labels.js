function applyShortAbsentLabels(root=document){
  root.querySelectorAll('.absence-line label').forEach(label=>{
    if(label.textContent.trim()==='Technicien absent ce jour') label.textContent='Absent';
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  applyShortAbsentLabels();
  const app=document.getElementById('app');
  if(!app) return;
  const observer=new MutationObserver(()=>applyShortAbsentLabels(app));
  observer.observe(app,{childList:true,subtree:true});
});
