window.StorageEngine=(()=>{
  const SUPABASE_URL='https://janalakgduwqoyzimuku.supabase.co';
  const SUPABASE_KEY='sb_publishable_5bYHyOYBYE8aeOLpB9TYEw_-5mXb6Bi';
  const USER='yjd2020';
  const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{apikey:SUPABASE_KEY}}});
  const deviceId=localStorage.getItem('jd-device-id')||('dev-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  localStorage.setItem('jd-device-id',deviceId);
  const now=()=>new Date().toISOString();
  function defaults(){
    const seeds=[['회사','#007aff'],['KIA','#34c759'],['자문','#af52de'],['대학','#ff3b30'],['Five Senses','#ff9500'],['UIA','#8e8e93']];
    return {version:'10',workspaces:seeds.map((x,i)=>({id:'ws-'+i,title:x[0],color:x[1],createdAt:now(),updatedAt:now(),deletedAt:null})),projects:[],tasks:[],googleCalendarUrl:'',meta:{}};
  }
  function migrate(c){
    if(!c)return defaults();
    if(c.version==='10'&&Array.isArray(c.workspaces))return c;
    const out={version:'10',workspaces:[],projects:[],tasks:[],googleCalendarUrl:c.googleCalendarUrl||'',meta:c.meta||{}};
    if(Array.isArray(c.projects)){
      const groups=[...new Set(c.projects.map(p=>p.group||'기타'))];
      out.workspaces=groups.map((g,i)=>({id:'mws-'+i,title:g,color:['#007aff','#34c759','#af52de','#ff9500','#ff3b30','#8e8e93'][i%6],createdAt:now(),updatedAt:now(),deletedAt:null}));
      const map=Object.fromEntries(out.workspaces.map(w=>[w.title,w.id]));
      out.projects=c.projects.map(p=>({...p,workspaceId:p.workspaceId||map[p.group||'기타']}));
      out.tasks=(c.tasks||[]).map(t=>({...t,urgent:!!t.urgent,urgentAt:t.urgentAt||null}));
      return out;
    }
    if(Array.isArray(c.directories)){
      const ws={id:'mws-0',title:'기타',color:'#007aff',createdAt:now(),updatedAt:now(),deletedAt:null};
      out.workspaces=[ws];
      out.projects=c.directories.map(d=>({...d,workspaceId:ws.id}));
      out.tasks=(c.tasks||[]).map(t=>({...t,projectId:t.projectId||t.directoryId,urgent:!!t.urgent,urgentAt:t.urgentAt||null}));
      return out;
    }
    return defaults();
  }

  function normalizeV10(data){
    const out=data||defaults();
    out.version='10';
    out.workspaces=(out.workspaces||[]).map((w,i)=>({
      ...w,
      order:Number.isFinite(Number(w.order))?Number(w.order):(i+1)*100,
      collapsed:!!w.collapsed
    }));
    out.projects=(out.projects||[]).map((p,i)=>({
      ...p,
      order:Number.isFinite(Number(p.order))?Number(p.order):(i+1)*100,
      collapsed:!!p.collapsed
    }));
    out.tasks=(out.tasks||[]).map((t,i)=>({
      ...t,
      order:Number.isFinite(Number(t.order))?Number(t.order):(i+1)*100,
      urgent:!!t.urgent,
      urgentAt:t.urgentAt||null
    }));
    return out;
  }

  async function load(){const {data,error}=await db.from('user_dashboards').select('content').eq('user_id',USER).maybeSingle();if(error)throw error;return normalizeV10(migrate(data?.content))}
  async function save(state){state.meta={updatedAt:now(),deviceId,appVersion:'v10'};const {error}=await db.from('user_dashboards').upsert({user_id:USER,content:state},{onConflict:'user_id'});if(error)throw error;localStorage.setItem('jd-v10-backup',JSON.stringify(state));return state.meta.updatedAt}
  function local(){const b=localStorage.getItem('jd-v10-backup');return b?JSON.parse(b):null}
  function realtime(onData){return db.channel('jd-v10-'+USER).on('postgres_changes',{event:'*',schema:'public',table:'user_dashboards',filter:'user_id=eq.'+USER},p=>onData(normalizeV10(migrate(p.new?.content)))).subscribe()}
  return {load,save,local,realtime,now,deviceId,normalizeV10};
})();
