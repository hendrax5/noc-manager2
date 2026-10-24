const fs=require('node:fs'),path=require('node:path'),{Client}=require('pg');
const {validateMigration}=require('./apply_workflow_reporting_migration.cjs');
const key='unified_performance_schema_v1';
async function main(){const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();try{
const sql=fs.readFileSync(path.join(__dirname,'../prisma/changes/20261024_unified_performance.sql'),'utf8');validateMigration(sql);
if(!process.argv.includes('--apply')){console.log('PASS additive SQL validation; dry-run, no writes.');return;}
await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(761234005)');
if((await db.query('SELECT 1 FROM "AppSetting" WHERE key=$1',[key])).rowCount){await db.query('ROLLBACK');console.log('Schema already applied.');return;}
await db.query(sql);await db.query('INSERT INTO "AppSetting"(key,value) VALUES($1,$2)',[key,JSON.stringify({version:1,appliedAt:new Date().toISOString()})]);await db.query('COMMIT');console.log('PASS additive migration; activation flags unchanged.');
}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{await db.end();}}
if(require.main===module)main().catch(e=>{console.error('Migration failed:',e.code||e.message);process.exitCode=1;});
