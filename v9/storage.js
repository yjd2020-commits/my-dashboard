
window.StorageEngine=(()=>{
  const SUPABASE_URL='https://janalakgduwqoyzimuku.supabase.co';
  const SUPABASE_KEY='sb_publishable_5bYHyOYBYE8aeOLpB9TYEw_-5mXb6Bi';
  const USER='yjd2020';
  const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{apikey:SUPABASE_KEY}}});
  const deviceId=localStorage.getItem('jd-device-id')||('dev-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  localStorage.setItem('jd-device-id',deviceId);
  const now=()=>new Date().toISOString();
  function defaults(){
    const groups=['회사','KIA','자문','대학','Five Senses','UIA'];
    return {version:9,projects:groups.map((g,i)=>({id:'seed-'+i,title:g,group:g,urgent:false,urgentAt:null,completed:false,completedAt:null,createdAt:now(),updatedAt:now(),deletedAt:null})),tasks:[],googleCalendarUrl:'',meta:{}};
  }
  function migrate(c){
    if(!c)return defaults();
    if(c.version===9)return c;
    const out={version:9,projects:[],tasks:[],googleCalendarUrl:c.googleCalendarUrl||'',meta:c.meta||{}};
    if(Array.isArray(c.directories)){
      out.projects=c.directories.map(d=>({...d,group:d.group||'기타',urgent:!!d.urgent,urgentAt:d.urgentAt||null,completed:!!d.completed,completedAt:d.completedAt||null}));
      out.tasks=(c.tasks||[]).map(t=>({...t,projectId:t.projectId||t.directoryId}));
      return out;
    }
    const memo=c.memoStorage||{};
    (c.taskGroups||[]).forEach((g,idx)=>{
      const pid='legacy-'+Date.now()+'-'+idx;
      out.projects.push({id:pid,title:g.title||'프로젝트',group:'기타',urgent:false,urgentAt:null,completed:false,completedAt:null,createdAt:now(),updatedAt:now(),deletedAt:null});
      (g.todos||[]).forEach(t=>out.tasks.push({id:t.id||('task-'+Math.random()),projectId:pid,title:t.text||'제목 없음',memo:memo[t.id]||'',completed:!!t.checked,completedAt:t.checked?now():null,createdAt:now(),updatedAt:now(),deletedAt:null}));
    });
    return out.projects.length?out:defaults();
  }
  async function load(){
    const {data,error}=await db.from('user_dashboards').select('content').eq('user_id',USER).maybeSingle();
    if(error)throw error;
    return migrate(data?.content);
  }
  async function save(state){
    state.meta={updatedAt:now(),deviceId,appVersion:'v9'};
    const {error}=await db.from('user_dashboards').upsert({user_id:USER,content:state},{onConflict:'user_id'});
    if(error)throw error;
    localStorage.setItem('jd-v9-backup',JSON.stringify(state));
    return state.meta.updatedAt;
  }
  function local(){const b=localStorage.getItem('jd-v9-backup');return b?JSON.parse(b):null}
  function realtime(onData){
    return db.channel('jd-v9-'+USER).on('postgres_changes',{event:'*',schema:'public',table:'user_dashboards',filter:'user_id=eq.'+USER},p=>onData(migrate(p.new?.content))).subscribe();
  }
  return {load,save,local,realtime,now,deviceId};
})();
