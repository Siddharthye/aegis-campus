import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

/**
 * Creates the tables AEGIS needs, once.
 *
 * Every statement in `sql/schema.sql` is `IF NOT EXISTS`, so running this
 * against a database that is already set up is a no-op rather than a mistake.
 */

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.argv[2] ?? null

if (!connectionString) {
  console.error('Usage: npm run db:setup            (with DATABASE_URL set)')
  console.error('   or: node scripts/db-setup.mjs <connection-string>')
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const schema = readFileSync(join(here, '..', 'sql', 'schema.sql'), 'utf8')

const sql = neon(connectionString)

/** Whether a chunk contains SQL, or is only the comments above one. */
const hasSql = (chunk) =>
  chunk
    .split('\n')
    .some((line) => line.trim().length > 0 && !line.trim().startsWith('--'))

// The HTTP driver sends one statement per request, so the file is split
// rather than shipped whole. Comments ride along with the statement they
// belong to — Postgres reads them fine, and dropping the chunk because it
// opens with one would silently skip the statement underneath.
const statements = schema
  .split(';')
  .map((statement) => statement.trim())
  .filter(hasSql)

for (const statement of statements) {
  const [subject] = statement.replace(/\s+/g, ' ').match(/(TABLE|INDEX) IF NOT EXISTS \S+/i) ?? [
    statement.slice(0, 40),
  ]
  await sql.query(statement)
  console.log(`  ok  ${subject}`)
}

const [{ tables }] = await sql`
  SELECT count(*)::int AS tables FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'aegis_%'
`
console.log(`\nAEGIS tables present: ${tables}`)
