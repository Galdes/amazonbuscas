import https from 'https';

const apiKey = 'Y2RkM2NlYWRkNmE4NDU5ODgzMjQ2MjA1OTM5N2E1NjR8MjVjNzgwNGJjYQ';
const url = 'https://api.app.outscraper.com/google-search-v3?query=test&limit=1&async=false';

console.log('Testing Outscraper API...');

const req = https.request(url, {
    method: 'GET',
    headers: {
        'X-API-KEY': apiKey
    }
}, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response Body:', data.substring(0, 200) + '...');
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
