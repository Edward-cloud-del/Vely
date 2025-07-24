import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../../.env');

console.log('🔍 Loading environment variables from:', envPath);
console.log('🔍 File exists:', fs.existsSync(envPath));

// Load environment variables
dotenv.config({ path: envPath });

// Verify environment variables are loaded
console.log('🔍 Environment variables loaded:');
console.log('  DB_HOST:', process.env.DB_HOST);
console.log('  DB_PORT:', process.env.DB_PORT);
console.log('  DB_NAME:', process.env.DB_NAME);
console.log('  DB_USER:', process.env.DB_USER);
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'undefined'); 