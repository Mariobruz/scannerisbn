const https = require('https');

function fetchImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyLibrary/1.0)', 'Accept': 'image/*' }
        }, (res) => {
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

exports.handler = async (event) => {
    const parts = event.path.split('/');
    const isbn = parts[parts.length - 1];

    const sources = [
        `https://books.google.com/books/content?vid=ISBN${isbn}&printsec=frontcover&img=1&zoom=1&source=gbs_api`,
        `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
        `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
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
