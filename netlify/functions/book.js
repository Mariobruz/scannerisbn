const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(null); } });
        }).on('error', reject);
    });
}

exports.handler = async (event) => {
    const parts = event.path.split('/');
    const isbn = parts[parts.length - 1];
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    try {
        const data = await fetchUrl(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`);
        if (data && data.totalItems > 0) {
            const book = data.items[0].volumeInfo;
            return { statusCode: 200, headers, body: JSON.stringify({
                trovato: true, isbn,
                titolo: book.title || '',
                autore: book.authors ? book.authors.join(', ') : '',
                anno: book.publishedDate ? book.publishedDate.substring(0, 4) : '',
                editore: book.publisher || '',
                genere: book.categories ? book.categories.join(', ') : '',
                pagine: book.pageCount ? String(book.pageCount) : '',
                haCopertina: !!(book.imageLinks?.thumbnail || book.imageLinks?.smallThumbnail)
            })};
        }
    } catch(e) {}

    try {
        const data = await fetchUrl(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
        const key = `ISBN:${isbn}`;
        if (data && data[key]) {
            const book = data[key];
            return { statusCode: 200, headers, body: JSON.stringify({
                trovato: true, isbn,
                titolo: book.title || '',
                autore: book.authors ? book.authors.map(a => a.name).join(', ') : '',
                anno: book.publish_date ? book.publish_date.slice(-4) : '',
                editore: book.publishers ? book.publishers[0]?.name || '' : '',
                genere: book.subjects ? book.subjects.slice(0,2).map(s => s.name).join(', ') : '',
                pagine: book.number_of_pages ? String(book.number_of_pages) : '',
                haCopertina: !!(book.cover?.medium || book.cover?.small)
            })};
        }
    } catch(e) {}

    return { statusCode: 200, headers, body: JSON.stringify({ trovato: false, isbn }) };
};
