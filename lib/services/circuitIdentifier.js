/** Full Subject only. Numeric segments are opaque identifiers, never customer IDs. */
export function parseCircuitIdentifier(subject) {
  if (typeof subject !== 'string') return null;
  const code = subject.normalize('NFKC').trim().toUpperCase();
  if (code.length > 100) return null;
  if (/^SAP(?:-[A-Z0-9]+){2,}$/.test(code)) return { code, family: 'SAP', formatStatus: 'primary' };
  if (/^[IC]-\d{4}-\d{2,4}-\d{2,3}$/.test(code)) return { code, family: code[0], formatStatus: 'primary' };
  if (/^(?:[IC](?:\d+)?|BH|R|P|L|DCLAND-[IC])(?:-\d+){2,3}$/.test(code)) return { code, family: code.startsWith('DCLAND-') ? code.split('-').slice(0,2).join('-') : code.split('-')[0], formatStatus: 'review' };
  return null;
}
