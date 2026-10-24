import {prisma} from '@/lib/prisma';
import {loadPersonalKinerja} from '@/lib/reports/kinerjaServer';
import {kinerjaAccess,respond,failure} from '../../shared';
import {WorkflowError} from '@/lib/workflows/policy';
export async function GET(req,{params}){try{const a=await kinerjaAccess(req),userId=Number((await params).userId);if(!Number.isSafeInteger(userId)||userId<1)throw new WorkflowError('User tidak valid.');return respond(await loadPersonalKinerja(prisma,{...a,userId}));}catch(e){return failure(e);}}
