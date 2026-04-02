const https = require('https');

const ISBNDB_KEY = '68230_4ec78d387fc30f039afae2f9187cc6fa';
const GOOGLE_KEY = 'AIzaSyD7luDhLE__OHBj_Q10OwSWr9GfG8SZLDs';

function fetchUrl(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const opts = { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } };
        https.get(url, opts, (res) => {
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

    // 1. ISBNdb — database completo inclusi editori italiani
    try {
        const data = await fetchUrl(
            `https://api2.isbndb.com/book/${isbn}`,
            { 'Authorization': ISBNDB_KEY }
        );
        if (data && data.book) {
            const book = data.book;
            return { statusCode: 200, headers, body: JSON.stringify({
                trovato: true, fonte: 'isbndb', isbn,
                titolo: book.title || '',
                autore: book.authors ? book.authors.join(', ') : '',
                anno: book.date_published ? String(book.date_published).substring(0, 4) : '',
                editore: book.publisher || '',
                genere: book.subjects ? book.subjects.slice(0,2).join(', ') : '',
                pagine: book.pages ? String(book.pages) : '',
                haCopertina: !!book.image
            })};
        }
    } catch(e) {}

    // 2. Google Books dal backend (con API key)
    try {
        const data = await fetchUrl(
            `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1&key=${GOOGLE_KEY}`
        );
        if (data && data.totalItems > 0) {
            const book = data.items[0].volumeInfo;
            return { statusCode: 200, headers, body: JSON.stringify({
                trovato: true, fonte: 'google', isbn,
                titolo: book.title || '',
                autore: book.authors ? book.authors.join(', ') : '',
                anno: book.publishedDate ? book.publishedDate.substring(0, 4) : '',
                editore: book.publisher || '',
                genere: book.categories ? book.categories.join(', ') : '',
                pagine: book.pageCount ? String(book.pageCount) : '',
                haCopertina: !!(book.imageLinks?.thumbnail)
            })};
        }
    } catch(e) {}

    // 3. Open Library fallback
    try {
        const data = await fetchUrl(
            `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
        );
        const key = `ISBN:${isbn}`;
        if (data && data[key]) {
            const book = data[key];
            return { statusCode: 200, headers, body: JSON.stringify({
                trovato: true, fonte: 'openlibrary', isbn,
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
