import dotenv from 'dotenv';
dotenv.config();

import { Pool, PoolClient } from 'pg';

// Debug logging to see what environment variables are being used
console.log('🔍 Database connection config:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '***' : 'undefined');
console.log('  DB_HOST:', process.env.DB_HOST);
console.log('  DB_PORT:', process.env.DB_PORT);
console.log('  DB_NAME:', process.env.DB_NAME);
console.log('  DB_USER:', process.env.DB_USER);
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'undefined');

// Use Railway's DATABASE_URL if available, otherwise fall back to individual variables
const pool = new Pool(
    process.env.DATABASE_URL 
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }
        : {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }
);

// Test the connection immediately
pool.query('SELECT current_database(), current_user', (err, result) => {
    if (err) {
        console.error('❌ Database connection test failed:', err.message);
    } else {
        console.log('✅ Database connection test successful:');
        console.log('  Database:', result.rows[0].current_database);
        console.log('  User:', result.rows[0].current_user);
    }
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export const getClient = (): Promise<PoolClient> => pool.connect();

export default pool; 