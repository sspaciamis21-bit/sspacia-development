console.log("DATABASE_URL =", process.env.DATABASE_URL);

import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as typeof global & {
  prisma?: PrismaClient
}

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      // process.env.DATABASE_URL is statically replaced by webpack at build time
      // via next.config.ts env{} block, so Prisma receives the value directly
      // rather than reading from the OS environment at runtime (which is empty on Hostinger).
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma