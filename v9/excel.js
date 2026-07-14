
window.ExcelIO=(()=>{
  function exportState(state){
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.projects),'Projects');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.tasks),'Tasks');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{googleCalendarUrl:state.googleCalendarUrl,version:9}]),'Settings');
    XLSX.writeFile(wb,'JD_Workspace_v9_'+new Date().toISOString().slice(0,10)+'.xlsx');
  }
  function importFile(file,cb){
    const r=new FileReader();
    r.onload=e=>{
      const wb=XLSX.read(e.target.result,{type:'array'});
      const projects=XLSX.utils.sheet_to_json(wb.Sheets.Projects||{});
      const tasks=XLSX.utils.sheet_to_json(wb.Sheets.Tasks||{});
      const settings=XLSX.utils.sheet_to_json(wb.Sheets.Settings||{})[0]||{};
      cb({projects,tasks,googleCalendarUrl:settings.googleCalendarUrl||''});
    };
    r.readAsArrayBuffer(file);
  }
  return {exportState,importFile};
})();
