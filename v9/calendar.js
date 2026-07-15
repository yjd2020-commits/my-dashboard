
window.CalendarUI=(()=>{
  function load(url){
    const f=document.getElementById('calendar-frame');
    if(!url){f.srcdoc='<div style="padding:60px 20px;text-align:center;color:#6e6e73;font-family:sans-serif;font-size:12px">설정에서 Google Calendar embed URL을 입력하세요.</div>';return}
    let u=url;if(u.includes('/render'))u=u.replace('/render','/embed');
    if(!u.includes('mode='))u+=(u.includes('?')?'&':'?')+'mode=AGENDA&wkst=1&bgcolor=%23ffffff&ctz=Asia%2FSeoul';
    f.src=u;
  }
  function add(){window.open('https://calendar.google.com/calendar/render?action=TEMPLATE&ctz=Asia%2FSeoul','_blank')}
  function edit(){window.open('https://calendar.google.com/calendar/u/0/r?ctz=Asia%2FSeoul','_blank')}
  return {load,add,edit};
})();
