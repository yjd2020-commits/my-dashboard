
let state={version:9,projects:[],tasks:[],googleCalendarUrl:'',meta:{}};
let selected={type:null,id:null},view='active',editing=false,timer=null,dirty=false;
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid=p=>p+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
function status(t){$('sync-status').textContent=t}
function changed(){dirty=true;status('변경됨 · 자동 저장 대기');clearTimeout(timer);timer=setTimeout(()=>save(false),5000)}
async function load(manual){
  try{state=await StorageEngine.load();dirty=false;render();status(manual?'최신 데이터 불러옴':'동기화 완료');$('last-save').textContent=state.meta?.updatedAt?'마지막 저장: '+new Date(state.meta.updatedAt).toLocaleString('ko-KR'):'마지막 저장: -'}
  catch(e){const b=StorageEngine.local();if(b){state=b;render();status('로컬 백업으로 실행')}else status('클라우드 연결 실패')}
}
async function save(manual){try{status(manual?'저장 중':'자동 저장 중');const t=await StorageEngine.save(state);dirty=false;$('last-save').textContent='마지막 저장: '+new Date(t).toLocaleString('ko-KR');status(manual?'저장 완료':'자동 저장 완료')}catch(e){status('저장 실패 · 로컬 백업');if(manual)alert(e.message)}}
function setView(v){view=v;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===v));selected={type:null,id:null};render()}
function projectTasks(pid){return state.tasks.filter(t=>t.projectId===pid&&!t.deletedAt)}
function render(){
  CalendarUI.load(state.googleCalendarUrl);
  renderArchive();
  renderDetail();
}
function renderArchive(){
  const q=$('search').value.trim().toLowerCase(), box=$('archive-list');
  if(view==='trash'){
    const rows=[...state.projects.filter(p=>p.deletedAt),...state.tasks.filter(t=>t.deletedAt)].filter(x=>!q||(x.title+' '+(x.memo||'')).toLowerCase().includes(q));
    box.innerHTML=rows.length?'<div class="project">'+rows.map(x=>`<div class="trash-row ${selected.id===x.id?'active':''}" onclick="selectItem('${x.projectId?'trashTask':'trashProject'}','${x.id}')"><span>${x.projectId?'🗒️':'🗑️'}</span><div class="project-main"><div class="project-title">${esc(x.title)}</div><div class="meta">휴지통</div></div></div>`).join('')+'</div>':'<div class="empty">휴지통이 비어 있습니다.</div>';return;
  }
  let ps=state.projects.filter(p=>!p.deletedAt);
  if(view==='active')ps=ps.filter(p=>!p.completed);
  if(view==='completedProjects')ps=ps.filter(p=>p.completed);
  ps=ps.filter(p=>!q||p.title.toLowerCase().includes(q)||projectTasks(p.id).some(t=>(t.title+' '+(t.memo||'')).toLowerCase().includes(q)));
  ps.sort((a,b)=>view==='active'?(Number(b.urgent)-Number(a.urgent)||String(b.urgentAt||b.updatedAt).localeCompare(String(a.urgentAt||a.updatedAt))):String(b.completedAt||'').localeCompare(String(a.completedAt||'')));
  box.innerHTML=ps.length?ps.map(p=>{
    let ts=projectTasks(p.id);
    if(view==='active')ts=ts.filter(t=>!t.completed);
    if(view==='completedTasks')ts=ts.filter(t=>t.completed);
    if(view==='completedProjects')ts=projectTasks(p.id);
    return `<div class="project"><div class="project-row ${selected.type==='project'&&selected.id===p.id?'active':''}" onclick="selectItem('project','${p.id}')"><span>📁</span><div class="project-main"><div class="project-title">${esc(p.title)}</div><div class="meta">${esc(p.group)} · ${ts.length}개 항목</div></div>${!p.completed?`<button class="urgent-toggle ${p.urgent?'on':''}" type="button" title="${p.urgent?'Urgent 해제':'Urgent 지정'}" aria-label="${p.urgent?'Urgent 해제':'Urgent 지정'}" onclick="event.stopPropagation();toggleUrgent('${p.id}')">${p.urgent?'★':'☆'}</button>`:''}${p.urgent&&!p.completed?'<span class="badge urgent">Urgent</span>':''}<span class="badge group">${esc(p.group)}</span></div>${ts.map(t=>`<div class="task-row ${t.completed?'done':''} ${selected.type==='task'&&selected.id===t.id?'active':''}" onclick="selectItem('task','${t.id}')"><input class="check" type="checkbox" ${t.completed?'checked':''} onclick="event.stopPropagation()" onchange="toggleTask('${t.id}',this.checked)"><div class="task-main"><div class="task-title">${esc(t.title)}</div><div class="preview">${esc((t.memo||'작성된 메모가 없습니다.').replace(/\n/g,' '))}</div></div></div>`).join('')}</div>`;
  }).join(''):'<div class="empty">표시할 항목이 없습니다.</div>';
}
function current(){if(selected.type==='project'||selected.type==='trashProject')return state.projects.find(x=>x.id===selected.id);return state.tasks.find(x=>x.id===selected.id)}
function renderDetail(){
  const o=current();$('edit-item').classList.toggle('hidden',!o||selected.type.startsWith('trash'));$('save-edit').classList.add('hidden');$('cancel-edit').classList.add('hidden');
  if(!o){renderUrgent();return}
  if(selected.type==='project'){
    const all=projectTasks(o.id), open=all.filter(t=>!t.completed).length;
    $('detail').innerHTML=`<div class="detail"><h2>${esc(o.title)}</h2><div class="pills"><span class="pill">${esc(o.group)}</span><span class="pill">${o.completed?'완료 프로젝트':'진행 중'}</span>${o.urgent&&!o.completed?'<span class="badge urgent">Urgent</span>':''}</div><div class="memo">전체 업무 ${all.length}개 · 미완료 ${open}개</div><div class="row">${!o.completed?`<button class="btn ${o.urgent?'':'success'}" onclick="toggleUrgent('${o.id}')">${o.urgent?'Urgent 해제':'Urgent 지정'}</button>`:''}<button class="btn success" onclick="toggleProjectComplete('${o.id}')">${o.completed?'프로젝트 다시 진행':'프로젝트 완료 처리'}</button></div><div class="danger"><button class="btn" onclick="trashProject('${o.id}')">휴지통으로 이동</button></div></div>`;
  }else if(selected.type==='task'){
    const p=state.projects.find(x=>x.id===o.projectId);
    $('detail').innerHTML=`<div class="detail"><h2>${esc(o.title)}</h2><div class="pills"><span class="pill">${esc(p?.title||'미분류')}</span><span class="pill">${o.completed?'완료':'진행 중'}</span></div><div class="memo">${esc(o.memo||'작성된 메모가 없습니다.')}</div><div class="danger"><button class="btn" onclick="trashTask('${o.id}')">휴지통으로 이동</button></div></div>`;
  }else{
    $('detail').innerHTML=`<div class="detail"><h2>${esc(o.title)}</h2><div class="memo">${esc(o.memo||'휴지통 항목입니다.')}</div><div class="row"><button class="btn success" onclick="restore('${selected.type}','${o.id}')">복원</button><button class="btn" onclick="erase('${selected.type}','${o.id}')">영구 삭제</button></div></div>`;
  }
}
function renderUrgent(){
  const urgent=state.projects.filter(p=>!p.deletedAt&&!p.completed&&p.urgent).sort((a,b)=>String(b.urgentAt||'').localeCompare(String(a.urgentAt||''))).slice(0,5);
  $('detail').innerHTML=`<div class="detail"><h2>Urgent Projects</h2><div class="pills"><span class="pill">오늘의 집중 프로젝트</span></div>${urgent.length?urgent.map(p=>{const open=projectTasks(p.id).filter(t=>!t.completed).length;return `<div class="urgent-card" onclick="selectItem('project','${p.id}')"><div class="row" style="justify-content:space-between"><strong>${esc(p.title)}</strong><span class="badge urgent">Urgent</span></div><div class="meta">미완료 업무 ${open}개 · ${esc(p.group)}</div></div>`}).join(''):'<div class="empty">현재 지정된 Urgent 프로젝트가 없습니다.</div>'}</div>`;
}
function selectItem(type,id){
  if(editing&&!confirm('수정 내용을 취소하고 이동할까요?'))return;
  editing=false;
  selected={type,id};
  renderArchive();
  renderDetail();
  if(window.matchMedia('(max-width:1100px)').matches){
    requestAnimationFrame(()=>document.querySelector('.detail-panel')?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
}
window.selectItem=selectItem;
function toggleUrgent(id){
  const p=state.projects.find(x=>x.id===id);
  if(!p || p.completed || p.deletedAt) return;
  p.urgent=!p.urgent;
  p.urgentAt=p.urgent?StorageEngine.now():null;
  p.updatedAt=StorageEngine.now();
  changed();
  render();
}
window.toggleUrgent=toggleUrgent;
function toggleProjectComplete(id){const p=state.projects.find(x=>x.id===id);p.completed=!p.completed;p.completedAt=p.completed?StorageEngine.now():null;if(p.completed){p.urgent=false;p.urgentAt=null;view='completedProjects'}else view='active';changed();render()}
function toggleTask(id,v){const t=state.tasks.find(x=>x.id===id);t.completed=v;t.completedAt=v?StorageEngine.now():null;t.updatedAt=StorageEngine.now();changed();render()}
function trashProject(id){if(!confirm('프로젝트와 내부 업무를 휴지통으로 이동할까요?'))return;state.projects.find(x=>x.id===id).deletedAt=StorageEngine.now();state.tasks.filter(t=>t.projectId===id).forEach(t=>t.deletedAt=StorageEngine.now());selected={type:null,id:null};changed();render()}
function trashTask(id){if(!confirm('업무를 휴지통으로 이동할까요?'))return;state.tasks.find(x=>x.id===id).deletedAt=StorageEngine.now();selected={type:null,id:null};changed();render()}
function restore(type,id){if(type==='trashProject'){state.projects.find(x=>x.id===id).deletedAt=null;state.tasks.filter(t=>t.projectId===id).forEach(t=>t.deletedAt=null)}else state.tasks.find(x=>x.id===id).deletedAt=null;selected={type:null,id:null};changed();render()}
function erase(type,id){if(prompt('영구 삭제하려면 DELETE 입력')!=='DELETE')return;if(type==='trashProject'){state.projects=state.projects.filter(x=>x.id!==id);state.tasks=state.tasks.filter(x=>x.projectId!==id)}else state.tasks=state.tasks.filter(x=>x.id!==id);selected={type:null,id:null};changed();render()}
function editMode(){const o=current();if(!o)return;editing=true;$('edit-item').classList.add('hidden');$('save-edit').classList.remove('hidden');$('cancel-edit').classList.remove('hidden');if(selected.type==='project')$('detail').innerHTML=`<label>그룹<select id="e-group">${['회사','KIA','자문','대학','Five Senses','UIA','개인','기타'].map(g=>`<option ${g===o.group?'selected':''}>${g}</option>`).join('')}</select></label><label>프로젝트명<input id="e-title" value="${esc(o.title)}"></label>`;else $('detail').innerHTML=`<label>제목<input id="e-title" value="${esc(o.title)}"></label><label>메모<textarea id="e-memo">${esc(o.memo||'')}</textarea></label>`}
function saveEdit(){const o=current();o.title=$('e-title').value.trim()||'제목 없음';if(selected.type==='project')o.group=$('e-group').value;else o.memo=$('e-memo').value;o.updatedAt=StorageEngine.now();editing=false;changed();render()}
function cancelEdit(){editing=false;renderDetail()}

window.toggleTask=toggleTask;
window.toggleProjectComplete=toggleProjectComplete;
window.trashProject=trashProject;
window.trashTask=trashTask;
window.restore=restore;
window.erase=erase;

document.addEventListener('DOMContentLoaded',async()=>{
  $('save-now').onclick=()=>save(true);$('load-now').onclick=()=>load(true);
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $('new-project').onclick=()=>{$('project-title').value='';$('project-dialog').showModal()};
  $('create-project').onclick=e=>{e.preventDefault();const title=$('project-title').value.trim();if(!title)return;const p={id:uid('project'),title,group:$('project-group').value,urgent:false,urgentAt:null,completed:false,completedAt:null,createdAt:StorageEngine.now(),updatedAt:StorageEngine.now(),deletedAt:null};state.projects.push(p);$('project-dialog').close();selected={type:'project',id:p.id};changed();render()};
  $('new-task').onclick=()=>{const ps=state.projects.filter(p=>!p.deletedAt&&!p.completed);if(!ps.length)return alert('진행 중 프로젝트가 없습니다.');$('task-project').innerHTML=ps.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('');$('task-title').value='';$('task-memo').value='';$('task-dialog').showModal()};
  $('create-task').onclick=e=>{e.preventDefault();const title=$('task-title').value.trim();if(!title)return;const t={id:uid('task'),projectId:$('task-project').value,title,memo:$('task-memo').value,completed:false,completedAt:null,createdAt:StorageEngine.now(),updatedAt:StorageEngine.now(),deletedAt:null};state.tasks.push(t);$('task-dialog').close();selected={type:'task',id:t.id};changed();render()};
  $('search').oninput=renderArchive;$('edit-item').onclick=editMode;$('save-edit').onclick=saveEdit;$('cancel-edit').onclick=cancelEdit;
  $('cal-add').onclick=CalendarUI.add;$('cal-edit').onclick=CalendarUI.edit;$('cal-settings').onclick=()=>{const u=prompt('Google Calendar embed URL',state.googleCalendarUrl||'');if(u!==null){state.googleCalendarUrl=u.trim();changed();CalendarUI.load(state.googleCalendarUrl)}};
  $('excel-export').onclick=()=>ExcelIO.exportState(state);$('excel-import-btn').onclick=()=>$('excel-import').click();$('excel-import').onchange=e=>ExcelIO.importFile(e.target.files[0],data=>{state.projects=data.projects;state.tasks=data.tasks;state.googleCalendarUrl=data.googleCalendarUrl||state.googleCalendarUrl;changed();render()});
  $('json-backup').onclick=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='JD_Workspace_v9_Backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(a.href)};
  await load(false);
  StorageEngine.realtime(data=>{if(!dirty){state=data;render();status('다른 기기 변경 자동 반영')}else status('다른 기기 변경 감지')});
});
