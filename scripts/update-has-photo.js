
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Start updating hasPhoto field...')

  const batchSize = 100
  let skip = 0
  let updatedCount = 0

  while (true) {
    const tickets = await prisma.ticket.findMany({
      skip,
      take: batchSize,
      select: {
        id: true,
        fotoRumah: true,
      },
    })

    if (tickets.length === 0) break

    for (const ticket of tickets) {
      const hasPhoto = !!ticket.fotoRumah && ticket.fotoRumah.length > 0
      
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { hasPhoto },
      })
      
      if (hasPhoto) {
        updatedCount++
      }
    }

    skip += batchSize
    console.log(`Processed ${skip} tickets...`)
  }

  console.log(`Finished! Updated ${updatedCount} tickets to hasPhoto=true.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
