// Customer-name extraction and safe registry matching for legacy CID source names.
// Fixtures only: no database, no network.
// Run with: node scripts/test_customer_suggestion.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

async function main() {
  const root = path.resolve(__dirname, '..');
  const built = await esbuild.build({
    stdin:{contents:"export {extractCustomerName,suggestCustomer,suggestServiceCompany} from '@/lib/services/customerSuggestion.js';",resolveDir:root,loader:'js'},
    bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':root},
  });
  const filename = path.join(root,'customer-suggestion-fixture.cjs');
  const mod = new Module(filename,module);
  mod.filename = filename; mod.paths = module.paths;
  mod._compile(built.outputFiles[0].text,filename);
  const {extractCustomerName,suggestCustomer,suggestServiceCompany} = mod.exports;

  // 1. Company name extraction from legacy ticket subjects.
  assert.equal(extractCustomerName('PT JARINGAN TIANG INDONESIA GROUP-OFFICE KALIGELAN'),'PT Jaringan Tiang Indonesia Group');
  assert.equal(extractCustomerName('PT PGD Xcon MMR IPT to Rack AIR LINTAS KOMUNIKASI'),'Air Lintas Komunikasi');
  assert.equal(extractCustomerName('PT PGD Xcon MMR METRO to Rack MOLINDO MEDIA PERSADA, PT'),'Molindo Media Persada');
  assert.equal(extractCustomerName('RABIK BANGUN NUSANTARA, PT site Equinix Singapore'),'Rabik Bangun Nusantara');
  assert.equal(extractCustomerName('BUSANO INTERNET KITA, PT Sewa Core u/ 99 TEKNOLOGI'),'Busano Internet Kita');
  assert.equal(extractCustomerName('PT. PIONEER NUSAT ECHNOLOGY Site OFFICE GANDOANG BOGOR (JEMPUT DI CLOSURE ION)'),'PT Pioneer Nusat Echnology');
  assert.equal(extractCustomerName('[HUB] LAZADA'),'Lazada');
  assert.equal(extractCustomerName('BASARNAS)'),'BASARNAS','known acronyms keep their uppercase form');
  assert.equal(extractCustomerName('PT JMTO site JAKARTA'),'PT JMTO');
  assert.equal(extractCustomerName('PT(RSTNet'),'PT RSTNet');
  assert.equal(extractCustomerName('PT SURABAYA ALUMINIUM INDUSTRY Site CUSTOM OFFICE'),'PT Surabaya Aluminium Industry');

  // 2. Registry matching is conservative: never merge two different companies on a shared city/generic word.
  const customers = [
    {id:1,name:'PT JARINGAN TIANG INDONESIA GROUP'},
    {id:2,name:'PT Lazada'},
    {id:3,name:'PT NetToCyber Indonesia',aliases:['VELO','VELO NET']},
    {id:4,name:'PT SURABAYA KENCANA ANUGRAH'},
    {id:5,name:'PT RSTNet'},
    {id:6,name:'YAYASAN TARUMANAGARA'},
    {id:7,name:'PT INDO TELEMEDIA SOLUSI'},
    {id:8,name:'AIR LINTAS KOMUNIKASI, PT'},
    {id:9,name:'PT NESTA INDO MEDIA'},
    {id:10,name:'PT Mega Data Net'},
    {id:11,name:'PT Cipta Data Global'},
    {id:12,name:'PT Lintas Media Solusindo'},
    {id:13,name:'PT INDO TELEMEDIA SOLUSI (ION PARTNERSHIP)',aliases:JSON.stringify(['INDOTEL','INTELMEDIA'])},
  ];
  const suggest = source => suggestCustomer(source, customers);
  assert.equal(suggest('PT JARINGAN TIANG INDONESIA GROUP-OFFICE KALIGELAN').customerId,1);
  assert.equal(suggest('PT JARINGAN TIANG INDONESIA').customerId,1,'shorter legacy name still resolves to the same PT');
  assert.equal(suggest('PT Velo Net').customerId,3);
  assert.equal(suggest('PT INDOTEL Site PT JOYO NETWORK SOLUTION').customerId,13,'legacy brand alias resolves to the registered target');
  assert.equal(suggest('PT INDOTEL- CV BUY COMP SITE GONILAN').customerId,13,'downstream customer note after a dash is not part of the brand');
  assert.equal(suggest('PT Intelmedia site GANDOANG').customerId,13);
  assert.equal(suggest('PT NETTOCYBER INDONESIA (VELO) Site LAZADA').customerId,3);
  assert.equal(suggest('PT (Velo Net) site Kerry Express Indonesia').customerId,3);
  assert.equal(suggest('[HUB] LAZADA').customerId,2);
  assert.equal(suggest('PT PGD Xcon MMR IPT to Rack AIR LINTAS KOMUNIKASI').customerId,8);
  assert.equal(suggest('PT RSTNet)').customerId,5);
  assert.equal(suggest('PT SURABAYA ALUMINIUM INDUSTRY Site CUSTOM OFFICE').status,'new','shared city token alone must not match');
  assert.equal(suggest('YAYASAN BINA INSAN MEDIKA site SEKOLAH TINGGI ILMU KESEHATAN PASAR REBO').status,'new','shared legal word alone must not match');
  assert.equal(suggest('PT MEGA DATA AKSES site GUDANG').status,'new','partial name overlap must not merge different companies');
  assert.equal(suggest('PT SARANA CIPTA KOMUNIKASI site JAKARTA').status,'new');
  assert.equal(suggest('PT LINTAS TEKNOLOGI SOLUSINDO site BANDUNG').status,'new');
  assert.equal(suggest('PT INDO TELEMEDIA').customerId,7);
  assert.equal(suggest('PT NESTA INDO MEDIA site Rack').customerId,9);

  // 3. Missing companies are proposed with a readable PT name, never silently linked.
  const proposal = suggest('PT JARINGAN TIANG BARU site GUDANG');
  assert.equal(proposal.status,'new');
  assert.equal(proposal.customerId,null);
  assert.equal(proposal.proposedName,'PT Jaringan Tiang Baru');
  assert.equal(suggest('').status,'unknown');

  // 4. Service company hint from legacy ticket customData.
  const companies = [{code:'ION',name:'ION',aliases:[]},{code:'SDC',name:'SDC',aliases:['PRODC','NOC DATACENTER']}];
  assert.equal(suggestServiceCompany('ION',companies),'ION');
  assert.equal(suggestServiceCompany('prodc',companies),'SDC');
  assert.equal(suggestServiceCompany('tidak ada',companies),null);
  assert.equal(suggestServiceCompany('',companies),null);

  console.log('PASS customer-suggestion: PT name extraction (site/racket/alias forms), conservative registry matching (no city/legal-word false positives), new-customer proposal, and service-company hint.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
