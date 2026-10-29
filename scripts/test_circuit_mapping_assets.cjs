// CID mapping can complete customer/service/capacity/company in one dialog.
// Fixtures only: no live database, no network.
// Run with: node scripts/test_circuit_mapping_assets.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

async function main() {
  const root = path.resolve(__dirname, '..');
  const templates = {
    8:{id:8,name:'IPT',fields:[],active:true},
    9:{id:9,name:'OPEN PORT',fields:[],active:true},
    10:{id:10,name:'DARKFIBER',fields:[],active:true},
  };
  const state = {tickets:[],services:[],identifiers:[],logs:[],activities:[],writes:0,bod:null,nextTicket:1};
  let queue = Promise.resolve();
  const snapshot = () => structuredClone({tickets:state.tickets,services:state.services,identifiers:state.identifiers,logs:state.logs,activities:state.activities,writes:state.writes,bod:state.bod});
  const restore = value => Object.assign(state,structuredClone(value));
  const ticketRow = ticket => ({id:ticket.id,trackingId:ticket.trackingId,title:ticket.title,description:ticket.description,customData:ticket.customData,updatedAt:ticket.updatedAt,workType:ticket.workType,jobCategory:ticket.jobCategory,services:ticket.services});
  const db = {
    appSetting:{findUnique:async({where})=>where?.key==='workflow_reporting_flags'?{value:'{"performance_activity_capture":true}'}:null},
    activityEvent:{upsert:async({create})=>{state.activities.push(create);return create;}},
    ticket:{
      findMany:async({where}={})=>structuredClone(state.tickets.filter(ticket=>{
        if(where?.title?.contains)return String(ticket.title).includes(where.title.contains);
        if(where?.id?.in)return where.id.in.includes(ticket.id);
        return true;
      }).map(ticketRow)),
      findUnique:async({where})=>structuredClone(state.tickets.find(ticket=>ticket.id===where.id)||null),
    },
    service:{
      findMany:async()=>state.services.map(service=>({id:service.id,cid:service.cid,customData:service.customData,identifiers:state.identifiers.filter(identifier=>identifier.serviceId===service.id)})),
      findUnique:async({where})=>{const row=state.services.find(service=>service.id===where.id);return row?structuredClone(row):null;},
      count:async({where}={})=>state.services.filter(service=>(!where.cid||service.cid===where.cid)&&(!where.id||service.id===where.id)).length,
      create:async({data})=>{state.writes+=1;const row={id:100+state.services.length,...structuredClone(data),updatedAt:'2026-10-01T00:00:00.000Z'};state.services.push(row);return structuredClone(row);},
      update:async({where,data})=>{state.writes+=1;const row=state.services.find(service=>service.id===where.id);Object.assign(row,structuredClone(data),{updatedAt:'2026-10-02T00:00:00.000Z'});return structuredClone(row);},
    },
    serviceIdentifier:{
      findMany:async({where}={})=>structuredClone(state.identifiers.filter(identifier=>!where?.code||identifier.code===where.code)),
      create:async({data})=>{const row={id:state.identifiers.length+1,...data};state.identifiers.push(row);return row;},
    },
    customer:{findUnique:async({where})=>({id:where.id,name:'PT Fixture'})},
    serviceTemplate:{findUnique:async({where})=>templates[where.id]||null},
    ticketHistory:{createMany:async({data})=>{state.logs.push(...structuredClone(data));return{count:data.length};}},
    bodWindow:{findFirst:async({where})=>state.bod&&state.bod.serviceId===where.serviceId?structuredClone(state.bod):null},
    $queryRaw:async()=>[{locked:'locked'}],
    $executeRaw:async(_strings,serviceId,ids)=>{for(const id of ids||[]){const ticket=state.tickets.find(row=>row.id===id);if(ticket&&!ticket.services.some(service=>service.id===serviceId))ticket.services.push({id:serviceId});}return (ids||[]).length;},
    $transaction:async callback=>{
      const previous=queue;let release;queue=new Promise(resolve=>release=resolve);await previous;
      const before=snapshot();
      try{return await callback(db);}catch(error){restore(before);throw error;}finally{release();}
    },
  };
  function addTicket(code,name='PT Fixture'){
    const ticket={id:++state.nextTicket,trackingId:'HSK-'+state.nextTicket,title:code,description:'',customData:{'Customer Name':name},services:[],workType:'Installation',jobCategory:{name:'Installasi'},updatedAt:'2026-10-01T00:00:00.000Z'};
    state.tickets.push(ticket);return ticket;
  }
  function addService(data){const row={company:null,customData:{},status:'Pending',updatedAt:'2026-10-01T00:00:00.000Z',...data,id:data.id??(200+state.services.length)};state.services.push(row);return row;}
  const serviceById = id => state.services.find(row=>row.id===id);

  const built = await esbuild.build({
    stdin:{contents:"export {mapCircuitCandidate,CircuitAssetError} from '@/lib/services/circuitAssets.js';",resolveDir:root,loader:'js'},
    bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':root},
    plugins:[{name:'config-fixture',setup(build){
      // Company normalization only needs the default registry; avoid a real Prisma client.
      build.onResolve({filter:/^\.\.\/config\.js$/},()=>({path:'config',namespace:'fixture'}));
      build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export async function getAppConfig(){return {};}',loader:'js'}));
    }}],
  });
  const filename = path.join(root,'circuit-mapping-fixture.cjs');
  const mod = new Module(filename,module);
  mod.filename = filename; mod.paths = module.paths;
  mod._compile(built.outputFiles[0].text,filename);
  const {mapCircuitCandidate} = mod.exports;
  const map = body => mapCircuitCandidate(db,body,1);

  // 1. A new service is created together with capacity and company.
  addTicket('SAP-C-3000-0001','PT Satu');
  let result = await map({cid:'SAP-C-3000-0001',customerId:9,templateId:8,name:'Link baru',status:'Active',company:'SDC',bandwidthMbps:1000});
  assert.equal(result.created,true);
  let service = state.services.find(row=>row.cid==='SAP-C-3000-0001');
  assert.equal(service.company,'SDC');
  assert.equal(service.status,'Active');
  assert.equal(service.customData.bandwidthMbps,1000);
  assert.equal(service.customData.cidSource,'Ticket Subject');
  assert.equal(result.linkedTickets,1,'source ticket is linked');

  // 2. Legacy company aliases are normalized and OPEN PORT keeps its 10 Gbps default.
  addTicket('SAP-C-3000-0002');
  await map({cid:'SAP-C-3000-0002',customerId:9,templateId:9,name:'Open port',company:'PRODC'});
  service = state.services.find(row=>row.cid==='SAP-C-3000-0002');
  assert.equal(service.company,'SDC','PRODC is normalized to SDC');
  assert.equal(service.customData.bandwidthMbps,10000,'OPEN PORT default capacity is preserved');

  // 3. Product rules still apply: OPEN PORT below 10 Gbps is rejected before any write.
  addTicket('SAP-C-3000-0003');
  const writesBeforeInvalid = state.writes;
  await assert.rejects(() => map({cid:'SAP-C-3000-0003',customerId:9,templateId:9,name:'OP kecil',bandwidthMbps:5000}),/10 Gbps/);
  assert.equal(state.writes,writesBeforeInvalid);
  assert.equal(state.services.some(row=>row.cid==='SAP-C-3000-0003'),false);
  addTicket('SAP-C-3000-0004');
  await assert.rejects(() => map({cid:'SAP-C-3000-0004',customerId:9,templateId:8,name:'Perusahaan salah',company:'TIDAK ADA'}),/Perusahaan layanan harus salah satu/);

  // 4. DARKFIBER capacity is a pair count.
  addTicket('SAP-C-3000-0005');
  await map({cid:'SAP-C-3000-0005',customerId:9,templateId:10,name:'Dark fiber 2 pair',pairCount:2});
  service = state.services.find(row=>row.cid==='SAP-C-3000-0005');
  assert.equal(service.customData.pairCount,2);
  assert.equal(service.customData.bandwidthMbps,undefined);
  addTicket('SAP-C-3000-0006');
  await map({cid:'SAP-C-3000-0006',customerId:9,templateId:10,name:'Dark fiber default'});
  assert.equal(state.services.find(row=>row.cid==='SAP-C-3000-0006').customData.pairCount,1);

  // 5. Linking to an existing service can complete company and capacity in the same step.
  addTicket('SAP-C-3000-0007');
  let target = addService({id:200,cid:null,customerId:9,templateId:8,name:'Layanan lama',company:null,customData:{bandwidthMbps:100,legacy:'retain'}});
  let writesBefore = state.writes;
  result = await map({cid:'SAP-C-3000-0007',customerId:9,existingServiceId:200,company:'ION',bandwidthMbps:2000});
  assert.equal(result.created,false);
  assert.equal(target.cid,'SAP-C-3000-0007');
  assert.equal(target.company,'ION');
  assert.equal(target.customData.bandwidthMbps,2000);
  assert.equal(target.customData.legacy,'retain','unmapped product fields are retained');
  assert.equal(state.writes,writesBefore+1,'one Inventory update for the link');

  // 6. Linking without changed capacity/company never rewrites them.
  addTicket('SAP-C-3000-0008');
  addService({id:201,cid:null,customerId:9,templateId:8,name:'Layanan dua',company:'ION',customData:{bandwidthMbps:500}});
  writesBefore = state.writes;
  await map({cid:'SAP-C-3000-0008',customerId:9,existingServiceId:201});
  assert.equal(serviceById(201).cid,'SAP-C-3000-0008');
  assert.equal(serviceById(201).customData.bandwidthMbps,500);
  assert.equal(serviceById(201).company,'ION');
  assert.equal(state.writes,writesBefore+1,'only the CID write, no capacity/company rewrite');

  // 7. Active BOD blocks inventory edits but still allows a pure link.
  addTicket('SAP-C-3000-0009');
  addService({id:202,cid:null,customerId:9,templateId:8,name:'Layanan BOD',company:'ION',customData:{bandwidthMbps:100}});
  state.bod = {serviceId:202,activatedAt:'2026-10-01T00:00:00.000Z',restoredAt:null,cancelledAt:null};
  await assert.rejects(() => map({cid:'SAP-C-3000-0009',customerId:9,existingServiceId:202,bandwidthMbps:2000}),/BOD aktif/);
  assert.equal(serviceById(202).customData.bandwidthMbps,100);
  await map({cid:'SAP-C-3000-0009',customerId:9,existingServiceId:202});
  assert.equal(serviceById(202).cid,'SAP-C-3000-0009','pure linking stays allowed during BOD');
  state.bod = null;

  // 8. Alias confirmation is unchanged; capacity validation applies to existing services too.
  addTicket('SAP-C-3000-0010');
  addService({id:203,cid:'SAP-C-OLD-0009',customerId:9,templateId:9,name:'Layanan alias',company:'ION',customData:{bandwidthMbps:10000}});
  await assert.rejects(() => map({cid:'SAP-C-3000-0010',customerId:9,existingServiceId:203}),/konfirmasikan/);
  result = await map({cid:'SAP-C-3000-0010',customerId:9,existingServiceId:203,confirmAlias:true});
  assert.equal(result.aliasAdded,true);
  assert.equal(serviceById(203).cid,'SAP-C-OLD-0009','alias keeps the canonical CID');
  await assert.rejects(() => map({cid:'SAP-C-3000-0010',customerId:9,existingServiceId:203,bandwidthMbps:5000,confirmAlias:true}),/10 Gbps/);

  // 9. Zero capacity is a known value: linking it unchanged writes no capacity field.
  addTicket('SAP-C-3000-0011');
  addService({id:204,cid:null,customerId:9,templateId:8,name:'Kapasitas nol',company:'ION',customData:{bandwidthMbps:0}});
  writesBefore = state.writes;
  await map({cid:'SAP-C-3000-0011',customerId:9,existingServiceId:204,bandwidthMbps:0});
  assert.equal(serviceById(204).customData.bandwidthMbps,0);
  assert.equal(state.writes,writesBefore+1,'zero capacity unchanged: only the CID write');

  // 10. Unchanged values and unit mismatches cannot rewrite Inventory silently.
  addTicket('SAP-C-3000-0017');
  addService({id:207,cid:null,customerId:9,templateId:8,name:'Nilai sama',company:'ION',customData:{bandwidthMbps:1000}});
  writesBefore = state.writes;
  await map({cid:'SAP-C-3000-0017',customerId:9,existingServiceId:207,company:'ION',bandwidthMbps:1000});
  assert.equal(state.writes,writesBefore+1,'unchanged capacity/company are not written');
  addTicket('SAP-C-3000-0012');
  await assert.rejects(() => map({cid:'SAP-C-3000-0012',customerId:9,templateId:10,name:'DF salah unit',bandwidthMbps:1000}),/jumlah pair/);
  addTicket('SAP-C-3000-0013');
  await assert.rejects(() => map({cid:'SAP-C-3000-0013',customerId:9,templateId:8,name:'IPT salah unit',pairCount:2}),/bandwidth/);
  addTicket('SAP-C-3000-0014');
  await assert.rejects(() => map({cid:'SAP-C-3000-0014',customerId:9,templateId:8,name:'Overflow',bandwidthMbps:1e305}),/angka positif/);

  // 11. Legacy Gbps fields stay coherent and company-only edits are persisted.
  addTicket('SAP-C-3000-0015');
  addService({id:205,cid:null,customerId:9,templateId:8,name:'Legacy unit',company:'ION',customData:{bandwidthGbps:10}});
  await map({cid:'SAP-C-3000-0015',customerId:9,existingServiceId:205,bandwidthMbps:2000});
  assert.equal(serviceById(205).customData.bandwidthMbps,2000);
  assert.equal(serviceById(205).customData.bandwidthGbps,2,'legacy unit field follows the canonical bandwidth');
  addTicket('SAP-C-3000-0016');
  addService({id:206,cid:null,customerId:9,templateId:8,name:'Company only',company:'ION',customData:{bandwidthMbps:100}});
  writesBefore = state.writes;
  await map({cid:'SAP-C-3000-0016',customerId:9,existingServiceId:206,company:'SDC'});
  assert.equal(serviceById(206).company,'SDC');
  assert.equal(serviceById(206).customData.bandwidthMbps,100);
  assert.equal(state.writes,writesBefore+1);
  assert.ok(state.activities.some(item=>item.entityId===206&&item.type==='service.updated'&&item.changes?.some(change=>change.field==='company')),'company-only edits are audited');

  console.log('PASS circuit-mapping-assets: create with capacity/company, legacy company normalization, OPEN PORT/DARKFIBER rules, existing-service capacity/company completion without unnecessary writes, zero capacity, unit/overflow guards, legacy unit sync, company-only edits, active BOD guard, alias confirmation unchanged.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
