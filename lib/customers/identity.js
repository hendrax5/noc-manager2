/** Stable presentation of the existing customer identity; names never determine IDs. */
export function formatCustomerId(customer) {
  const id=Number(customer?.id);
  return Number.isSafeInteger(id)&&id>0 ? `ION-CUST-${String(id).padStart(6,'0')}` : '';
}
export const withCustomerCode=customer=>({...customer,customerCode:formatCustomerId(customer)});
