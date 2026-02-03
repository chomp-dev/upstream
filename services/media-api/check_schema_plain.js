
const { Pool } = require('pg');

const start = async () => {
    // Use the exact connection string from .env
    const pool = new Pool({
        connectionString: "postgresql://postgres.gpucrivkkqqdzmaruicu:MLBLHXDXusechomp.com123!@aws-1-us-east-2.pooler.supabase.com:6543/postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
    });

    try {
        console.log('🔍 Checking Posts Table Schema...');

        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'posts';
        `);
        console.log('Table "posts" columns:', res.rows);
    } catch (err) {
        console.error('❌ Check Failed:', err.message);
    } finally {
        await pool.end();
    }
};

start();
