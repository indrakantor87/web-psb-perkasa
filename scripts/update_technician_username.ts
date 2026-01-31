
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Updating technician username...')
  
  try {
    // Check if user 'technician' exists
    const oldUser = await prisma.user.findUnique({
      where: { username: 'technician' }
    })

    if (oldUser) {
      console.log("Found user 'technician'. Updating to 'teknisi'...")
      // Update username to 'teknisi'
      await prisma.user.update({
        where: { username: 'technician' },
        data: { 
          username: 'teknisi',
          name: 'Teknisi User' // Optional: update name to match style
        }
      })
      console.log("User updated successfully to 'teknisi'.")
    } else {
      console.log("User 'technician' not found. Checking if 'teknisi' already exists...")
      const newUser = await prisma.user.findUnique({
        where: { username: 'teknisi' }
      })
      if (newUser) {
        console.log("User 'teknisi' already exists.")
      } else {
        console.log("Neither 'technician' nor 'teknisi' found.")
      }
    }

  } catch (error) {
    console.error('Error updating username:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
