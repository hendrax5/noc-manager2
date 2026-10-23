const fs=require('node:fs'),path=require('node:path'),{Client}=require('pg');
const KEY='workflow_reporting_schema_v1';
function validateMigration(sql){
 if(/\b(DROP|TRUNCATE)\b|(?:^|;)\s*(DELETE|UPDATE)\b|ALTER\s+COLUMN|RENAME\s+/i.test(sql.replace(/--[^\n]*/g,'')))throw new Error('Migrasi destruktif ditolak.');
 if(!sql.includes('CREATE TABLE'))throw new Error('Migrasi kosong.');
 return true;
}
function excludedDepartmentIds(rows){
 const normalize=s=>s.toLowerCase().replace(/[\s_-]+/g,'').trim();
 return rows.filter(r=>['administrasi','general','adminteknis'].includes(normalize(r.name))).map(r=>r.id);
}
async function main(){
 const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
 try{
 const sql=fs.readFileSync(path.join(__dirname,'../prisma/changes/20261023_workflow_reporting.sql'),'utf8');validateMigration(sql);
 const applied=(await client.query('SELECT value FROM "AppSetting" WHERE key=$1',[KEY])).rows[0];
 if(applied){console.log('Schema already applied; no writes.');return;}
 const departments=(await client.query('SELECT id,name FROM "Department"')).rows;
 const excluded=excludedDepartmentIds(departments);
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',excludedDepartmentIds:excluded,additive:true}));
 if(!process.argv.includes('--apply'))return;
 await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(761234004)');
 if((await client.query('SELECT value FROM "AppSetting" WHERE key=$1',[KEY])).rowCount){await client.query('ROLLBACK');console.log('Already applied by another process.');return;}
 await client.query(sql);
 for(const id of excluded)await client.query('INSERT INTO "EvaluationDepartmentEligibility" ("departmentId",enabled,reason,"updatedBy","updatedAt") VALUES ($1,false,$2,0,NOW()) ON CONFLICT ("departmentId") DO NOTHING',[id,'Dikecualikan sesuai kebijakan pengguna']);
 await client.query('INSERT INTO "AppSetting" (key,value) VALUES ($1,$2)',[KEY,JSON.stringify({version:1,appliedAt:new Date().toISOString()})]);
 await client.query('INSERT INTO "AppSetting" (key,value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING',['workflow_reporting_flags',JSON.stringify({work_phase_enabled:false,structured_daily_enabled:false,monthly_evaluation_mode:'off'})]);
 await client.query('COMMIT');console.log('Additive migration committed; all features OFF.');
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{await client.end();}
}
module.exports={validateMigration,excludedDepartmentIds};
if(require.main===module)main().catch(e=>{console.error('Migration failed:',e.code||e.message);process.exitCode=1;});
