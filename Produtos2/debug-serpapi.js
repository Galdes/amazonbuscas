import https from 'https';
import fs from 'fs';

const apiKey = 'd2b024ca951dad6d0408a9f977ce627faf750736c41bdcf7e1ea296cd6caee83';
const query = 'como desentupir cooktop';
const limit = 10;

const params = new URLSearchParams({
    q: query,
    api_key: apiKey,
    engine: "google",
    google_domain: "google.com.br",
    gl: "br",
    hl: "pt-br",
    num: limit.toString()
});

const url = `https://serpapi.com/search?${params.toString()}`;

console.log(`Testing SerpApi with URL: ${url}`);

const req = https.get(url, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const jsonData = JSON.parse(data);
            let output = '';
            if (jsonData.organic_results) {
                output += `Results count: ${jsonData.organic_results.length}\n`;
                if (jsonData.organic_results.length > 0) {
                    output += `First result: ${JSON.stringify(jsonData.organic_results[0], null, 2)}\n`;
                }
            } else if (jsonData.error) {
                output += `API Error: ${jsonData.error}\n`;
            } else {
                output += `No organic results found. Response keys: ${Object.keys(jsonData).join(', ')}\n`;
            }
            fs.writeFileSync('debug-serpapi-output.txt', output);
            console.log('Output written to debug-serpapi-output.txt');
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw data:', data.substring(0, 200));
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});
