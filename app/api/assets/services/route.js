import {darkFiberData} from '@/lib/services/productUnits';
import {recordActivity} from '@/lib/activity/recordActivity';
import {openPortDefaultData,validateOpenPortData} from '@/lib/services/productBandwidth';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { checkServiceCid } from '@/lib/services/cidLookup';
import { CidValidationError, getServiceCid } from '@/lib/services/cid';
import { lockCircuitCodes, registerCircuitIdentifier } from '@/lib/services/circuitRegistry';
import {normalizeCompanyAsync} from '@/lib/companies/server';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    
    let where = {};
    if (customerId) where.customerId = parseInt(customerId);

    const services = await prisma.service.findMany({
      where,
      include: {
        identifiers: {select:{code:true,family:true}},
        customer: true,
        template: true,
        hops: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { tickets: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(services);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && !session.user.permissions?.includes('manage_assets'))) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { customerId, templateId, name, cid, status, company, customData, monthlyCost, currency, contractEnd, hops } = await request.json();
    const template=await prisma.serviceTemplate.findUnique({where:{id:parseInt(templateId)}});
    const bandwidthData=darkFiberData(template,openPortDefaultData(template,customData||{}));validateOpenPortData(template,bandwidthData);
    const service = await prisma.$transaction(async tx=>{
    await lockCircuitCodes(tx,[getServiceCid({cid,customData})]);
    const serviceCid=await checkServiceCid(tx,{cid,customData});
    let normalizedCompany;
    try { normalizedCompany = await normalizeCompanyAsync(company); }
    catch (companyError) { throw new CidValidationError(companyError.message, 400); }
    const created=await tx.service.create({
      data: {
        customerId: parseInt(customerId),
        templateId: parseInt(templateId),
        name,
        cid: serviceCid,
        status: status || 'Active',
        company: normalizedCompany,
        customData: bandwidthData,
        monthlyCost: monthlyCost ? parseFloat(monthlyCost) : null,
        currency: currency || 'IDR',
        contractEnd: contractEnd ? new Date(contractEnd) : null,
        hops: {
          create: (hops || []).map((h, i) => ({
            orderIndex: i,
            location: h.location,
            deviceName: h.deviceName,
            portName: h.portName,
            description: h.description
          }))
        }
      },
      include: { hops: true }
    });
    if(serviceCid)await registerCircuitIdentifier(tx,{serviceId:created.id,code:serviceCid,actorId:Number(session.user.id),source:'human'});
    await recordActivity(tx,{actorId:Number(session.user.id),source:'human',type:'service.created',entityType:'service',entityId:created.id,after:created});
    return created;
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error(error);
    if (error instanceof CidValidationError) return NextResponse.json({error:error.message},{status:error.status});
    if (error.code === 'P2002') return NextResponse.json({ error: 'CID sudah digunakan oleh layanan lain.' }, { status: 409 });
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}
