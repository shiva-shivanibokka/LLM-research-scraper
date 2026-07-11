import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { env } from '@/lib/env'
import * as schema from './schema'

// HTTP driver — no long-lived pool, correct for Vercel serverless functions.
export const db = drizzle(neon(env.DATABASE_URL), { schema })
