
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const inputUsername = 'Teknisi' // Simulating user input
  const inputPassword = '123456'  // Known password for technician

  const normalizedUsername = inputUsername.toLowerCase()
  console.log(`Input username: '${inputUsername}'`)
  console.log(`Normalized username: '${normalizedUsername}'`)

  const user = await prisma.user.findUnique({
    where: { username: normalizedUsername },
  })

  if (!user) {
    console.error('User not found!')
    return
  }

  console.log(`User found: ${user.username} (Role: ${user.role})`)

  const isPasswordValid = await bcrypt.compare(inputPassword, user.password)
  if (isPasswordValid) {
    console.log('Password valid! Login successful.')
  } else {
    console.error('Password invalid!')
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
