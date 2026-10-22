// Compatibility API: SAP callers retain their URL and SAP-only listing.
import { loadCircuitCandidates, mapCircuitCandidate, linkKnownCircuit, CircuitAssetError, canManageCircuitAssets } from './circuitAssets.js';
import { extractSapCid } from './sapCid.js';
export { CircuitAssetError as SapAssetError, canManageCircuitAssets as canManageSapAssets };
export const loadSapCandidates=db=>loadCircuitCandidates(db,{family:'SAP'});
export function mapSapCircuit(db,body,actorId){
 if(!extractSapCid(body?.cid))throw new CircuitAssetError('CID harus berupa Subject SAP lengkap.');
 return mapCircuitCandidate(db,body,actorId);
}
export const linkExistingSapCircuit=linkKnownCircuit;
