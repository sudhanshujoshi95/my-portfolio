// Pulls new posts from the Medium RSS feed into data/articles.json, then
// re-renders the Writing section and the "Latest post" line in index.html.
//
// Entries already in articles.json are never overwritten, so hand-edited
// titles, summaries and topics survive every sync. Only new URLs are added.
//
// Usage: node scripts/sync-medium.mjs   (Node 18+, no dependencies)

import { readFile, writeFile } from 'node:fs/promises';

const FEED_URL = 'https://medium.com/feed/@sudhanshujoshi95';
const ARTICLES_PATH = new URL('../data/articles.json', import.meta.url);
const INDEX_PATH = new URL('../index.html', import.meta.url);
const MAX_ON_HOMEPAGE = 6;

const decode = (s) =>
    s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeHtml = (s) => escapeText(s).replace(/"/g, '&quot;');

const tag = (xml, name) => {
    const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
    return m ? decode(m[1]).trim() : '';
};

const stripTags = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Use whichever comes first: the opening quote (how these posts start), a subtitle, or a paragraph.
function summarize(contentHtml) {
    const first = contentHtml.match(/<(blockquote|h4|p)[^>]*>([\s\S]*?)<\/\1>/);
    let text = first ? stripTags(first[2]) : '';
    if (text.length > 220) text = text.slice(0, 217).replace(/\s+\S*$/, '') + '…';
    return text;
}

const ACRONYMS = new Set(['ai', 'api', 'aws', 'css', 'html', 'http', 'jwt', 'llm', 'ml', 'sql', 'tcp', 'ui', 'ux', 'webrtc']);
const titleCase = (slug) =>
    slug.split('-').map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

function parseFeed(xml) {
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
        const categories = [...item.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((m) => decode(m[1]).trim());
        return {
            url: tag(item, 'link').split('?')[0],
            title: tag(item, 'title'),
            date: new Date(tag(item, 'pubDate')).toISOString().slice(0, 10),
            topic: categories[0] ? titleCase(categories[0]) : '',
            summary: summarize(tag(item, 'content:encoded')),
            source: 'Medium',
        };
    });
}

const monthYear = (iso) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function renderTiles(articles) {
    return articles.slice(0, MAX_ON_HOMEPAGE).map((a) => {
        const kind = [a.source, monthYear(a.date), a.topic].filter(Boolean).join(' · ');
        return [
            `                    <a class="tile article" href="${escapeHtml(a.url)}" target="_blank" rel="noopener">`,
            `                        <p class="tile-kind">${escapeText(kind)}</p>`,
            `                        <h4>${escapeText(a.title)}</h4>`,
            `                        <p>${escapeText(a.summary)}</p>`,
            `                        <span class="read">Read →</span>`,
            `                    </a>`,
        ].join('\n');
    }).join('\n');
}

function renderLatest(a) {
    return `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeText(a.shortTitle || a.title)}</a>`;
}

function replaceBetween(html, name, content, inline = false) {
    const start = `<!-- ${name}:start -->`;
    const end = `<!-- ${name}:end -->`;
    const i = html.indexOf(start);
    const j = html.indexOf(end);
    if (i === -1 || j === -1 || j < i) throw new Error(`Markers for "${name}" not found in index.html`);
    const body = inline ? content : `\n${content}\n                    `;
    return html.slice(0, i + start.length) + body + html.slice(j);
}

async function main() {
    const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'sjbuilds-site-sync (+https://sjbuilds.dev)' } });
    if (!res.ok) throw new Error(`Feed request failed: ${res.status} ${res.statusText}`);
    const feed = parseFeed(await res.text());
    if (feed.length === 0) throw new Error('Feed returned no items; refusing to touch the site.');

    const stored = JSON.parse(await readFile(ARTICLES_PATH, 'utf8'));
    const known = new Set(stored.map((a) => a.url));
    const added = feed.filter((a) => a.url && !known.has(a.url));

    const articles = [...stored, ...added].sort((a, b) => b.date.localeCompare(a.date));

    let html = await readFile(INDEX_PATH, 'utf8');
    html = replaceBetween(html, 'medium:articles', renderTiles(articles));
    html = replaceBetween(html, 'medium:latest', renderLatest(articles[0]), true);

    await writeFile(ARTICLES_PATH, JSON.stringify(articles, null, 2) + '\n');
    await writeFile(INDEX_PATH, html);

    console.log(added.length ? `Added ${added.length}: ${added.map((a) => a.title).join(' | ')}` : 'No new articles.');
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
