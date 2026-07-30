import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as typeof global & {
  prisma?: PrismaClient
}

const dbUrl = process.env.DATABASE_URL

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma