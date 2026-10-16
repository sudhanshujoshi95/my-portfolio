// sjbuilds — small touches only.
(function () {
    var root = document.documentElement;

    // Stagger the one-time load-in, then reveal.
    document.querySelectorAll('.rise').forEach(function (el, i) {
        el.style.setProperty('--i', Math.min(i, 6));
    });
    requestAnimationFrame(function () {
        requestAnimationFrame(function () { root.classList.add('ready'); });
    });

    // Theme toggle, remembered per visitor.
    document.getElementById('theme').addEventListener('click', function () {
        var current = root.getAttribute('data-theme') ||
            (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        var next = current === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
    });

    // Local time in Indore.
    var clock = document.getElementById('clock');
    var fmt = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
    });
    function tick() { clock.textContent = fmt.format(new Date()) + ' IST'; }
    tick();
    setInterval(tick, 30000);

    document.getElementById('year').textContent = new Date().getFullYear();

    // LinkedIn teasers: a slow marquee built from data/linkedin.json.
    var feed = document.getElementById('li-feed');
    if (feed && window.fetch) {
        fetch('data/linkedin.json')
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (posts) {
                if (!Array.isArray(posts) || posts.length === 0) return;
                posts.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

                var track = document.getElementById('li-track');
                var marquee = document.getElementById('li-marquee');
                var month = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

                function card(post, decorative) {
                    var li = document.createElement('li');
                    var a = document.createElement('a');
                    a.className = 'li-card';
                    a.href = post.url;
                    a.target = '_blank';
                    a.rel = 'noopener';
                    if (decorative) {
                        li.setAttribute('aria-hidden', 'true');
                        a.tabIndex = -1;
                    }
                    if (post.image) {
                        var img = document.createElement('img');
                        img.className = 'li-img';
                        img.src = post.image;
                        img.alt = '';
                        img.loading = 'lazy';
                        img.decoding = 'async';
                        a.appendChild(img);
                        a.classList.add('has-img');
                    }
                    var meta = document.createElement('span');
                    meta.className = 'li-meta';
                    meta.textContent = 'LinkedIn · ' + month.format(new Date(post.date + 'T00:00:00Z'));
                    var text = document.createElement('span');
                    text.className = 'li-text';
                    text.textContent = post.text;
                    var more = document.createElement('span');
                    more.className = 'li-more';
                    more.textContent = 'Read post →';
                    a.append(meta, text, more);
                    li.appendChild(a);
                    return li;
                }

                posts.forEach(function (p) { track.appendChild(card(p, false)); });

                // Loop only when there's enough to fill a row and the visitor allows motion.
                var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (posts.length >= 3 && !still) {
                    posts.forEach(function (p) { track.appendChild(card(p, true)); });
                    marquee.style.setProperty('--marquee-duration', posts.length * 9 + 's');
                    marquee.classList.add('is-moving');
                }
                feed.hidden = false;
            })
            .catch(function () { /* no teasers is fine */ });
    }
})();
