const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const rack = await prisma.rack.findFirst();
    const customer = await prisma.customer.findFirst();
    const site = await prisma.dCSite.findFirst();

    console.log("Found Rack:", rack.id, "Customer:", customer.id, "Site: ", site.id);

    // Test Valid Registration
    const res = await fetch("http://localhost:3000/api/racks/equipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            rackId: rack.id,
            customerId: customer.id,
            name: "Server Baru",
            uStart: 1,
            uEnd: 2
        })
    });
    console.log("Racks API (Success):", res.status, await res.text());

    // Test Collision
    const resColl = await fetch("http://localhost:3000/api/racks/equipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            rackId: rack.id,
            customerId: customer.id,
            name: "Server Collision",
            uStart: 2,
            uEnd: 3
        })
    });
    console.log("Racks API (Collision):", resColl.status, await resColl.text());

    const res2 = await fetch("http://localhost:3000/api/cross-connects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            siteId: site.id,
            sideARackId: rack.id,
            sideAPort: "Eth1/1",
            sideZRackId: rack.id,
            sideZPort: "Eth1/2",
            mediaType: "UTPCat6",
            customerId: customer.id
        })
    });
    console.log("CrossConnect API:", res2.status, await res2.text());
}
run();
