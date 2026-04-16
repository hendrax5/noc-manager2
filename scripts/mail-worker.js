const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// In a real scenario, IMAP configurations would come from the database (e.g. DCSite)
// or environment variables. We'll use env vars for now as a base structure.
const IMAP_HOST = process.env.IMAP_HOST || 'imap.gmail.com';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993');
const IMAP_USER = process.env.IMAP_USER || 'vms@example.com';
const IMAP_PASS = process.env.IMAP_PASS || 'password';
const IMAP_TLS = process.env.IMAP_TLS !== 'false';

const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_TLS,
    auth: {
        user: IMAP_USER,
        pass: IMAP_PASS
    },
    logger: false 
});

/**
 * Extracts permit data from email body using Regex.
 * Assuming format like:
 * PT: Example Corp
 * Tanggal: 2026-05-15
 * Pengunjung:
 * - John Doe
 * - Jane Doe
 * Kegiatan: Maintenance Server
 */
function parseEmailBody(text, textAsHtml) {
    // Implement basic extraction
    const ptMatch = text.match(/PT:\s*(.+)/i);
    const dateMatch = text.match(/Tanggal:\s*(.+)/i);
    const intentMatch = text.match(/Kegiatan:\s*(.+)/i);
    
    // Naively extract between "Pengunjung:" and "Kegiatan:"
    let visitorsText = "";
    const visitorMatch = text.match(/Pengunjung:([\s\S]+?)Kegiatan:/i);
    if (visitorMatch) {
        visitorsText = visitorMatch[1];
    }

    const visitors = visitorsText
        .split('\n')
        .map(v => v.replace(/^[\s-]/g, '').trim())
        .filter(v => v.length > 0)
        .map(v => ({ name: v, idNumber: "TBD", company: ptMatch ? ptMatch[1].trim() : "Unknown" }));

    return {
        company: ptMatch ? ptMatch[1].trim() : null,
        scheduledDate: dateMatch ? new Date(dateMatch[1].trim()) : new Date(),
        purpose: intentMatch ? intentMatch[1].trim() : "Not specified",
        visitors
    };
}

const main = async () => {
    console.log('Starting IMAP Mail Worker...');
    try {
        await client.connect();
        console.log('IMAP connected!');

        // Select and lock a mailbox. Throws if mailbox does not exist
        let lock = await client.getMailboxLock('INBOX');
        try {
            // Find unread messages
            for await (let message of client.fetch({ seen: false }, { source: true, uid: true })) {
                try {
                    const parsed = await simpleParser(message.source);
                    console.log(`Processing email from: ${parsed.from.text} Subject: ${parsed.subject}`);

                    const extracted = parseEmailBody(parsed.text, parsed.html);
                    
                    if (extracted.company && extracted.visitors.length > 0) {
                        // TODO: Map to actual DC Site based on TO email address or subject
                        // For now, let's just pick the first DCSite or assume a default region
                        const dcSite = await prisma.dCSite.findFirst();

                        if (dcSite) {
                            // Find or create customer
                            let customer = await prisma.customer.findFirst({
                                where: { name: extracted.company }
                            });

                            if (!customer) {
                                customer = await prisma.customer.create({
                                    data: {
                                        name: extracted.company,
                                        email: parsed.from.value[0].address,
                                    }
                                });
                            }

                            // Create Visit Permit
                            await prisma.visitPermit.create({
                                data: {
                                    dcSiteId: dcSite.id,
                                    customerId: customer.id,
                                    permitStatus: 'PENDING',
                                    scheduledDate: extracted.scheduledDate,
                                    purpose: extracted.purpose,
                                    visitors: extracted.visitors,
                                    // Set ticketId if this was created via a ticket
                                }
                            });
                            console.log(`Created PENDING permit for ${extracted.company}`);
                        }
                    }

                    // Mark as seen
                    await client.messageFlagsAdd(message.uid, ['\\Seen']);
                } catch (err) {
                    console.error('Error processing message:', err);
                }
            }
        } finally {
            // Make sure lock is released, otherwise next `getMailboxLock()` never returns
            lock.release();
        }

        await client.logout();
    } catch (err) {
        console.error('Mail Worker Error:', err);
    }
};

// Run periodically every 1 minutes
setInterval(main, 60 * 1000);
main();
