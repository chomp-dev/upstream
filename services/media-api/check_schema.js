
const { pool } = require('./src/db');

const checkSchema = async () => {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts';
    `);
        console.log('Table "posts" columns:', res.rows);
    } catch (err) {
        console.error('Error checking schema:', err);
    } finally {
        await pool.end();
    }
};

checkSchema();
