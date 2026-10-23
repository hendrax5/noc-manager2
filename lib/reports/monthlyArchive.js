export async function isMonthlyArchive(db,ticketId){
 if(!Number.isSafeInteger(ticketId)||ticketId<1)return false;
 const ticket=await db.ticket.findUnique({where:{id:ticketId},select:{purpose:true}});
 return ticket?.purpose==='PersonalMonthlyReport';
}
