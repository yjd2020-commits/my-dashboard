let state={version:'9.2',workspaces:[],projects:[],tasks:[],googleCalendarUrl:'',meta:{}};
let selected={type:null,id:null},view='active',editing=false,timer=null,dirty=false,workspaceEditId=null;
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const uid=p=>p+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
function status(t){$('sync-status').textContent=t}
function changed(){dirty=true;status('변경됨');clearTimeout(timer);timer=setTimeout(()=>save(false),5000)}
async function load(manual){try{state=await StorageEngine.load();dirty=false;render();status(manual?'불러오기 완료':'동기화 완료');$('last-save').textContent=state.meta?.updatedAt?'마지막 저장: '+new Date(state.meta.updatedAt).toLocaleString('ko-KR'):'마지막 저장: -'}catch(e){const b=StorageEngine.local();if(b){state=b;render();status('로컬 백업')}else status('연결 실패')}}
async function save(manual){try{status('저장 중');const t=await StorageEngine.save(state);dirty=false;$('last-save').textContent='마지막 저장: '+new Date(t).toLocaleString('ko-KR');status('저장 완료')}catch(e){status('저장 실패');if(manual)alert(e.message)}}
function setView(v){view=v;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===v));selected={type:null,id:null};render()}
function projectTasks(pid){return state.tasks.filter(t=>t.projectId===pid&&!t.deletedAt)}
function render(){CalendarUI.load(state.googleCalendarUrl);renderArchive();renderDetail()}
function renderArchive(){
  const q=$('search').value.trim().toLowerCase(),box=$('archive-list');
  if(view==='trash'){
    const rows=[...state.workspaces.filter(w=>w.deletedAt),...state.projects.filter(p=>p.deletedAt),...state.tasks.filter(t=>t.deletedAt)].filter(x=>!q||(x.title+' '+(x.memo||'')).toLowerCase().includes(q));
    box.innerHTML=rows.length?rows.map(x=>`<div class="workspace-head" onclick="selectItem('${x.projectId?'trashTask':x.workspaceId?'trashProject':'trashWorkspace'}','${x.id}')"><span class="workspace-dot" style="background:#c7c7cc"></span><span class="workspace-name" style="color:#6e6e73">${esc(x.title)}</span></div>`).join(''):'<div class="empty">휴지통이 비어 있습니다.</div>';return;
  }
  const workspaces=state.workspaces.filter(w=>!w.deletedAt).filter(w=>!q||w.title.toLowerCase().includes(q)||state.projects.some(p=>p.workspaceId===w.id&&!p.deletedAt&&(p.title+' '+projectTasks(p.id).map(t=>t.title+' '+(t.memo||'')).join(' ')).toLowerCase().includes(q)));
  box.innerHTML=workspaces.length?workspaces.map(w=>renderWorkspace(w,q)).join(''):'<div class="empty">표시할 항목이 없습니다.</div>';
}
function renderWorkspace(w,q){
  let ps=state.projects.filter(p=>p.workspaceId===w.id&&!p.deletedAt);
  if(view==='active')ps=ps.filter(p=>!p.completed);
  if(view==='completedProjects')ps=ps.filter(p=>p.completed);
  ps=ps.filter(p=>!q||(p.title+' '+projectTasks(p.id).map(t=>t.title+' '+(t.memo||'')).join(' ')).toLowerCase().includes(q));
  ps.sort((a,b)=>view==='active'?String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')):String(b.completedAt||'').localeCompare(String(a.completedAt||'')));
  return `<div class="workspace"><div class="workspace-head" onclick="selectItem('workspace','${w.id}')"><span class="workspace-dot" style="background:${w.color}"></span><span class="workspace-name">${esc(w.title)}</span><div class="workspace-actions"><button onclick="event.stopPropagation();openWorkspaceDialog('${w.id}')">수정</button></div></div>${ps.map(p=>renderProject(p)).join('')}</div>`;
}
function renderProject(p){
  let ts=projectTasks(p.id);
  if(view==='active')ts=ts.filter(t=>!t.completed);
  if(view==='completedTasks')ts=ts.filter(t=>t.completed);

  ts.sort((a,b)=>{
    if(view==='active' && !!a.urgent!==!!b.urgent) return a.urgent ? -1 : 1;
    return String(b.urgentAt||b.updatedAt||'').localeCompare(String(a.urgentAt||a.updatedAt||''));
  });

  return `<div class="project">
    <div class="project-row ${selected.type==='project'&&selected.id===p.id?'active':''}" onclick="selectItem('project','${p.id}')">
      <span class="project-dot"></span>
      <div class="project-main">
        <div class="project-title">${esc(p.title)}</div>
        <div class="meta">${ts.length}개 항목</div>
      </div>
    </div>
    ${ts.map(t=>`<div class="task-row ${t.completed?'done':''} ${selected.type==='task'&&selected.id===t.id?'active':''}" onclick="selectItem('task','${t.id}')">
      <input class="check" type="checkbox" ${t.completed?'checked':''} onclick="event.stopPropagation()" onchange="toggleTask('${t.id}',this.checked)">
      <div class="task-main">
        <div class="task-title">${esc(t.title)}</div>
        <div class="preview">${esc((t.memo||'메모 없음').replace(/\n/g,' '))}</div>
      </div>
      ${!t.completed?`<button class="urgent-star ${t.urgent?'on':''}" title="${t.urgent?'Urgent 해제':'Urgent 지정'}" onclick="event.stopPropagation();toggleTaskUrgent('${t.id}')">${t.urgent?'★':'☆'}</button>`:''}
    </div>`).join('')}
  </div>`;
}
function current(){if(selected.type==='workspace'||selected.type==='trashWorkspace')return state.workspaces.find(x=>x.id===selected.id);if(selected.type==='project'||selected.type==='trashProject')return state.projects.find(x=>x.id===selected.id);return state.tasks.find(x=>x.id===selected.id)}
function renderDetail(){
  const o=current();
  $('edit-item').classList.toggle('hidden',!o||selected.type.startsWith('trash'));
  $('save-edit').classList.add('hidden');
  $('cancel-edit').classList.add('hidden');

  if(!o){renderUrgent();return}

  if(selected.type==='workspace'){
    const ps=state.projects.filter(p=>p.workspaceId===o.id&&!p.deletedAt);
    $('detail').innerHTML=`<div class="detail">
      <h2>${esc(o.title)}</h2>
      <div class="pills"><span class="pill">${ps.length} Projects</span></div>
      <div class="memo">Workspace는 프로젝트를 묶는 상위 분류입니다.</div>
      <div class="danger"><button class="btn" onclick="trashWorkspace('${o.id}')">Workspace 삭제</button></div>
    </div>`;
  }else if(selected.type==='project'){
    const w=state.workspaces.find(x=>x.id===o.workspaceId);
    const all=projectTasks(o.id);
    const open=all.filter(t=>!t.completed).length;
    $('detail').innerHTML=`<div class="detail">
      <h2>${esc(o.title)}</h2>
      <div class="pills">
        <span class="pill">${esc(w?.title||'')}</span>
        <span class="pill">${o.completed?'완료':'진행'}</span>
      </div>
      <div class="memo">전체 ${all.length}개 · 미완료 ${open}개</div>
      <div class="row"><button class="btn" onclick="toggleProjectComplete('${o.id}')">${o.completed?'다시 진행':'완료 처리'}</button></div>
      <div class="danger"><button class="btn" onclick="trashProject('${o.id}')">프로젝트 삭제</button></div>
    </div>`;
  }else if(selected.type==='task'){
    const p=state.projects.find(x=>x.id===o.projectId);
    const w=state.workspaces.find(x=>x.id===p?.workspaceId);
    $('detail').innerHTML=`<div class="detail">
      <h2>${esc(o.title)}</h2>
      <div class="pills">
        <span class="pill">${esc(w?.title||'')}</span>
        <span class="pill">${esc(p?.title||'')}</span>
        <span class="pill">${o.completed?'완료':'진행'}</span>
        ${o.urgent&&!o.completed?'<span class="pill urgent-pill">Urgent</span>':''}
      </div>
      <div class="memo">${esc(o.memo||'메모 없음')}</div>
      ${!o.completed?`<div class="row"><button class="btn" onclick="toggleTaskUrgent('${o.id}')">${o.urgent?'Urgent 해제':'Urgent 지정'}</button></div>`:''}
      <div class="danger"><button class="btn" onclick="trashTask('${o.id}')">업무 삭제</button></div>
    </div>`;
  }else{
    $('detail').innerHTML=`<div class="detail">
      <h2>${esc(o.title)}</h2>
      <div class="row">
        <button class="btn" onclick="restore('${selected.type}','${o.id}')">복원</button>
        <button class="btn" onclick="erase('${selected.type}','${o.id}')">영구 삭제</button>
      </div>
    </div>`;
  }
}
function renderUrgent(){
  const urgentTasks=state.tasks
    .filter(t=>{
      if(t.deletedAt||t.completed||!t.urgent) return false;
      const p=state.projects.find(x=>x.id===t.projectId);
      return p && !p.deletedAt && !p.completed;
    })
    .sort((a,b)=>String(b.urgentAt||'').localeCompare(String(a.urgentAt||'')))
    .slice(0,8);

  $('detail').innerHTML=`<div class="detail">
    <h2>Urgent Tasks</h2>
    ${urgentTasks.length?urgentTasks.map(t=>{
      const p=state.projects.find(x=>x.id===t.projectId);
      const w=state.workspaces.find(x=>x.id===p?.workspaceId);
      return `<div class="urgent-card" onclick="selectItem('task','${t.id}')">
        <strong>${esc(t.title)}</strong>
        <div class="meta">${esc(w?.title||'')} · ${esc(p?.title||'')}</div>
      </div>`;
    }).join(''):'<div class="empty">Urgent Task가 없습니다.</div>'}
  </div>`;
}
function selectItem(type,id){if(editing&&!confirm('수정 내용을 취소할까요?'))return;editing=false;selected={type,id};renderArchive();renderDetail();if(window.matchMedia('(max-width:1100px)').matches)requestAnimationFrame(()=>document.querySelector('.content-panel')?.scrollIntoView({behavior:'smooth',block:'start'}))}
function toggleTaskUrgent(id){const t=state.tasks.find(x=>x.id===id);if(!t||t.completed||t.deletedAt)return;t.urgent=!t.urgent;t.urgentAt=t.urgent?StorageEngine.now():null;t.updatedAt=StorageEngine.now();changed();render()}
function toggleProjectComplete(id){const p=state.projects.find(x=>x.id===id);p.completed=!p.completed;p.completedAt=p.completed?StorageEngine.now():null;if(p.completed){view='completedProjects'}else view='active';changed();render()}
function toggleTask(id,v){const t=state.tasks.find(x=>x.id===id);t.completed=v;t.completedAt=v?StorageEngine.now():null;if(v){t.urgent=false;t.urgentAt=null}t.updatedAt=StorageEngine.now();changed();render()}
function trashWorkspace(id){const ps=state.projects.filter(p=>p.workspaceId===id&&!p.deletedAt);if(!confirm(`Workspace와 ${ps.length}개 프로젝트를 휴지통으로 이동할까요?`))return;state.workspaces.find(x=>x.id===id).deletedAt=StorageEngine.now();ps.forEach(p=>{p.deletedAt=StorageEngine.now();state.tasks.filter(t=>t.projectId===p.id).forEach(t=>t.deletedAt=StorageEngine.now())});selected={type:null,id:null};changed();render()}
function trashProject(id){if(!confirm('프로젝트를 휴지통으로 이동할까요?'))return;state.projects.find(x=>x.id===id).deletedAt=StorageEngine.now();state.tasks.filter(t=>t.projectId===id).forEach(t=>t.deletedAt=StorageEngine.now());selected={type:null,id:null};changed();render()}
function trashTask(id){state.tasks.find(x=>x.id===id).deletedAt=StorageEngine.now();selected={type:null,id:null};changed();render()}
function restore(type,id){if(type==='trashWorkspace'){state.workspaces.find(x=>x.id===id).deletedAt=null;state.projects.filter(p=>p.workspaceId===id).forEach(p=>{p.deletedAt=null;state.tasks.filter(t=>t.projectId===p.id).forEach(t=>t.deletedAt=null)})}else if(type==='trashProject'){state.projects.find(x=>x.id===id).deletedAt=null;state.tasks.filter(t=>t.projectId===id).forEach(t=>t.deletedAt=null)}else state.tasks.find(x=>x.id===id).deletedAt=null;selected={type:null,id:null};changed();render()}
function erase(type,id){if(prompt('영구 삭제하려면 DELETE 입력')!=='DELETE')return;if(type==='trashWorkspace'){const pids=state.projects.filter(p=>p.workspaceId===id).map(p=>p.id);state.workspaces=state.workspaces.filter(x=>x.id!==id);state.projects=state.projects.filter(x=>x.workspaceId!==id);state.tasks=state.tasks.filter(x=>!pids.includes(x.projectId))}else if(type==='trashProject'){state.projects=state.projects.filter(x=>x.id!==id);state.tasks=state.tasks.filter(x=>x.projectId!==id)}else state.tasks=state.tasks.filter(x=>x.id!==id);selected={type:null,id:null};changed();render()}
function openWorkspaceDialog(id=null){workspaceEditId=id;const w=id?state.workspaces.find(x=>x.id===id):null;$('workspace-title').value=w?.title||'';$('workspace-color').value=w?.color||'#007aff';$('workspace-dialog').showModal()}
function editMode(){const o=current();if(!o)return;editing=true;$('edit-item').classList.add('hidden');$('save-edit').classList.remove('hidden');$('cancel-edit').classList.remove('hidden');if(selected.type==='workspace')$('detail').innerHTML=`<label>이름<input id="e-title" value="${esc(o.title)}"></label><label>색상<select id="e-color">${['#007aff','#34c759','#af52de','#ff9500','#ff3b30','#5ac8fa','#8e8e93'].map(c=>`<option value="${c}" ${c===o.color?'selected':''}>${c}</option>`).join('')}</select></label>`;else if(selected.type==='project')$('detail').innerHTML=`<label>Workspace<select id="e-workspace">${state.workspaces.filter(w=>!w.deletedAt).map(w=>`<option value="${w.id}" ${w.id===o.workspaceId?'selected':''}>${esc(w.title)}</option>`).join('')}</select></label><label>프로젝트명<input id="e-title" value="${esc(o.title)}"></label>`;else $('detail').innerHTML=`<label>제목<input id="e-title" value="${esc(o.title)}"></label><label>메모<textarea id="e-memo">${esc(o.memo||'')}</textarea></label>`}
function saveEdit(){const o=current();o.title=$('e-title').value.trim()||'제목 없음';if(selected.type==='workspace')o.color=$('e-color').value;else if(selected.type==='project')o.workspaceId=$('e-workspace').value;else o.memo=$('e-memo').value;o.updatedAt=StorageEngine.now();editing=false;changed();render()}
function cancelEdit(){editing=false;renderDetail()}
document.addEventListener('DOMContentLoaded',async()=>{
  $('save-now').onclick=()=>save(true);$('load-now').onclick=()=>load(true);
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('new-workspace').onclick=()=>openWorkspaceDialog();
  $('workspace-form').onsubmit=e=>{e.preventDefault();const title=$('workspace-title').value.trim();if(!title)return;if(workspaceEditId){const w=state.workspaces.find(x=>x.id===workspaceEditId);w.title=title;w.color=$('workspace-color').value;w.updatedAt=StorageEngine.now()}else state.workspaces.push({id:uid('ws'),title,color:$('workspace-color').value,createdAt:StorageEngine.now(),updatedAt:StorageEngine.now(),deletedAt:null});$('workspace-dialog').close();changed();render()};
  $('new-project').onclick=()=>{const ws=state.workspaces.filter(w=>!w.deletedAt);if(!ws.length)return alert('Workspace를 먼저 생성하세요.');$('project-workspace').innerHTML=ws.map(w=>`<option value="${w.id}">${esc(w.title)}</option>`).join('');$('project-title').value='';$('project-dialog').showModal()};
  $('project-form').onsubmit=e=>{e.preventDefault();const title=$('project-title').value.trim();if(!title)return;const p={id:uid('project'),workspaceId:$('project-workspace').value,title,completed:false,completedAt:null,createdAt:StorageEngine.now(),updatedAt:StorageEngine.now(),deletedAt:null};state.projects.push(p);$('project-dialog').close();selected={type:'project',id:p.id};changed();render()};
  $('new-task').onclick=()=>{const ps=state.projects.filter(p=>!p.deletedAt&&!p.completed);if(!ps.length)return alert('진행 중 프로젝트가 없습니다.');$('task-project').innerHTML=ps.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('');$('task-title').value='';$('task-memo').value='';$('task-dialog').showModal()};
  $('task-form').onsubmit=e=>{e.preventDefault();const title=$('task-title').value.trim();if(!title)return;state.tasks.push({id:uid('task'),projectId:$('task-project').value,title,memo:$('task-memo').value,urgent:false,urgentAt:null,completed:false,completedAt:null,createdAt:StorageEngine.now(),updatedAt:StorageEngine.now(),deletedAt:null});$('task-dialog').close();changed();render()};
  $('search').oninput=renderArchive;$('edit-item').onclick=editMode;$('save-edit').onclick=saveEdit;$('cancel-edit').onclick=cancelEdit;
  $('cal-add').onclick=CalendarUI.add;$('cal-edit').onclick=CalendarUI.edit;$('cal-settings').onclick=()=>{const u=prompt('Google Calendar embed URL',state.googleCalendarUrl||'');if(u!==null){state.googleCalendarUrl=u.trim();changed();CalendarUI.load(state.googleCalendarUrl)}};
  $('excel-export').onclick=()=>ExcelIO.exportState(state);$('excel-import-btn').onclick=()=>$('excel-import').click();$('excel-import').onchange=e=>ExcelIO.importFile(e.target.files[0],data=>{state.workspaces=data.workspaces||state.workspaces;state.projects=data.projects||[];state.tasks=data.tasks||[];state.googleCalendarUrl=data.googleCalendarUrl||state.googleCalendarUrl;changed();render()});
  $('json-backup').onclick=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='JD_Workspace_v9_3_Backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href)};
  await load(false);StorageEngine.realtime(data=>{if(!dirty){state=data;render();status('자동 반영')}else status('다른 기기 변경 감지')});
});
window.selectItem=selectItem;window.toggleTaskUrgent=toggleTaskUrgent;window.toggleTask=toggleTask;window.toggleProjectComplete=toggleProjectComplete;window.trashWorkspace=trashWorkspace;window.trashProject=trashProject;window.trashTask=trashTask;window.restore=restore;window.erase=erase;window.openWorkspaceDialog=openWorkspaceDialog;
