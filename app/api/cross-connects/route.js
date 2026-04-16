import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/cross-connects
export async function POST(req) {
    try {
        const data = await req.json();
        const { sideARackId, sideAPort, sideZRackId, sideZPort, mediaType, customerId, siteId } = data;

        // Check A Side collision
        const aCollision = await prisma.crossConnect.findFirst({
            where: {
                OR: [
                    { sideARackId: sideARackId, sideAPort: sideAPort },
                    { sideZRackId: sideARackId, sideZPort: sideAPort } 
                ]
            }
        });

        if (aCollision) {
            return NextResponse.json({ error: "A-Side Port is already in use!" }, { status: 400 });
        }

        // Check Z Side collision
        const zCollision = await prisma.crossConnect.findFirst({
            where: {
                OR: [
                    { sideARackId: sideZRackId, sideAPort: sideZPort },
                    { sideZRackId: sideZRackId, sideZPort: sideZPort } 
                ]
            }
        });

        if (zCollision) {
            return NextResponse.json({ error: "Z-Side Port is already in use!" }, { status: 400 });
        }

        // Create cross connect
        const cc = await prisma.crossConnect.create({
            data: {
                siteId,
                sideARackId,
                sideAPort,
                sideZRackId,
                sideZPort,
                mediaType,
                customerId,
                status: 'ACTIVE'
            }
        });

        return NextResponse.json(cc, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
