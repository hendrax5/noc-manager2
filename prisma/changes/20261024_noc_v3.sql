ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "company" TEXT;
UPDATE "Service" SET "company" = 'SDC' WHERE UPPER(TRIM(COALESCE("company", "customData"->>'Order Origin',''))) IN ('SDC','PRODC');
UPDATE "Service" SET "company" = 'ION' WHERE UPPER(TRIM(COALESCE("company", "customData"->>'Order Origin',''))) = 'ION';

INSERT INTO "ServiceWorkType" ("name","normalizedName","operation","active","sortOrder","createdAt","updatedAt") VALUES
 ('Instalasi Kabel','instalasi kabel','DataCenter',true,200,NOW(),NOW()),
 ('Instalasi Rack','instalasi rack','DataCenter',true,210,NOW(),NOW()),
 ('Cross Connect','cross connect','DataCenter',true,220,NOW(),NOW()),
 ('Aktivasi Port','aktivasi port','DataCenter',true,230,NOW(),NOW()),
 ('Relokasi Perangkat','relokasi perangkat','DataCenter',true,240,NOW(),NOW()),
 ('Hands and Eyes','hands and eyes','DataCenter',true,250,NOW(),NOW()),
 ('Pekerjaan Power','pekerjaan power','DataCenter',true,260,NOW(),NOW()),
 ('Terminasi Data Center','terminasi data center','DataCenter',true,270,NOW(),NOW())
ON CONFLICT ("normalizedName") DO NOTHING;
