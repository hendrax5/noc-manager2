// Bulk CID mapping: shared owner/product/capacity, per-row results, limits, ACL-free transaction fixtures.
// Run with: node scripts/test_bulk_circuit_mapping.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

async function main() {
  const root = path.resolve(__dirname, '..');
  const template = {id:8,name:'IPT',fields:[],active:true};
  const state = {tickets:[],services:[],identifiers:[],logs:[],nextServiceId:100};
  let queue = Promise.resolve();
  const snapshot = () => structuredClone({tickets:state.tickets,services:state.services,identifiers:state.identifiers,logs:state.logs});
  const restore = value => Object.assign(state, structuredClone(value));
  const ticketRow = ticket => ({id:ticket.id,trackingId:ticket.trackingId,title:ticket.title,description:ticket.description,customData:ticket.customData,updatedAt:ticket.updatedAt,workType:ticket.workType,jobCategory:ticket.jobCategory,services:ticket.services});
  const db = {
    appSetting:{findUnique:async()=>null},
    serviceWorkType:{findUnique:async()=>null},
    serviceTemplate:{findUnique:async()=>template},
    customer:{findUnique:async({where})=>({id:where.id,name:'PT Fixture'})},
    service:{
      findMany:async()=>state.services.map(service=>({id:service.id,cid:service.cid,customData:service.customData,identifiers:state.identifiers.filter(identifier=>identifier.serviceId===service.id)})),
      findUnique:async({where})=>state.services.find(service=>service.id===where.id)?structuredClone({...state.services.find(service=>service.id===where.id),template}):null,
      create:async({data})=>{const row={id:++state.nextServiceId,updatedAt:'2026-10-01T00:00:00.000Z',...structuredClone(data)};state.services.push(row);return structuredClone({...row,template});},
      update:async({where,data})=>{const row=state.services.find(service=>service.id===where.id);Object.assign(row,data);return structuredClone(row);},
      updateMany:async({where,data})=>{const row=state.services.find(service=>service.id===where.id);if(!row)return{count:0};Object.assign(row,data);return{count:1};},
    },
    serviceIdentifier:{
      findMany:async({where}={})=>structuredClone(state.identifiers.filter(identifier=>!where?.code||identifier.code===where.code)),
      create:async({data})=>{const row={id:state.identifiers.length+1,...data};state.identifiers.push(row);return row;},
    },
    ticket:{
      findMany:async({where}={})=>structuredClone(state.tickets.filter(ticket=>{
        if(where?.title?.contains)return String(ticket.title).includes(where.title.contains);
        if(where?.id?.in)return where.id.in.includes(ticket.id);
        return true;
      }).map(ticketRow)),
      findUnique:async({where})=>structuredClone(state.tickets.find(ticket=>ticket.id===where.id)||null),
    },
    ticketHistory:{createMany:async({data})=>{state.logs.push(...structuredClone(data));return{count:data.length};}},
    bodWindow:{findFirst:async()=>null},
    $queryRaw:async()=>[{locked:'locked'}],
    $executeRaw:async(_strings,serviceId,ids)=>{for(const id of ids||[]){const ticket=state.tickets.find(row=>row.id===id);if(ticket&&!ticket.services.some(service=>service.id===serviceId))ticket.services.push({id:serviceId});}return (ids||[]).length;},
    $transaction:async callback=>{
      const previous=queue;let release;queue=new Promise(resolve=>release=resolve);await previous;
      const before=snapshot();
      try{return await callback(db);}catch(error){restore(before);throw error;}finally{release();}
    },
  };
  function addTicket(code,name){
    const ticket={id:state.tickets.length+1,trackingId:'HSK-'+String(state.tickets.length+1),title:code,description:'',customData:{'Customer Name':name,'company':'ION'},services:[],workType:'Installation',jobCategory:{name:'Installasi'},updatedAt:'2026-10-01T00:00:00.000Z'};
    state.tickets.push(ticket);return ticket;
  }

  const built = await esbuild.build({
    stdin:{contents:"export {mapCircuitCandidatesBulk} from '@/lib/services/circuitAssets.js';",resolveDir:root,loader:'js'},
    bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':root},
    plugins:[{name:'config-fixture',setup(build){
      build.onResolve({filter:/^\.\.\/config\.js$/},()=>({path:'config',namespace:'fixture'}));
      build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export async function getAppConfig(){return {};}',loader:'js'}));
    }}],
  });
  const filename = path.join(root,'bulk-mapping-fixture.cjs');
  const mod = new Module(filename,module);
  mod.filename = filename; mod.paths = module.paths;
  mod._compile(built.outputFiles[0].text,filename);
  const { mapCircuitCandidatesBulk } = mod.exports;

  addTicket('SAP-C-5000-0001','PT Satu Site A');
  addTicket('SAP-C-5000-0002','PT Dua Site B');
  addTicket('SAP-C-5000-0003','PT Tiga Site C');
  const shared = {customerId:9,templateId:8,status:'Pending',company:'ION',bandwidthMbps:1000};
  const result = await mapCircuitCandidatesBulk(db,{...shared,cids:['SAP-C-5000-0001','SAP-C-5000-0002','SAP-C-5000-0001']},1);
  assert.equal(result.total,2,'duplicate cids are collapsed');
  assert.equal(result.mapped,2);
  assert.equal(result.created,2);
  assert.equal(result.failed,0);
  assert.equal(result.linkedTickets,2);
  assert.equal(state.services.length,2);
  assert.deepEqual(state.services.map(service=>service.cid).sort(),['SAP-C-5000-0001','SAP-C-5000-0002']);
  assert.ok(state.services.every(service=>service.company==='ION' && service.customData.bandwidthMbps===1000));
  assert.ok(state.services.map(service=>service.name).includes('PT Satu Site A'),'service keeps the ticket source name');
  assert.ok(state.tickets.filter(ticket=>['SAP-C-5000-0001','SAP-C-5000-0002'].includes(ticket.title)).every(ticket=>ticket.services.length===1),'each mapped source ticket is linked');

  const partial = await mapCircuitCandidatesBulk(db,{...shared,cids:['SAP-C-5000-9001','SAP-C-5000-0003']},1);
  assert.equal(partial.total,2);
  assert.equal(partial.mapped,1,'valid rows still link when another row is unknown');
  assert.equal(partial.failed,1);
  assert.match(partial.results.find(item=>!item.ok).error,/Tidak ada tiket pekerjaan layanan/);

  await assert.rejects(() => mapCircuitCandidatesBulk(db,{...shared,cids:Array.from({length:51},(_,i)=>'SAP-C-6000-'+String(i).padStart(4,'0'))},1),/Maksimal 50 CID per batch/);
  await assert.rejects(() => mapCircuitCandidatesBulk(db,{...shared,cids:[]},1),/Pilih minimal satu CID/);

  // 3. "Asset available" rows can be bulk-linked to the existing service without owner input.
  addTicket('SAP-C-5000-0004','PT Empat Site D');
  state.services.push({id:999,cid:'SAP-C-5000-0004',customerId:9,templateId:8,name:'Existing link',status:'Active',company:'ION',customData:{bandwidthMbps:1000},updatedAt:'2026-10-01T00:00:00.000Z'});
  const linked = await mapCircuitCandidatesBulk(db,{action:'link',cids:['SAP-C-5000-0004'],confirmReview:true},1);
  assert.equal(linked.action,'link');
  assert.equal(linked.mapped,1);
  assert.equal(linked.created,0);
  assert.equal(linked.linkedTickets,1);
  assert.equal(state.tickets.find(ticket=>ticket.title==='SAP-C-5000-0004').services.length,1,'tickets are linked to the existing service');
  assert.equal(state.services.filter(service=>service.cid==='SAP-C-5000-0004').length,1,'no duplicate service is created');

  console.log('PASS bulk-circuit-mapping: deduped batch creation with shared owner/product/capacity, per-row partial failures, batch limit, and bulk ticket linking for existing assets.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
