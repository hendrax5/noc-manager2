// Data Center work may register the circuit it works on (new rack / cross connect)
// instead of only accepting CIDs that already exist in Inventory. RFS is a target date:
// the RFS sweep activates the Pending circuit, Resolve only records completion evidence.
// Fixtures only: no live database, no network. Run with: node scripts/test_datacenter_registration.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

async function main() {
  const root = path.resolve(__dirname, '..');
  const template = {id:2,name:'IPT',fields:[],active:true};
  const colocation = {id:3,name:'COLOCATION',fields:[{name:'Region',type:'text',required:true}],active:true};
  const templateFor = id => id===colocation.id ? colocation : template;
  const state = {services:[],customers:[],identifiers:[],locks:0,writes:0,activities:[],nextServiceId:100,nextCustomerId:10};
  const master = {id:7,name:'Cross Connect',normalizedName:'cross connect',operation:'DataCenter',active:true,defaultJobCategoryId:3};
  const installationMaster = {id:1,name:'Instalasi Baru',normalizedName:'instalasi baru',operation:'Installation',active:true,defaultJobCategoryId:3};
  const row = service => structuredClone({...service,template:templateFor(service.templateId)});
  const db = {
    appSetting:{findUnique:async({where})=>where?.key==='workflow_reporting_flags'?{value:'{"performance_activity_capture":true}'}:null},
    activityEvent:{upsert:async({create})=>{state.activities.push(create);return create;}},
    serviceWorkType:{findUnique:async({where})=>[master,installationMaster].find(item=>item.id===where.id)||null},
    serviceTemplate:{findUnique:async({where})=>templateFor(where.id)},
    customer:{
      findFirst:async({where})=>state.customers.find(item=>item.name.toLowerCase()===String(where?.name?.equals||'').toLowerCase())||null,
      findUnique:async({where})=>state.customers.find(item=>item.id===where.id)||null,
      create:async({data})=>{const created={id:++state.nextCustomerId,...data};state.customers.push(created);return created;},
    },
    service:{
      findMany:async({where}={})=>{
        if(where?.plannedActiveAt){
          const upTo=where.plannedActiveAt.lte;
          return state.services.filter(item=>item.status==='Pending'&&item.plannedActiveAt&&item.plannedActiveAt<=upTo).map(item=>({id:item.id,cid:item.cid,plannedActiveAt:item.plannedActiveAt}));
        }
        return state.services.map(item=>({id:item.id,cid:item.cid,customData:item.customData}));
      },
      findUnique:async({where})=>state.services.find(item=>item.id===where.id)?row(state.services.find(item=>item.id===where.id)):null,
      create:async({data})=>{
        if(state.services.some(item=>item.cid===data.cid))throw Object.assign(new Error('Unique constraint failed on the fields: (`cid`)'),{code:'P2002'});
        const created={id:++state.nextServiceId,status:'Active',company:null,customData:{},plannedActiveAt:null,activatedAt:null,updatedAt:new Date('2026-10-20T00:00:00Z'),...data};
        state.services.push(created);return row(created);
      },
      update:async({where,data})=>{const target=state.services.find(item=>item.id===where.id);state.writes+=1;Object.assign(target,data,{updatedAt:new Date(+target.updatedAt+1000)});return row(target);},
      updateMany:async({where,data})=>{
        const target=state.services.find(item=>item.id===where.id);
        if(!target||(where.status!==undefined&&target.status!==where.status))return {count:0};
        state.writes+=1;Object.assign(target,data,{updatedAt:new Date(+target.updatedAt+1000)});return {count:1};
      },
    },
    serviceIdentifier:{
      findMany:async({where})=>state.identifiers.filter(item=>item.code===where.code),
      create:async({data})=>{const created={id:state.identifiers.length+1,...data};state.identifiers.push(created);return created;},
    },
    $queryRaw:async()=>{state.locks+=1;return [{locked:'locked'}];},
  };

  const bundle = await esbuild.build({
    stdin:{contents:[
      "export {prepareInstallationTicket} from '@/lib/tickets/installation.js';",
      "export {prepareServiceWork,applyServiceWork,ServiceWorkError} from '@/lib/tickets/serviceWork.js';",
      "export {serviceWorkInput,serviceWorkResolveMessage} from '@/lib/tickets/serviceWorkView.js';",
      "export {activateDueServices,clearPlannedActivation,syncPlannedActivation} from '@/lib/services/rfsActivation.js';",
    ].join('\n'),resolveDir:root,loader:'js'},
    bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':root},
  });
  const filename = path.join(root,'datacenter-registration-fixture.cjs');
  const mod = new Module(filename,module);
  mod.filename = filename; mod.paths = module.paths;
  mod._compile(bundle.outputFiles[0].text,filename);
  const {prepareInstallationTicket,prepareServiceWork,applyServiceWork,serviceWorkInput,serviceWorkResolveMessage,activateDueServices,clearPlannedActivation,syncPlannedActivation} = mod.exports;

  const installation = {
    newCustomerName:'PT Rack Baru',
    cid:'SAP-C-9-9',
    name:'Rack A Site Baru',
    templateId:2,
    bandwidthGbps:0.1,
    rfsDate:'2026-10-20',
  };
  const workDetails = {location:'DC Jakarta Lantai 3',description:'Cross connect FO ke rack A',endpointFrom:'Rack MMR',endpointTo:'Rack A',technical:'Cross connect FO'};
  const body = {
    formVersion:'work-v2',
    workType:'ServiceWork',
    serviceWorkTypeId:7,
    customData:{},
    installation,
    serviceChange:{workDetails,effectiveDate:'2026-10-20'},
  };
  const completion = {confirmed:true,finishedAt:'2026-10-23',evidence:'BA Cross Connect https://drive.example/ba'};

  // 1. A Data Center ticket can register a new customer + CID; the service starts Pending
  //    with the RFS instant as its planned activation.
  const prepared = await prepareInstallationTicket(db,structuredClone(body),1);
  assert.equal(prepared.serviceIds.length,1,'new service is linked to the ticket');
  const service = state.services[0];
  assert.equal(state.customers[0].name,'PT Rack Baru');
  assert.equal(service.customerId,state.customers[0].id);
  assert.equal(service.cid,'SAP-C-9-9');
  assert.equal(service.status,'Pending','registered circuit waits for its RFS date');
  assert.equal(service.plannedActiveAt.toISOString(),'2026-10-19T17:00:00.000Z','RFS maps to Jakarta midnight');
  assert.equal(service.customData.bandwidthMbps,100);
  assert.ok(state.activities.some(item=>item.type==='service.registered_from_datacenter'),'registration is audited as Data Center');

  // 2. The work snapshot keeps the Data Center details and records the registration.
  const change = (await prepareServiceWork(db,prepared)).data.serviceChange;
  assert.equal(change.operation,'DataCenter');
  assert.equal(change.registration,'new');
  assert.equal(change.before.status,'Pending');
  assert.equal(change.after.status,'Pending','activation is not part of the Resolve snapshot');
  assert.deepEqual(change.workDetails,{...workDetails});
  assert.equal(change.effectiveDate,'2026-10-20');
  assert.match(serviceWorkResolveMessage({serviceWorkTypeLabel:'Cross Connect',serviceChange:change}),/diaktifkan otomatis pada RFS/);

  // 3. Editing the ticket keeps the registration intent and the Data Center details.
  const editedInput = serviceWorkInput(change);
  assert.deepEqual(editedInput.workDetails,{...workDetails},'edit form round-trips Data Center details');
  const edited = (await prepareServiceWork(db,{workType:'ServiceWork',serviceWorkTypeId:7,serviceIds:[service.id],serviceChange:{...editedInput,effectiveDate:'2026-10-22'}},
    {workType:'ServiceWork',serviceWorkTypeId:7,serviceChange:change,services:[{id:service.id}]})).data.serviceChange;
  assert.equal(edited.registration,'new');
  assert.equal(edited.before.serviceId,service.id,'registration stays bound to the same service');
  assert.equal(edited.after.status,'Pending');

  // 4. Resolve needs completion evidence, records it, and does not activate Inventory.
  const pendingTicket = {id:11,services:[{id:service.id}],serviceWorkTypeId:7,serviceWorkTypeLabel:'Cross Connect',serviceChange:edited};
  const writes = state.writes;
  await assert.rejects(() => applyServiceWork(db,pendingTicket,1,new Date('2026-10-23T03:00:00Z')),/Konfirmasi pekerjaan/);
  const applied = await applyServiceWork(db,pendingTicket,1,new Date('2026-10-23T03:00:00Z'),completion);
  assert.equal(applied.applied,true);
  assert.equal(state.services[0].status,'Pending','Resolve does not activate the circuit');
  assert.equal(state.writes,writes,'Resolve writes no Inventory status for a registration');
  assert.equal(applied.serviceChange.after.status,'Pending');
  assert.equal(applied.serviceChange.completion.evidence,'BA Cross Connect https://drive.example/ba');
  assert.ok(applied.serviceChange.appliedAt);
  assert.ok(state.activities.some(item=>item.ticketId===pendingTicket.id&&item.type==='datacenter.work_completed'),'work completion is audited');
  const repeat = await applyServiceWork(db,{...pendingTicket,serviceChange:applied.serviceChange},1,new Date('2026-10-24T03:00:00Z'));
  assert.equal(repeat.applied,false,'repeated Resolve is a no-op');

  // 5. The RFS sweep activates it once the date has passed, without touching tickets.
  const sweep = await activateDueServices(db,{now:new Date('2026-10-23T03:00:00Z')});
  assert.deepEqual(sweep,{due:1,activated:1,serviceIds:[service.id]});
  assert.equal(state.services[0].status,'Active');
  assert.equal(state.services[0].activatedAt.toISOString(),'2026-10-23T03:00:00.000Z');
  assert.ok(state.activities.some(item=>item.type==='service.activated_at_rfs'&&item.entityId===service.id),'activation is audited as the RFS sweep');
  assert.equal((await activateDueServices(db,{now:new Date('2026-10-24T03:00:00Z')})).activated,0,'sweep is idempotent');

  // 6. A pending registration cannot silently move to another CID.
  const other = {id:12,status:'Pending',cid:'SAP-C-9-10',name:'Rack B',templateId:2,customerId:state.customers[0].id,customData:{bandwidthMbps:100},plannedActiveAt:new Date('2026-10-19T17:00:00Z'),updatedAt:new Date('2026-10-20T00:00:00Z')};
  state.services.push(other);
  await assert.rejects(
    () => prepareServiceWork(db,{workType:'ServiceWork',serviceWorkTypeId:7,serviceIds:[other.id],serviceChange:{...editedInput,effectiveDate:'2026-10-22'}},
      {workType:'ServiceWork',serviceWorkTypeId:7,serviceChange:change,services:[{id:service.id}]}),
    /tidak dapat diganti/,
  );

  // 7. The registration marker is server-owned, not client input.
  await assert.rejects(
    () => prepareServiceWork(db,{workType:'ServiceWork',serviceWorkTypeId:7,serviceIds:[service.id],serviceChange:{...editedInput,effectiveDate:'2026-10-22',registration:'new'}},
      {workType:'ServiceWork',serviceWorkTypeId:7,serviceChange:change,services:[{id:service.id}]}),
    /hanya dapat ditulis server/,
  );

  // 8. An existing CID still behaves as before: no registration and no status mutation.
  const existingChange = (await prepareServiceWork(db,{workType:'ServiceWork',serviceWorkTypeId:7,serviceIds:[service.id],serviceChange:{workDetails,effectiveDate:'2026-10-20'}})).data.serviceChange;
  assert.equal(existingChange.registration,undefined);
  assert.equal(existingChange.after.status,existingChange.before.status);
  assert.deepEqual(existingChange.after,existingChange.before,'existing CID snapshot is unchanged');
  assert.match(serviceWorkResolveMessage({serviceWorkTypeLabel:'Cross Connect',serviceChange:existingChange}),/tanpa mengubah produk, kapasitas, atau status layanan/);
  const existingWrites = state.writes;
  const existingApplied = await applyServiceWork(db,{id:13,services:[{id:service.id}],serviceWorkTypeId:7,serviceChange:existingChange},1,new Date('2026-10-21T03:00:00Z'),{...completion,finishedAt:'2026-10-21'});
  assert.equal(existingApplied.applied,true);
  assert.equal(state.writes,existingWrites,'existing circuit status is untouched');

  // 9. Guards: completion is mandatory, a future RFS is only a target, and details stay required.
  const futureChange = (await prepareServiceWork(db,{workType:'ServiceWork',serviceWorkTypeId:7,serviceIds:[service.id],serviceChange:{workDetails,effectiveDate:'2099-01-01'}})).data.serviceChange;
  await assert.rejects(
    () => applyServiceWork(db,{id:14,services:[{id:service.id}],serviceWorkTypeId:7,serviceChange:futureChange},1,new Date('2026-10-21T03:00:00Z'),{...completion,evidence:'   '}),
    /Bukti penyelesaian/,
  );
  const futureResolved = await applyServiceWork(db,{id:14,services:[{id:service.id}],serviceWorkTypeId:7,serviceChange:futureChange},1,new Date('2026-10-21T03:00:00Z'),{...completion,finishedAt:'2026-10-21'});
  assert.equal(futureResolved.applied,true,'a future RFS no longer blocks Resolve');
  await assert.rejects(
    () => prepareServiceWork(db,{workType:'ServiceWork',serviceWorkTypeId:7,serviceIds:[service.id],serviceChange:{effectiveDate:'2026-10-20'}}),
    /Detail pekerjaan Data Center wajib diisi/,
  );
  await assert.rejects(
    () => prepareInstallationTicket(db,{workType:'ServiceWork',serviceWorkTypeId:99,installation:{...installation,cid:'SAP-C-OTHER'}},1),
    /hanya untuk Instalasi Baru atau pekerjaan Data Center/,
  );

  // 10. Registration keeps the same product-field and CID validation as Installation.
  const requiredField = await prepareInstallationTicket(db,{...structuredClone(body),installation:{...installation,newCustomerName:'PT Colo',cid:'SAP-C-9-11',name:'Colo Baru',templateId:colocation.id}},1);
  await assert.rejects(() => prepareServiceWork(db,requiredField),/Field produk wajib: Region/);
  await assert.rejects(
    () => prepareInstallationTicket(db,{...structuredClone(body),installation:{...installation,newCustomerName:'PT Duplikat',name:'Duplikat'}},1),
    /CID sudah digunakan oleh layanan lain/,
  );

  // 11. A deleted registration plan clears the activation instant instead of self-activating.
  const planless = {id:15,status:'Pending',cid:'SAP-C-9-12',name:'Rack C',templateId:2,customerId:state.customers[0].id,customData:{bandwidthMbps:100},plannedActiveAt:new Date('2099-01-01T00:00:00Z'),updatedAt:new Date('2026-10-20T00:00:00Z')};
  state.services.push(planless);
  await clearPlannedActivation(db,[planless.id]);
  assert.equal(state.services.find(item=>item.id===planless.id).plannedActiveAt,null,'deleting the plan stops automatic activation');
  assert.equal(state.services.find(item=>item.id===planless.id).status,'Pending');
  await syncPlannedActivation(db,{serviceId:planless.id,rfsDate:'2026-11-01'});
  assert.equal(state.services.find(item=>item.id===planless.id).plannedActiveAt.toISOString(),'2026-10-31T17:00:00.000Z','RFS edit moves the activation instant');

  console.log('PASS datacenter-registration: new customer/CID registered Pending with RFS instant, Data Center snapshot keeps work details, Resolve needs completion evidence and writes no status, RFS sweep activates once with audit, edit keeps intent and rejects CID swap/server marker, existing CID unchanged, future RFS allowed, plan deletion clears activation.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
