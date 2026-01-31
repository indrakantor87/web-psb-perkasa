
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Updating technician role...')
  
  try {
    // Find users with role 'TECHNICIAN'
    const users = await prisma.user.findMany({
      where: { role: 'TECHNICIAN' }
    })

    console.log(`Found ${users.length} users with role 'TECHNICIAN'.`)

    if (users.length > 0) {
      // Update them to 'TEKNISI'
      const updateResult = await prisma.user.updateMany({
        where: { role: 'TECHNICIAN' },
        data: { role: 'TEKNISI' }
      })
      console.log(`Updated ${updateResult.count} users to role 'TEKNISI'.`)
    } else {
      console.log('No users found with role TECHNICIAN.')
    }
    
    // Also check for the specific 'technician' user just in case
    const techUser = await prisma.user.findUnique({
      where: { username: 'technician' }
    })
    
    if (techUser && techUser.role !== 'TEKNISI') {
       console.log(`User 'technician' has role '${techUser.role}'. Updating to 'TEKNISI'...`)
       await prisma.user.update({
         where: { username: 'technician' },
         data: { role: 'TEKNISI' }
       })
       console.log(`User 'technician' updated.`)
    }

  } catch (error) {
    console.error('Error updating role:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
