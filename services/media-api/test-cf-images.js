
const fetch = require('node-fetch');
require('dotenv').config();

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

console.log('Testing Cloudflare Images API...');
console.log('Account ID:', ACCOUNT_ID);
console.log('API Token:', API_TOKEN ? 'Set (starts with ' + API_TOKEN.substring(0, 5) + ')' : 'Not Set');

async function testDirectUpload() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v2/direct_upload`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requireSignedURLs: false,
                metadata: { source: 'test-script' }
            }),
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

testDirectUpload();
