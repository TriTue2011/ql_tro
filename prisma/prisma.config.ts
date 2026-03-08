import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema.prisma'),
  datasource: {
    url: 'postgresql://postgres:postgres@localhost:5432/ql_tro',
  },
  migrate: {
    async adapter() {
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/ql_tro' })
      return new PrismaPg(pool)
    },
  },
})
