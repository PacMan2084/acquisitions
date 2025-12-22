import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

console.log('🔗 Connecting to database...');
console.log('NODE_ENV:', process.env.NODE_ENV);

// For local development, use postgres-js
// For production, use @neondatabase/serverless
let db;

if (process.env.NODE_ENV === 'development') {
  // Local PostgreSQL connection
  const client = postgres(process.env.DATABASE_URL);
  db = drizzle(client);

  // Test connection
  try {
    await client`SELECT 1`;
    console.log('✅ Database connected successfully (Local PostgreSQL)');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
} else {
  // Production: Use Neon serverless
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle: drizzleNeon } = await import('drizzle-orm/neon-http');

  const sql = neon(process.env.DATABASE_URL);
  db = drizzleNeon(sql);

  console.log('✅ Database connected (Neon Cloud)');
}

export { db };
