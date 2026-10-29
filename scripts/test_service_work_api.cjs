// Actual API handlers with transactional fixtures: no live database or credentials.
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

async function main() {
  const root = path.resolve(__dirname, '..');
  const template = {id:1,name:'IPT',fields:[],active:true};
  const initialService = {id:7,cid:'CID-7',templateId:1,template,status:'Active',customData:{bandwidthMbps:100,legacy:'retained'},updatedAt:new Date('2026-01-01')};
  const state = {session:{user:{id:'1',role:'Admin',permissions:[]}},user:{id:1,role:{name:'Admin',permissions:[]}},service:structuredClone(initialService),row:null,logs:[],applies:0,locks:0,failTicket:false};
  let queue = Promise.resolve();
  const master={id:1,name:'Upgrade',operation:'Upgrade',active:true,defaultJobCategoryId:4};
  const db = {
    appSetting:{findUnique:async()=>null},
    user:{findUnique:async()=>state.user},
    serviceWorkType:{findUnique:async()=>master,findMany:async()=>[master],create:async({data})=>({...data,id:2}),update:async({data})=>({...master,...data})},
    serviceTemplate:{findUnique:async()=>template},
    service:{findUnique:async()=>structuredClone(state.service),findMany:async()=>[structuredClone(state.service)],updateMany:async({where,data})=>{
      if(+new Date(where.updatedAt)!==+new Date(state.service.updatedAt)) return {count:0};
      state.applies++; state.service={...state.service,...structuredClone(data),updatedAt:new Date(+state.service.updatedAt+1)};return {count:1};
    }},
    jobCategory:{findUnique:async()=>({id:4,name:'Work',score:5,active:true})},
    bodWindow:{findUnique:async()=>null,findFirst:async()=>null,create:async({data})=>data,update:async({data})=>data},
    ticketPhaseExecution:{count:async()=>0,updateMany:async()=>({count:0})},
    comment:{findFirst:async()=>({authorId:8})},
    ticketHistory:{findFirst:async({where})=>where?.awardedScore ? state.logs.find(row=>row.jobCategoryId&&row.awardedScore>0)||null : {actorId:1}},
    actionItem:{findUnique:async()=>null},
    ticket:{findUnique:async()=>state.row&&structuredClone({...state.row,services:[state.service]}),create:async({data})=>{
      const {historyLogs,services,watchers,...fields}=data;
      state.logs.push(historyLogs.create);state.row={...structuredClone(fields),id:11,services:[structuredClone(state.service)]};
      return {...state.row,watchers:[],assignee:null};
    },update:async({data})=>{
      if(state.failTicket) throw new Error('simulated ticket storage failure');
      const {historyLogs,services,...fields}=data;
      state.logs.push(...(historyLogs?.create||[]));state.row={...state.row,...structuredClone(fields)};return structuredClone(state.row);
    }},
    $queryRaw:async()=>{state.locks++;return [{id:11}]},
    $transaction:async callback=>{
      const previous=queue;let release;queue=new Promise(resolve=>release=resolve);await previous;
      const before=structuredClone({row:state.row,service:state.service,logs:state.logs,applies:state.applies});
      try {return await callback(db);} catch(error) {Object.assign(state,before);throw error;} finally {release();}
    },
  };
  globalThis.__serviceWorkApiFixture={state,db};
  const mocks={
    'next/server':'export const NextResponse={json:(body,init)=>new Response(JSON.stringify(body),init)};export const after=()=>{};',
    'next-auth':'export const getServerSession=async()=>globalThis.__serviceWorkApiFixture.state.session;',
    '@/lib/prisma':'export const prisma=globalThis.__serviceWorkApiFixture.db;',
    '@/lib/config':'export const getAppConfig=async()=>({});',
    '@/lib/notify':'export async function notifyTicketEvent(){};export async function collectTicketNotifyEmails(){return {emails:[]}};',
    '@/lib/integration/webhooks':'export async function dispatchIntegrationWebhook(){};',
    '@/lib/tickets/routing':'export const pickLeastBusyAssignee=async()=>null;',
    '@/lib/tickets/personalCategories':'export const canAccessPersonalTicket=()=>true;',
  };
  async function load(file) {
    const built=await esbuild.build({entryPoints:[path.join(root,file)],bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':root},plugins:[{name:'api-fixtures',setup(build){
      build.onResolve({filter:/.*/},args=>/auth\/\[\.\.\.nextauth\]\/route$/.test(args.path)?{path:'auth',namespace:'fixture'}:mocks[args.path]?{path:args.path,namespace:'fixture'}:undefined);
      build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='auth'?'export const authOptions={};':mocks[args.path],loader:'js'}));
    }}]});
    const filename=path.join(root,'fixture.cjs'),mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(built.outputFiles[0].text,filename);return mod.exports;
  }
  const create=await load('app/api/tickets/route.js'),detail=await load('app/api/tickets/[id]/route.js'),types=await load('app/api/service-work-types/route.js');
  const req=(body,method='POST')=>new Request('http://localhost/api/tickets',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const patch=body=>detail.PATCH(req(body,'PATCH'),{params:Promise.resolve({id:'11'})});
  const body={title:'Upgrade CID-7',description:'Requested work',workType:'ServiceWork',serviceWorkTypeId:1,serviceIds:[7],departmentId:1,assigneeId:8,jobCategoryId:4,serviceChange:{targetTemplateId:1,bandwidthMbps:200,effectiveDate:'2026-01-01'}};
  const response=await create.POST(req(body));assert.equal(response.status,201,await response.clone().text());
  assert.match(state.row.trackingId,/^HSK-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(state.row.serviceChange.before.bandwidthMbps,100);assert.equal(state.service.customData.bandwidthMbps,100,'Creation must not apply Inventory');
  state.session={user:{id:'2',role:'Staff',permissions:['change_ticket_status']}};
  assert.equal((await patch({serviceChange:body.serviceChange})).status,403,'Status permission cannot edit change request');
  state.session={user:{id:'1',role:'Admin',permissions:[]}};
  assert.equal((await patch({status:'Closed'})).status,400,'Closed cannot bypass pending application');
  state.failTicket=true;
  assert.equal((await patch({status:'Resolved'})).status,500);
  assert.equal(state.service.customData.bandwidthMbps,100,'Inventory rolled back if ticket write fails');
  assert.equal(state.applies,0);assert.equal(state.row.status,'New');assert.equal(state.logs.filter(row=>row.jobCategoryId).length,0);
  state.failTicket=false;
  const resolved=await Promise.all([patch({status:'Resolved'}),patch({status:'Resolved'})]);
  for(const item of resolved) assert.equal(item.status,200,await item.clone().text());
  assert.equal(state.applies,1);assert.equal(state.service.customData.bandwidthMbps,200);assert.equal(state.service.customData.legacy,'retained');
  assert.equal(state.logs.filter(row=>row.jobCategoryId).length,1);assert.equal(state.logs.find(row=>row.jobCategoryId).actorId,8,'Existing last reply recipient retained');
  assert.ok(state.row.serviceChange.appliedAt);assert.ok(state.locks>=5);
  assert.equal((await patch({serviceChange:{...body.serviceChange,appliedAt:null}})).status,400,'Applied payload is immutable');
  state.row.resolvedAt=new Date('2020-01-01');
  assert.equal((await patch({status:'Open'})).status,200);assert.equal(state.service.customData.bandwidthMbps,200,'Reopen does not undo Inventory');
  assert.equal((await patch({status:'Resolved'})).status,200);assert.equal(state.applies,1);assert.equal(state.logs.filter(row=>row.jobCategoryId).length,1,'Reopen does not duplicate service-work points');
  state.row=null;state.service=structuredClone(initialService);state.logs=[];state.applies=0;
  await create.POST(req(body));state.service.updatedAt=new Date('2026-02-01');
  assert.equal((await patch({status:'Resolved'})).status,409,'Stale Inventory must conflict');assert.equal(state.row.status,'New');assert.equal(state.applies,0);
  state.user={id:1,role:{name:'Staff',permissions:[]}};
  assert.equal((await types.POST(req({name:'Unauthorized',operation:'Change'}))).status,403,'Fresh role overrides stale Admin session');
  assert.equal((await types.GET(new Request('http://localhost/api/service-work-types?includeInactive=true'))).status,403);
  state.user={id:1,role:{name:'Staff',permissions:['manage_service_work']}};
  assert.equal((await types.POST(req({name:'New work',operation:'Change',defaultJobCategoryId:4}))).status,201);
  delete globalThis.__serviceWorkApiFixture;
  console.log('PASS: actual API creation, CID snapshots, metadata ACL, atomic rollback, concurrent/repeated Resolve, retained scoring recipient, reopen idempotency, Inventory conflict, and fresh master ACL. Transactional fixtures only; no live database writes.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
