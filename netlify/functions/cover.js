const https = require('https');

const ISBNDB_KEY = '68230_4ec78d387fc30f039afae2f9187cc6fa';

function fetchImage(url, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*', ...extraHeaders };
        https.get(url, { headers }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return fetchImage(res.headers.location).then(resolve).catch(reject);
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({
                buffer: Buffer.concat(chunks),
                contentType: res.headers['content-type'] || 'image/jpeg',
                status: res.statusCode
            }));
        }).on('error', reject);
    });
}

async function getIsbndbCover(isbn) {
    return new Promise((resolve, reject) => {
        https.get(`https://api2.isbndb.com/book/${isbn}`,
            { headers: { 'Authorization': ISBNDB_KEY, 'User-Agent': 'Mozilla/5.0' } },
            (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const d = JSON.parse(data);
                        resolve(d?.book?.image || null);
                    } catch(e) { resolve(null); }
                });
            }
        ).on('error', () => resolve(null));
    });
}

exports.handler = async (event) => {
    const parts = event.path.split('/');
    const isbn = parts[parts.length - 1];

    // Prima prova ISBNdb per la copertina
    const isbndbCover = await getIsbndbCover(isbn);
    
    const sources = [
        ...(isbndbCover ? [isbndbCover] : []),
        `https://books.google.com/books/content?vid=ISBN${isbn}&printsec=frontcover&img=1&zoom=1&source=gbs_api`,
        `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
    ];

    for (const url of sources) {
        try {
            const result = await fetchImage(url);
            if (result.status === 200 && result.buffer.length > 2000) {
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': result.contentType,
                        'Cache-Control': 'public, max-age=604800',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: result.buffer.toString('base64'),
                    isBase64Encoded: true
                };
            }
        } catch(e) { continue; }
    }

    return { statusCode: 404, body: 'Cover not found' };
};
