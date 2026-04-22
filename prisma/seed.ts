import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('123456', 10)

  const users = [
    { name: 'Admin User', username: 'admin', role: 'ADMIN' },
    { name: 'Customer Service', username: 'cs', role: 'CS' },
    { name: 'NOC User', username: 'noc', role: 'NOC' },
    { name: 'Marketing User', username: 'marketing', role: 'MARKETING' },
    { name: 'Teknisi User', username: 'teknisi', role: 'TEKNISI' },
  ]

  for (const user of users) {
    const upsertUser = await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: {
        name: user.name,
        username: user.username,
        password,
        role: user.role,
      },
    })
    console.log({ upsertUser })
  }

  const packages = ['HOME LITE', 'HOME BASIC', 'HOME STREAM', 'HOME ENTERTAIN', 'HOME SMALL', 'HOME ADVAN']
  for (const name of packages) {
    const upsertPackage = await prisma.package.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    console.log({ upsertPackage })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
