import {darkFiberData} from '@/lib/services/productUnits';
import {openPortUpdatedData,validateOpenPortData} from '@/lib/services/productBandwidth';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { checkServiceCid } from '@/lib/services/cidLookup';
import { CidValidationError, getServiceCid } from '@/lib/services/cid';
import { lockCircuitCodes, registerCircuitIdentifier } from '@/lib/services/circuitRegistry';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resolveParams = await params;

    const service = await prisma.service.findUnique({
      where: { id: parseInt(resolveParams.id) },
      include: {
        identifiers: {select:{code:true,family:true}},
        customer: true,
        template: true,
        hops: { orderBy: { orderIndex: 'asc' } },
        tickets: true
      }
    });

    if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(service);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && !session.user.permissions?.includes('manage_assets'))) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolveParams = await params;
    await prisma.service.delete({ where: { id: parseInt(resolveParams.id) } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && !session.user.permissions?.includes('manage_assets'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolveParams = await params;
    const body = await request.json();

    const serviceId = parseInt(resolveParams.id);
    await prisma.$transaction(async tx=>{
      const existing=await tx.service.findUnique({where:{id:serviceId}});
      if(!existing)throw new CidValidationError('Layanan tidak ditemukan.',404);
      const candidate={cid:body.cid===undefined?existing.cid:body.cid,customData:body.customData===undefined?existing.customData:body.customData};
      const code=getServiceCid(candidate);
      await lockCircuitCodes(tx,[code,getServiceCid(existing)]);
      await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;
      if(await tx.bodWindow.findFirst({where:{serviceId,activatedAt:{not:null},restoredAt:null,cancelledAt:null}}))throw new CidValidationError('BOD aktif. Konfirmasi pengembalian bandwidth normal sebelum mengedit Inventory.',409);
      const fresh=await tx.service.findUnique({where:{id:serviceId}});
      if(+new Date(fresh.updatedAt)!==+new Date(existing.updatedAt))throw new CidValidationError('Layanan berubah; muat ulang.',409);
      const serviceCid=await checkServiceCid(tx,candidate,serviceId);
      if(getServiceCid(existing))await registerCircuitIdentifier(tx,{serviceId,code:getServiceCid(existing),actorId:Number(session.user.id)});
      const updateData={};
      if(body.cid!==undefined||body.customData!==undefined)updateData.cid=serviceCid;
      if(body.name)updateData.name=body.name;
      if(body.status)updateData.status=body.status;
      if(body.customData){const template=await tx.serviceTemplate.findUnique({where:{id:fresh.templateId}});const next=darkFiberData(template,openPortUpdatedData(template,fresh.customData,body.customData),fresh.customData);validateOpenPortData(template,next);updateData.customData=next;}
      if(Object.keys(updateData).length)await tx.service.update({where:{id:serviceId},data:updateData});
      if(serviceCid)await registerCircuitIdentifier(tx,{serviceId,code:serviceCid,actorId:Number(session.user.id)});
      if(body.hops){
        await tx.circuitHop.deleteMany({where:{serviceId}});
        if(body.hops.length)await tx.circuitHop.createMany({data:body.hops.map((h,index)=>({serviceId,orderIndex:index,location:h.location,deviceName:h.deviceName,portName:h.portName,description:h.description}))});
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CidValidationError) return NextResponse.json({error:error.message},{status:error.status});
    if (error.code === 'P2002') return NextResponse.json({ error: 'CID sudah digunakan oleh layanan lain.' }, { status: 409 });
    console.error('PATCH Hop Error:', error);
    return NextResponse.json({ error: 'Failed to update topology' }, { status: 500 });
  }
}
