
const { Pool } = require('pg');

const start = async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is required');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
    });

    try {
        console.log('🔍 Checking Videos Table Schema...');

        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'videos';
        `);
        console.log('Table "videos" columns:', res.rows);
    } catch (err) {
        console.error('❌ Check Failed:', err.message);
    } finally {
        await pool.end();
    }
};

start();
