import test from 'node:test';
import assert from 'node:assert/strict';
import { installationSubject, serviceWorkSubject, siteLabel } from './subject.js';

const CUSTOMER_ION = 'PT INDO TELEMEDIA SOLUSI (ION PARTNERSHIP)';
const SITE_ION = 'ERIK CAHYONO (PERORANGAN) #LINK 2 JEMPUT DI CLOSURE ION -7.732225, 111.951258';

test('installation subject uses CID and Site labels without the customer name', () => {
  assert.equal(
    installationSubject({
      typeName: 'Instalasi Baru',
      cid: 'SAP-C-0006-0770',
      name: SITE_ION,
      customerName: CUSTOMER_ION,
    }),
    `Instalasi Baru - CID: SAP-C-0006-0770 - Site ${SITE_ION}`,
  );
});

test('site label drops a leading customer name', () => {
  assert.equal(
    siteLabel('PT Vissie Cyber Data Site POP Tulungagun', 'PT Vissie Cyber Data'),
    'POP Tulungagun',
  );
  assert.equal(
    siteLabel('PT. DWIDA JAYA TAMA SITE FATMAWATI', 'PT DWIDA JAYA TAMA'),
    'FATMAWATI',
  );
  assert.equal(
    siteLabel('PT INDAH SUBUR SEJATI', 'PT INDAH SUBUR SEJATI'),
    '',
  );
});

test('site label handles legal forms written after the name', () => {
  assert.equal(
    siteLabel('Transindonesia Network, PT site DEPAN GEDUNG GRAHA', 'PT TRANSINDONESIA NETWORK'),
    'DEPAN GEDUNG GRAHA',
  );
  assert.equal(
    siteLabel('GASTRO BERKAT USAHA, PT Site One Satrio Mall', 'PT GASTRO BERKAT USAHA'),
    'One Satrio Mall',
  );
  assert.equal(
    siteLabel('HERBALIFE INDONESIA , PT SITE SICC SENTUL', 'PT HERBALIFE INDONESIA'),
    'SICC SENTUL',
  );
});

test('site label matches customer names with brand notes in parentheses', () => {
  assert.equal(
    siteLabel('MEDIA AKSES DATA, PT (AKSES NET)  Site : OFFICE AKSES NET', 'MEDIA AKSES DATA ( MMD )'),
    'OFFICE AKSES NET',
  );
  assert.equal(
    siteLabel('MEDIA-AKSES-DATA-(AKSESNET)-Site-OFFICE-ARJAWINANGUN-OPEN-PORT', 'MEDIA AKSES DATA ( MMD )'),
    'OFFICE-ARJAWINANGUN-OPEN-PORT',
  );
});

test('site label keeps names that do not start with the customer', () => {
  assert.equal(
    siteLabel('PT ALCEN - ONE SATRIO SITE SUSHI HIRO', 'PT GEMILANG CATUR PERSADA'),
    'ALCEN - ONE SATRIO SITE SUSHI HIRO',
  );
  assert.equal(siteLabel('MK Site Desa Konstitusi', 'MAHKAMAH KONSTITUSI RI'), 'MK Site Desa Konstitusi');
  assert.equal(siteLabel('', CUSTOMER_ION), '');
  assert.equal(siteLabel(null, null), '');
});

test('site label handles customer names with a trailing brand note', () => {
  assert.equal(
    siteLabel(
      'PT TELKOM SATELIT INDONESIA (TELKOMSAT) Site PUSAT PENGENDALI SATELIT KLAPANUNGGAL.',
      'PT TELKOM SATELIT INDONESIA (TELKOMSAT) ',
    ),
    'PUSAT PENGENDALI SATELIT KLAPANUNGGAL',
  );
});

test('site label drops a leftover brand note after the customer prefix', () => {
  assert.equal(
    siteLabel('MEDIA-AKSES-DATA(AKSES.NET)-1GBPS-site-Karang-Tengah-I-0386-005-01-JEMPUT', 'MEDIA AKSES DATA ( MMD )'),
    '1GBPS-site-Karang-Tengah-I-0386-005-01-JEMPUT',
  );
  // A bracket that is not attached to the customer name must survive.
  assert.equal(
    siteLabel('(JEMPUT DI POP HSP) OFFICE', 'PT LAIN'),
    '(JEMPUT DI POP HSP) OFFICE',
  );
});

test('installation subject degrades gracefully while the form is incomplete', () => {
  assert.equal(installationSubject({}), 'Instalasi Baru');
  assert.equal(installationSubject(), 'Instalasi Baru');
  assert.equal(installationSubject({ cid: 'SAP-C-0006-0770' }), 'Instalasi Baru - CID: SAP-C-0006-0770');
  assert.equal(installationSubject({ name: 'ERIK CAHYONO' }), 'Instalasi Baru - Site ERIK CAHYONO');
  assert.equal(installationSubject({ cid: '  ', name: '  ' }), 'Instalasi Baru');
});

test('a site name that already says Site is not decorated twice', () => {
  assert.equal(
    installationSubject({ typeName: 'Instalasi Baru', cid: 'I-0283-003-01', name: 'PT Vissie Cyber Data Site POP Tulungagun', customerName: 'PT Vissie Cyber Data' }),
    'Instalasi Baru - CID: I-0283-003-01 - Site POP Tulungagun',
  );
  assert.equal(
    installationSubject({ typeName: 'Instalasi Baru', cid: 'C-0569-061-01', name: 'MK Site Desa Konstitusi', customerName: 'MAHKAMAH KONSTITUSI RI' }),
    'Instalasi Baru - CID: C-0569-061-01 - MK Site Desa Konstitusi',
  );
});

test('installation subject respects the 500 character subject limit', () => {
  const subject = installationSubject({ cid: 'C'.repeat(300), name: 'N'.repeat(400) });
  assert.equal(subject.length, 500);
  assert.ok(subject.startsWith('Instalasi Baru - CID: CCC'));
});

test('service work subject keeps the existing type - CID shape', () => {
  assert.equal(
    serviceWorkSubject('Upgrade Bandwidth', { cid: 'SAP-C-0006-0770', name: 'ERIK' }),
    'Upgrade Bandwidth - SAP-C-0006-0770',
  );
  assert.equal(serviceWorkSubject('Upgrade Bandwidth', { name: 'ERIK' }), 'Upgrade Bandwidth - ERIK');
  assert.equal(serviceWorkSubject('Upgrade Bandwidth', {}, 'SAP-C-0006-0770'), 'Upgrade Bandwidth - SAP-C-0006-0770');
  assert.equal(serviceWorkSubject('Upgrade Bandwidth', {}), 'Upgrade Bandwidth');
});
