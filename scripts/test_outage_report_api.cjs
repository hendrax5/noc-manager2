const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

async function main() {
  const root = path.resolve(__dirname, '..');
  const state = { session: null, calls: [], tickets: [] };
  globalThis.__outageApiTest = state;
  const mocks = {
    'next/server': 'export const NextResponse = {json:(body,init)=>new Response(JSON.stringify(body),init)};',
    'next-auth': 'export async function getServerSession(){return globalThis.__outageApiTest.session}',
    '../../auth/[...nextauth]/route': 'export const authOptions={};',
    '@/lib/prisma': 'export const prisma={ticket:{findMany:async(options)=>{globalThis.__outageApiTest.calls.push(options);return globalThis.__outageApiTest.tickets}}};',
  };
  const result = await esbuild.build({
    entryPoints:[path.join(root,'app/api/reports/outages/route.js')],bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':root},
    plugins:[{name:'isolated-api-dependencies',setup(build){build.onResolve({filter:/.*/},args=>mocks[args.path]?{path:args.path,namespace:'mock'}:undefined);build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}],
  });
  const compiled = new Module(path.join(root,'api-test.cjs'), module);
  compiled.filename = path.join(root, 'api-test.cjs');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  const { GET } = compiled.exports;
  const request=(query='')=>new Request('http://localhost/api/reports/outages?'+query);
  assert.equal((await GET(request())).status,401);
  state.session={user:{role:'Staff',permissions:[]}};
  assert.equal((await GET(request())).status,403);
  assert.equal(state.calls.length,0);
  for(const user of [{role:'Admin'},{role:'Manager'},{role:'Staff',permissions:['view_reports']}]){
    state.session={user};
    const response=await GET(request('startDate=2026-10-01&endDate=2026-10-21&durationOperator=gt&durationHours=10&cause=FO+CUT'));
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    const body=await response.json();
    assert.equal(body.filters.cause,'FO CUT');assert.equal(body.filters.durationHours,10);
  }
  const count=state.calls.length;
  for(const query of ['startDate=2026-02-30','durationOperator=bad','durationHours=-1','startDate=2026-12-01&endDate=2026-01-01'])assert.equal((await GET(request(query))).status,400);
  assert.equal(state.calls.length,count);
  const options=state.calls[0];
  assert.deepEqual(options.where,{customData:{path:['hasDowntime'],equals:true}});
  assert.deepEqual(options.select.comments.where,{isPublic:true});
  assert.equal(options.select.notes,undefined);
  delete globalThis.__outageApiTest;
  console.log('PASS: unauthenticated 401, unauthorized 403, Admin/Manager/view_reports 200, validation 400 before DB access, no-store, public comments only. Isolated route dependencies.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
