// Script to migrate existing users.json to PostgreSQL
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'framesense',
    user: 'postgres',
    password: 'ditt-nya-lösenord',
});

async function migrateUsers() {
    try {
        // Read existing users.json
        const usersFile = path.join(__dirname, '../data/users.json');
        if (!fs.existsSync(usersFile)) {
            console.log('No users.json file found, skipping migration');
            return;
        }

        const userData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        const users = userData.users || {};

        console.log(`Found ${Object.keys(users).length} users to migrate`);

        for (const [email, user] of Object.entries(users)) {
            // Check if user already exists
            const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
            
            if (existingUser.rows.length > 0) {
                console.log(`User ${email} already exists, skipping`);
                continue;
            }

            // Hash password (use default if not set)
            const password = user.password || 'defaultpassword123';
            const passwordHash = await bcrypt.hash(password, 12);

            // Insert user
            await pool.query(
                `INSERT INTO users (email, name, password_hash, tier, subscription_status, stripe_customer_id, usage_daily, usage_total, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    email,
                    user.name || 'User',
                    passwordHash,
                    user.tier || 'free',
                    user.subscriptionStatus || 'inactive',
                    user.stripeCustomerId || null,
                    user.usage?.daily || 0,
                    user.usage?.total || 0,
                    user.createdAt || new Date().toISOString()
                ]
            );

            console.log(`✅ Migrated user: ${email} (${user.tier || 'free'})`);
        }

        console.log('🎉 Migration completed successfully!');
        
        // Backup original file
        const backupFile = usersFile + '.backup.' + Date.now();
        fs.copyFileSync(usersFile, backupFile);
        console.log(`📦 Original file backed up to: ${backupFile}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrateUsers(); 