const assert=require('node:assert/strict'),test=require('node:test');
const {validateMigration,excludedDepartmentIds}=require('./apply_workflow_reporting_migration.cjs');
test('migration additive only; stable exclusions case/punctuation normalization',()=>{
 assert.equal(validateMigration('CREATE TABLE "NewTable" (id INTEGER); ALTER TABLE "Ticket" ADD COLUMN "purpose" TEXT;'),true);
 assert.throws(()=>validateMigration('DROP TABLE "Ticket"'),/destruktif/i);
 assert.throws(()=>validateMigration('ALTER TABLE "Ticket" DROP COLUMN title;'),/destruktif/i);
 assert.deepEqual(excludedDepartmentIds([{id:1,name:'Administrasi'},{id:2,name:'GENERAL'},{id:3,name:'Admin Teknis'},{id:4,name:'NOC'}]),[1,2,3]);
});

test('shipped SQL permits FK ON UPDATE actions but no data-changing statements',()=>{const sql=require('fs').readFileSync(require('path').join(__dirname,'../prisma/changes/20261023_workflow_reporting.sql'),'utf8');assert.equal(validateMigration(sql),true);assert.throws(()=>validateMigration('CREATE TABLE a (id INT); UPDATE a SET id=2;'),/destruktif/i);});
