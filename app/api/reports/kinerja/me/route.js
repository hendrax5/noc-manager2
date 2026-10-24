import {prisma} from '@/lib/prisma';
import {loadPersonalKinerja} from '@/lib/reports/kinerjaServer';
import {kinerjaAccess,respond,failure} from '../shared';
export async function GET(req){try{const a=await kinerjaAccess(req);return respond(await loadPersonalKinerja(prisma,{...a,userId:Number(a.actor.id)}));}catch(e){return failure(e);}}
