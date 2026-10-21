import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeMasterName, canManageTroubleMasters, validateTroubleMaster, troubleMasterError, TROUBLE_MASTER_KINDS } from './troubleMasters.js';

test('normalizes Unicode, whitespace and case; validates bounded fields', () => {
  assert.equal(normalizeMasterName('  ＦＯ\t Cut  '), 'fo cut');
  assert.equal(validateTroubleMaster({ kind: 'cause', name: '  FO  Cut ' }).normalizedName, 'fo cut');
  for (const body of [{kind:'bad',name:'x'},{kind:'cause',name:'  '},{kind:'cause',name:'x'.repeat(81)},{kind:'cause',name:'x',sortOrder:Infinity},{kind:'cause',name:'x',description:'x'.repeat(301)},{kind:'cause',name:'x',active:'false'}]) assert.throws(() => validateTroubleMaster(body));
  assert.throws(() => validateTroubleMaster({},true));
  assert.deepEqual(validateTroubleMaster({active:false},true), {active:false});
});

test('permission is independent from manage_settings and requires explicit grant', () => {
  assert.equal(canManageTroubleMasters({role:{name:'Admin'}}),true);
  assert.equal(canManageTroubleMasters({role:{permissions:['manage_trouble_master']}}),true);
  assert.equal(canManageTroubleMasters({permissions:['manage_trouble_master']}),true);
  assert.equal(canManageTroubleMasters({permissions:['manage_settings']}),false);
  assert.equal(canManageTroubleMasters(null),false);
});

async function routes(file, user, db = {}) {
  let source = await readFile(new URL(`../../app/api/trouble-masters/${file}`,import.meta.url),'utf8');
  source = source.replace(/^import .*;\r?\n/gm,'').replace(/export async function /g,'async function ');
  const context = vm.createContext({ URL, Number, Object, Error, SyntaxError, NextResponse:{ json:(body,init={}) => ({body,status:init.status || 200}) }, getMasterUser:async()=>user, prisma:{troubleMasterEntry:db}, canManageTroubleMasters, validateTroubleMaster, troubleMasterError, TROUBLE_MASTER_KINDS });
  vm.runInContext(`${source}\nthis.handlers = { ${file === 'route.js' ? 'GET, POST' : 'PATCH'} };`,context);
  return context.handlers;
}

test('GET authenticates and restricts inactive reads; operators receive only active options',async()=>{
  assert.equal((await (await routes('route.js',null)).GET({url:'http://test/api'})).status,401);
  const api = await routes('route.js',{role:{permissions:[]}},{findMany:async args => { assert.equal(args.where.active,true); assert.equal(args.where.kind,'cause'); return []; }});
  assert.equal((await api.GET({url:'http://test/api?includeInactive=true'})).status,403);
  assert.equal((await api.GET({url:'http://test/api?kind=cause'})).status,200);
  assert.equal((await api.GET({url:'http://test/api?kind=other'})).status,400);
  const managerApi = await routes('route.js',{role:{name:'Admin'}},{findMany:async args => { assert.equal(Object.hasOwn(args.where,'active'),false); return []; }});
  assert.equal((await managerApi.GET({url:'http://test/api?includeInactive=true'})).status,200);
});

test('POST/PATCH enforce ACL and map unique races without database error leaks',async()=>{
  const req = {json:async()=>({kind:'symptom',name:'FO cut'})};
  const unauthorized = await routes('route.js',{role:{permissions:[]}});
  assert.equal((await unauthorized.POST(req)).status,403);
  const forbiddenPatch = await routes('[id]/route.js',{role:{permissions:['manage_settings']}});
  assert.equal((await forbiddenPatch.PATCH(req,{params:Promise.resolve({id:'1'})})).status,403);
  const manager = {role:{permissions:['manage_trouble_master']}};
  const duplicate = await routes('route.js',manager,{create:async()=>{throw {code:'P2002',message:'secret database constraint'};}});
  const response = await duplicate.POST(req);
  assert.equal(response.status,409);
  assert.ok(!response.body.error.includes('secret'));
  assert.equal((await duplicate.POST({json:async()=>{throw new SyntaxError('bad JSON');}})).status,400);
  const patch = await routes('[id]/route.js',manager,{findUnique:async()=>null,update:async()=>{throw {code:'P2025'};}});
  assert.equal((await patch.PATCH(req,{params:Promise.resolve({id:'1'})})).status,404);
  assert.equal((await patch.PATCH(req,{params:Promise.resolve({id:'1x'})})).status,400);
  assert.equal(troubleMasterError({message:'secret'}).status,500);
});

test('PATCH keeps referenced master kind immutable while allowing unchanged kind and rename',async()=>{
  let updates = 0;
  const patch = await routes('[id]/route.js',{role:{name:'Admin'}},{
    findUnique:async()=>({kind:'cause'}),
    update:async({data})=> { updates++; assert.equal(data.kind,undefined); return {id:2,kind:'cause',...data}; },
  });
  const context = {params:Promise.resolve({id:'2'})};
  const rejected = await patch.PATCH({json:async()=>({kind:'symptom',name:'Changed'})},context);
  assert.equal(rejected.status,400);
  assert.equal(updates,0);
  const renamed = await patch.PATCH({json:async()=>({kind:'cause',name:'Renamed cause'})},context);
  assert.equal(renamed.status,200);
  assert.equal(renamed.body.name,'Renamed cause');
  assert.equal(updates,1);
});

test('actual auth helper reads permission-only role from database rather than token grants',async()=>{
  let source = await readFile(new URL('../../app/api/trouble-masters/user.js',import.meta.url),'utf8');
  source = source.replace(/^import .*;\r?\n/gm,'').replace(/export async function /g,'async function ');
  let role = {name:'Operator',permissions:['manage_trouble_master']};
  let lookups = 0;
  const context = vm.createContext({
    getServerSession:async()=>({user:{id:'42',role:'Admin',permissions:['manage_trouble_master']}}),
    authOptions:{},
    prisma:{user:{findUnique:async args => { lookups++; assert.equal(args.where.id,42); assert.equal(args.include.role,true); return {id:42,role}; }}},
  });
  vm.runInContext(`${source}\nthis.getUser = getMasterUser;`,context);
  assert.equal(canManageTroubleMasters(await context.getUser()),true);
  role = {name:'Operator',permissions:[]};
  assert.equal(canManageTroubleMasters(await context.getUser()),false);
  assert.equal(lookups,2);
});
