// Adds LinkedIn posts to the site's "Recent on LinkedIn" marquee.
//
// Give it one or more post links (lnkd.in short links work too). For each
// public post it reads the preview data LinkedIn publishes for link sharing:
// the text (used as the teaser), the publish date and the post image. The
// image is saved into img/linkedin/ because LinkedIn's image URLs expire.
//
// Posts already in data/linkedin.json are skipped, so edits there survive.
//
// Usage: node scripts/add-linkedin.mjs <post link> [<post link> ...]
// Options: --no-image   add the post without downloading its image

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const POSTS_PATH = new URL('../data/linkedin.json', import.meta.url);
const IMG_DIR = new URL('../img/linkedin/', import.meta.url);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const TEASER_MAX = 240;

const decode = (s) =>
    s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const meta = (html, prop) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`));
    return m ? decode(m[1]) : '';
};

function jsonLd(html) {
    for (const [, block] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        try {
            const data = JSON.parse(block);
            if (data.datePublished) return data;
        } catch { /* not the block we want */ }
    }
    return {};
}

// First couple of sentences, links removed, cut on a word boundary.
function teaser(text) {
    let t = text.replace(/https?:\/\/\S+/g, '').replace(/\s*-\s*,/g, ',').replace(/\s+/g, ' ').trim();
    if (t.length <= TEASER_MAX) return t;
    const cut = t.slice(0, TEASER_MAX);
    const sentence = cut.lastIndexOf('. ');
    return sentence > 120 ? cut.slice(0, sentence + 1) : cut.replace(/\s+\S*$/, '') + '…';
}

// A real post image, a carousel's first page, or nothing. Video thumbnails and
// LinkedIn's generic placeholder are skipped.
function pickImage(html) {
    const og = meta(html, 'og:image');
    if (/^https:\/\/media\.licdn\.com\/dms\/image\//.test(og)) return og;
    const cover = html.match(/https:\/\/media\.licdn\.com\/dms\/image\/v2\/[^"&]*feedshare-document-cover-images_\d+\/[^/]+\/0\/\d+\?e=\d+&amp;v=beta&amp;t=[\w-]+/);
    return cover ? decode(cover[0]) : '';
}

async function addPost(link, { withImage }) {
    const res = await fetch(link, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} (is the post public?)`);
    const url = res.url.split('?')[0];
    if (!/^https:\/\/www\.linkedin\.com\/(posts|feed\/update)\//.test(url)) throw new Error(`not a LinkedIn post: ${url}`);

    const html = await res.text();
    const ld = jsonLd(html);
    if (!ld.datePublished) throw new Error('LinkedIn returned no post data (it may be blocking requests right now)');

    const body = ld.articleBody || meta(html, 'og:description') || ld.headline || '';
    const post = { url, date: ld.datePublished.slice(0, 10), text: teaser(body) };

    const imageUrl = withImage ? pickImage(html) : '';
    if (imageUrl) {
        const id = (url.match(/(\d{19})/) || [, String(Date.now())])[1];
        const img = await fetch(imageUrl, { headers: { 'User-Agent': UA } });
        if (img.ok && (img.headers.get('content-type') || '').startsWith('image/')) {
            await mkdir(IMG_DIR, { recursive: true });
            await writeFile(new URL(`${id}.jpg`, IMG_DIR), Buffer.from(await img.arrayBuffer()));
            post.image = `img/linkedin/${id}.jpg`;
        }
    }
    return post;
}

async function main() {
    const args = process.argv.slice(2);
    const withImage = !args.includes('--no-image');
    const links = args.filter((a) => !a.startsWith('--'));
    if (links.length === 0) {
        console.error('Usage: node scripts/add-linkedin.mjs <post link> [...] [--no-image]');
        process.exit(1);
    }

    const posts = JSON.parse(await readFile(POSTS_PATH, 'utf8'));
    let failed = 0;

    for (const link of links) {
        try {
            const post = await addPost(link, { withImage });
            if (posts.some((p) => p.url === post.url)) {
                console.log(`skip   ${post.url} (already added)`);
                continue;
            }
            posts.push(post);
            console.log(`added  ${post.date}  ${post.image ? '[image] ' : ''}${post.text.slice(0, 70)}…`);
        } catch (err) {
            failed++;
            console.error(`failed ${link}: ${err.message}`);
        }
    }

    posts.sort((a, b) => b.date.localeCompare(a.date));
    await writeFile(POSTS_PATH, JSON.stringify(posts, null, 2) + '\n');
    console.log('\nCheck any new images in img/linkedin/ before publishing (contact details, other people).');
    if (failed) process.exit(1);
}

main();
