import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCircuitIdentifier } from './circuitIdentifier.js';
test('primary formats preserve full code, zeros and separators',()=>{
 for(const code of ['SAP-C-0037-00001','I-0275-021-01','I-0039-0012-01','C-1213-03-01','C-0409-001-044']){
  const parsed=parseCircuitIdentifier(` ${code.toLowerCase()} `);assert.equal(parsed.code,code);assert.equal(parsed.formatStatus,'primary');
 }
});
test('secondary and irregular numeric families remain review candidates',()=>{
 for(const code of ['I-0043-0305','I-0202-00101','I2-0026-0008','C4-0001-0001','BH-0468-001','R-0011-002-01','L-0315-001-01','P-0002-001-01','DCLAND-C-0003-0001','C-409-085-01'])assert.equal(parseCircuitIdentifier(code).formatStatus,'review');
 assert.notEqual(parseCircuitIdentifier('I-0202-00101').code,parseCircuitIdentifier('I-0202-001-01').code);
});
test('prose, arbitrary prefixes, incomplete and multiple codes are not identifiers',()=>{
 for(const code of [null,123,'ABC-001-002','PT-GAYATRI-LINTAS-NUSANTARA','Down I-0275-021-01','I-0275-021-01 / SAP-C-0389-0001','I-0275--01','I-0275-021-01\nextra'])assert.equal(parseCircuitIdentifier(code),null);
});
