const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

async function main() {
  const root = path.resolve(__dirname, '..');
  const masters=[{id:1,kind:'symptom',name:'Down',active:true},{id:2,kind:'cause',name:'FO CUT',active:true}];
  const services=[{id:7,cid:'CID-7',customData:{}}];
  let writes=[];
  const existing={id:11,title:'Old',description:'Old description',workType:'Unclassified',status:'New',priority:'Medium',ticketType:'Incident',services:[],enableSla:false,customData:{},jobCategoryId:null};
  const state={session:{user:{id:'1',role:'Admin',permissions:[]}},db:{
    service:{findMany:async({where})=>services.filter(s=>where.id.in.includes(s.id))},
    troubleMasterEntry:{findUnique:async({where})=>masters.find(m=>m.id===where.id)},
    ticketHistory:{findFirst:async()=>({actorId:1})},
    ticket:{findUnique:async()=>({...existing}),create:async({data})=>{writes.push(data);return {...data,id:12,watchers:[],assignee:null}},update:async({data})=>{writes.push(data);return {...existing,...data}}},
  }};
  state.db.$transaction = async callback => callback(state.db);
  state.db.$queryRaw = async () => [];
  globalThis.__ticketClassificationApiTest=state;
  const mocks={
    'next/server':'export const NextResponse={json:(body,init)=>new Response(JSON.stringify(body),init)};',
    'next-auth':'export const getServerSession=async()=>globalThis.__ticketClassificationApiTest.session;',
    '@/lib/prisma':'export const prisma=globalThis.__ticketClassificationApiTest.db;',
    '@/lib/notify':'export async function notifyTicketEvent(){};export async function collectTicketNotifyEmails(){return {emails:[]}};',
    '@/lib/integration/webhooks':'export async function dispatchIntegrationWebhook(){};',
    '@/lib/tickets/routing':'export const pickLeastBusyAssignee=async()=>null;',
    '@/lib/tickets/points':'export const createTicketPointsLog=()=>({action:"created",actorId:1});export const resolveJobRecipientId=async()=>null;export const resolveJobPointsLog=()=>({});export const canAwardResolveJobPoints=async()=>false;',
    '@/lib/tickets/personalCategories':'export const canAccessPersonalTicket=()=>true;',
  };
  async function load(file){const built=await esbuild.build({entryPoints:[path.join(root,file)],bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':root},plugins:[{name:'api-fixture',setup(build){build.onResolve({filter:/.*/},args=>{
    if(/auth\/\[\.\.\.nextauth\]\/route$/.test(args.path))return {path:'auth',namespace:'fixture'};
    if(mocks[args.path])return {path:args.path,namespace:'fixture'};
  });build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='auth'?'export const authOptions={};':mocks[args.path],loader:'js'}));}}]});const filename=path.join(root,'fixture.cjs'),mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(built.outputFiles[0].text,filename);return mod.exports;}
  const create=await load('app/api/tickets/route.js'),detail=await load('app/api/tickets/[id]/route.js');
  const req=(body,method='POST')=>new Request('http://localhost/api/tickets',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const base={title:'Legacy installation',description:'Legacy form',departmentId:1};
  const legacyResponse=await create.POST(req(base));assert.equal(legacyResponse.status,201,await legacyResponse.text());assert.equal(writes.at(-1).workType,'Unclassified');assert.match(writes.at(-1).trackingId,/^HSK-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal((await create.POST(req({...base,workType:'Installation',sapReference:'SAP-C-1855-0001'}))).status,201);assert.equal(writes.at(-1).sapReference,'SAP-C-1855-0001');
  const trouble={...base,workType:'Trouble',serviceIds:[7],symptomId:1,causeId:2};
  assert.equal((await create.POST(req(trouble))).status,201);assert.equal(writes.at(-1).causeLabel,'FO CUT');assert.deepEqual(writes.at(-1).services,{connect:[{id:7}]});
  let count=writes.length;assert.equal((await create.POST(req({...trouble,serviceIds:[]}))).status,400);assert.equal(writes.length,count);
  state.session={user:{id:'1',role:'Staff',permissions:['change_ticket_status']}};
  assert.equal((await detail.PATCH(req({workType:'Trouble',serviceIds:[7],symptomId:1,causeId:2},'PATCH'),{params:Promise.resolve({id:'11'})})).status,403);assert.equal(writes.length,count);
  assert.equal((await detail.PATCH(req({status:'In Progress'},'PATCH'),{params:Promise.resolve({id:'11'})})).status,200);assert.equal(writes.at(-1).workType,undefined);
  assert.equal((await detail.PATCH(req({status:'In Progress',workType:'Unclassified',symptomId:null,causeId:null,sapReference:null,serviceIds:[]},'PATCH'),{params:Promise.resolve({id:'11'})})).status,200,'unchanged metadata must not require elevated edit rights');
  state.session={user:{id:'1',role:'Admin',permissions:[]}};
  assert.equal((await detail.PATCH(req({workType:'Trouble',serviceIds:[7],symptomId:1,causeId:2},'PATCH'),{params:Promise.resolve({id:'11'})})).status,200);assert.equal(writes.at(-1).workType,'Trouble');assert.deepEqual(writes.at(-1).services,{set:[{id:7}]});assert.ok(writes.at(-1).historyLogs.create.some(log=>log.action.includes('Work classification')));
  delete globalThis.__ticketClassificationApiTest;
  console.log('PASS: actual create/PATCH route fixtures preserve legacy generator/form requests, manual SAP, Trouble CID/master validation, metadata ACL, ordinary status update, service links and classification audit logs. No database writes.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
