import test from 'node:test';
import assert from 'node:assert/strict';
import { installationSubject, serviceWorkSubject } from './subject.js';

test('installation subject adds the site name after the CID', () => {
  assert.equal(
    installationSubject({ cid: 'SAP-C-0006-0770', name: 'ERIK CAHYONO (PERORANGAN) #LINK 2' }),
    'Instalasi Baru - SAP-C-0006-0770 - ERIK CAHYONO (PERORANGAN) #LINK 2',
  );
});

test('installation subject degrades gracefully while the form is incomplete', () => {
  assert.equal(installationSubject({}), 'Instalasi Baru');
  assert.equal(installationSubject(), 'Instalasi Baru');
  assert.equal(installationSubject({ cid: 'SAP-C-0006-0770' }), 'Instalasi Baru - SAP-C-0006-0770');
  assert.equal(installationSubject({ name: 'ERIK CAHYONO' }), 'Instalasi Baru - ERIK CAHYONO');
  assert.equal(installationSubject({ cid: '  ', name: '  ' }), 'Instalasi Baru');
  assert.equal(installationSubject({ cid: null, name: null }), 'Instalasi Baru');
});

test('installation subject does not duplicate the same text twice', () => {
  assert.equal(
    installationSubject({ cid: 'SAP-C-0006-0770', name: 'sap-c-0006-0770' }),
    'Instalasi Baru - SAP-C-0006-0770',
  );
});

test('installation subject respects the 500 character subject limit', () => {
  const subject = installationSubject({ cid: 'C'.repeat(300), name: 'N'.repeat(400) });
  assert.equal(subject.length, 500);
  assert.ok(subject.startsWith('Instalasi Baru - CCC'));
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
