import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/racks/equipments
export async function POST(req) {
    try {
        const data = await req.json();
        const { rackId, name, uStart, uEnd, customerId } = data;

        // Check if there's any collision in the same rack
        const existingEq = await prisma.rackEquipment.findMany({
            where: {
                rackId: rackId,
                OR: [
                    {
                        uStart: { lte: uEnd },
                        uEnd: { gte: uStart }
                    }
                ]
            }
        });

        if (existingEq.length > 0) {
            return NextResponse.json({ error: "U-Space Collision Detected!" }, { status: 400 });
        }

        const newEq = await prisma.rackEquipment.create({
            data: {
                rackId,
                name,
                uStart,
                uEnd,
                customerId
            }
        });

        return NextResponse.json(newEq, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
