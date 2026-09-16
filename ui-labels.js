function applyShortAbsentLabels(root=document){
  root.querySelectorAll('.absence-line label').forEach(label=>{
    if(label.textContent.trim()==='Technicien absent ce jour') label.textContent='Absent';
  });
}

function applyZonePlaceholderLabels(root=document){
  root.querySelectorAll('select.zone option[value="0"], select.admin-zone option[value="0"]').forEach(option=>{
    if(option.textContent.trim()!=='Sélectionner zone') option.textContent='Sélectionner zone';
  });
}

function applyUiLabels(root=document){
  applyShortAbsentLabels(root);
  applyZonePlaceholderLabels(root);
}

function loadTechnicianAdminChanges(){
  if(!document.querySelector('link[data-tech-admin-changes]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./technician-admin-changes.css?v=20260916-tech-red-1';
    link.dataset.techAdminChanges='1';
    document.head.appendChild(link);
  }
  if(!document.querySelector('script[data-tech-admin-changes]')){
    const script=document.createElement('script');
    script.src='./technician-admin-changes.js?v=20260916-tech-red-1';
    script.dataset.techAdminChanges='1';
    script.async=false;
    document.head.appendChild(script);
  }
}

function loadAdminArchiveNavigation(){
  if(document.querySelector('script[data-admin-archive-navigation]')) return;
  const script=document.createElement('script');
  script.src='./admin-archive-navigation.js?v=20260916-archives-bottom-1';
  script.dataset.adminArchiveNavigation='1';
  script.async=false;
  document.head.appendChild(script);
}

function loadLeavePdfTools(){
  const loadButtons=()=>{
    if(document.querySelector('script[data-leave-pdf-buttons]')) return;
    const buttons=document.createElement('script');
    buttons.src='./leave-pdf-buttons.js?v=20260916-leave-pdf-3';
    buttons.dataset.leavePdfButtons='1';
    buttons.async=false;
    document.head.appendChild(buttons);
  };

  if(window.downloadLeaveRequestPdf){
    loadButtons();
    return;
  }

  let pdf=document.querySelector('script[data-leave-pdf]');
  if(pdf){
    pdf.addEventListener('load',loadButtons,{once:true});
    return;
  }

  pdf=document.createElement('script');
  pdf.src='./leave-pdf.js?v=20260916-leave-pdf-3';
  pdf.dataset.leavePdf='1';
  pdf.async=false;
  pdf.addEventListener('load',loadButtons,{once:true});
  document.head.appendChild(pdf);
}

document.addEventListener('DOMContentLoaded',()=>{
  applyUiLabels();
  loadTechnicianAdminChanges();
  loadAdminArchiveNavigation();
  loadLeavePdfTools();
  const app=document.getElementById('app');
  if(!app) return;
  const observer=new MutationObserver(()=>applyUiLabels(app));
  observer.observe(app,{childList:true,subtree:true});
});
