const item=(label,href,section)=>({label,href,...(section?{section}:{})});
export function navigationFor(user={}) {
 const admin=user.role==='Admin',manager=user.role==='Manager',has=p=>admin||user.permissions?.includes(p);
 const groups=[
 {id:'dashboard',label:'Dashboard',href:'/dashboard',items:[]},
 {id:'tickets',label:'Tiket',href:'/tickets',items:[item('Semua Tiket','/tickets'),item('Trouble','/tickets?workType=Trouble'),item('Instalasi','/tickets?view=installation'),item('Pekerjaan Layanan','/tickets?workType=ServiceWork')]},
 {id:'assets',label:'Customer & Layanan',href:'/assets',items:[]},
 {id:'team',label:'Tim',href:'/team/schedules',items:[item('Jadwal Shift','/team/schedules'),item('Meetings','/meetings'),...(['manage_users','manage_roles','manage_departments'].some(has)?[item('User, Role & Departemen','/team')]:[])]},
 {id:'reports',label:'Laporan',href:'/reports',items:[item('Kinerja','/reports'),item('Daily Report','/reports/daily'),...(manager||has('view_reports')?[item('Gangguan & SLA','/reports/sla')]:[]),...(admin||manager?[item('Ops Report','/reports/ops')]:[]),...(manager||has('view_reports')||has('manage_schedules')?[item('Shift Fairness','/reports/shifts')]:[])]},
 {id:'knowledge',label:'Knowledge',href:'/knowledge',items:[]},
 ];
 const settings=[...(has('manage_trouble_master')?[item('Gejala & Penyebab','/settings/trouble-masters','Master Data')]:[]),...(has('manage_service_work')?[item('Jenis Pekerjaan Layanan','/settings/service-work-types','Master Data')]:[]),...(has('manage_workflows')?[item('Workflow pekerjaan','/settings/workflows','Operasional')]:[]),...(admin?[item('Penempatan & Aturan Evaluasi','/settings/evaluation','Penilaian')]:[]),...(has('manage_settings')?[item('Sistem & Multi-Company Routing','/settings','Sistem')]:[])];
 if(settings.length)groups.push({id:'settings',label:'Pengaturan',href:settings[0].href,items:settings});
 return groups;
}
export function activeSection(path){if(path.startsWith('/tickets'))return 'tickets';if(path.startsWith('/assets'))return 'assets';if(path.startsWith('/team')||path.startsWith('/meetings'))return 'team';if(path.startsWith('/reports'))return 'reports';if(path.startsWith('/settings'))return 'settings';if(path.startsWith('/knowledge'))return 'knowledge';return path==='/dashboard'?'dashboard':null;}
export function activeItem(item,path,params){
 const url=new URL(item.href,'https://noc.local');
 if(url.pathname==='/tickets'){
  if(!path.startsWith('/tickets'))return false;
  const installation=params.get('view')==='installation'||params.get('workType')==='Installation'||(path==='/tickets/new'&&params.get('operation')==='Installation');
  if(installation)return url.searchParams.get('view')==='installation';
  return (url.searchParams.get('workType')||'')===(params.get('workType')||'')&&!url.searchParams.get('view');
 }
 return path===url.pathname;
}
