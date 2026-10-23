const fs=require('node:fs'),path=require('node:path'),{Client}=require('pg');
const KEY='ticket_forms_bod_v1';
async function main(){const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();try{
 if((await c.query('SELECT 1 FROM "AppSetting" WHERE key=$1',[KEY])).rowCount){console.log('Already applied.');return;}
 const categories=(await c.query('SELECT id,name,active FROM "JobCategory"')).rows;
 const get=name=>{const r=categories.find(x=>x.name.toLowerCase()===name.toLowerCase()&&x.active);if(!r)throw new Error('Missing active category: '+name);return r.id;};
 const mapping={Installation:get('Installasi'),Upgrade:get('Upgrade/Downgrade'),Downgrade:get('Upgrade/Downgrade'),Terminate:get('Terminate'),BOD:get('BOD')},defaults={Trouble:get('Troubleshoot'),Installation:get('Installasi')};
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',mapping,defaults,additiveSchema:true,legacyBodPreserved:true}));if(!process.argv.includes('--apply'))return;
 await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(761234005)');if((await c.query('SELECT 1 FROM "AppSetting" WHERE key=$1',[KEY])).rowCount){await c.query('ROLLBACK');return;}
 await c.query(fs.readFileSync(path.join(__dirname,'../prisma/changes/20261023_ticket_forms_bod.sql'),'utf8'));
 const change=(await c.query('INSERT INTO "JobCategory" (name,score,active) VALUES ($1,4,true) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id',['Perubahan Layanan'])).rows[0];mapping.Change=change.id;
 await c.query(`UPDATE "ServiceWorkType" SET name=name||' (legacy)',"normalizedName"="normalizedName"||'-legacy-'||id,active=false,"updatedAt"=NOW() WHERE lower(name)='bod' AND operation<>'BOD'`);
 await c.query(`INSERT INTO "ServiceWorkType" (name,"normalizedName",operation,"defaultJobCategoryId",active,"sortOrder","updatedAt") VALUES ('BOD','bod','BOD',$1,true,60,NOW()) ON CONFLICT ("normalizedName") DO NOTHING`,[mapping.BOD]);
 for(const [operation,id]of Object.entries(mapping))await c.query('UPDATE "ServiceWorkType" SET "defaultJobCategoryId"=$1,"updatedAt"=NOW() WHERE operation=$2 AND "defaultJobCategoryId" IS NULL',[id,operation]);
 await c.query('INSERT INTO "AppSetting" (key,value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING',['ticket_work_defaults',JSON.stringify(defaults)]);
 await c.query('INSERT INTO "AppSetting" (key,value) VALUES ($1,$2)',[KEY,JSON.stringify({version:1,appliedAt:new Date().toISOString(),mapping,defaults})]);await c.query('COMMIT');console.log('Ticket forms/BOD migration committed. Existing scores, customer/company data untouched.');
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{await c.end();}}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
