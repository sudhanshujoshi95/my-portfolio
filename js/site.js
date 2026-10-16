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

    // ---- Scene picker: time of day x season, each "auto" or chosen ----
    var sceneBtn = document.getElementById('scene-btn');
    var scenePanel = document.getElementById('scene-panel');
    var sceneLabel = document.getElementById('scene-label');
    var chips = scenePanel.querySelectorAll('.chip');

    function iconFor(kind, value) {
        var chip = scenePanel.querySelector('.chip[data-kind="' + kind + '"][data-value="' + value + '"]');
        return chip ? chip.querySelector('svg').outerHTML : '';
    }

    function applyScene() {
        var s = window.sjApply();
        document.getElementById('scene-time-icon').innerHTML = iconFor('time', s.time);
        chips.forEach(function (c) {
            c.setAttribute('aria-pressed', String(s.pick[c.getAttribute('data-kind')] === c.getAttribute('data-value')));
        });
        var label = s.season + ' ' + s.time;
        var custom = s.pick.time !== 'auto';
        sceneLabel.textContent = label + (custom ? ' · picked' : '');
        sceneBtn.setAttribute('aria-label', 'Scene: ' + label + (custom ? ' (picked)' : ' (automatic)') + '. Change scene');
        sceneBtn.title = 'Scene: ' + label;
        sky.refresh();
    }

    function setPanel(open) {
        scenePanel.hidden = !open;
        sceneBtn.setAttribute('aria-expanded', String(open));
        if (open) (scenePanel.querySelector('.chip[aria-pressed="true"]') || chips[0]).focus();
    }

    sceneBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        setPanel(scenePanel.hidden);
    });
    scenePanel.addEventListener('click', function (e) {
        e.stopPropagation();
        var chip = e.target.closest('.chip');
        if (!chip) return;
        var kind = chip.getAttribute('data-kind'), value = chip.getAttribute('data-value');
        try {
            if (value === 'auto') localStorage.removeItem('scene-' + kind);
            else localStorage.setItem('scene-' + kind, value);
        } catch (err) {}
        if (location.search.indexOf('scene=') !== -1) history.replaceState(null, '', location.pathname + location.hash);
        applyScene();
    });
    document.addEventListener('click', function () { if (!scenePanel.hidden) setPanel(false); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !scenePanel.hidden) { setPanel(false); sceneBtn.focus(); }
    });

    // ---- Ambient sky: snow in winter, rain in the monsoon, stars on summer nights ----
    var sky = (function () {
        var canvas = document.getElementById('sky');
        var ctx = canvas && canvas.getContext && canvas.getContext('2d');
        var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        var effect = null, particles = [], colour = '', raf = 0, w = 0, h = 0, dpr = 1;

        function pick() {
            var s = root.getAttribute('data-season');
            if (s === 'winter') return 'snow';
            if (s === 'monsoon') return 'rain';
            if (s === 'summer' && root.getAttribute('data-time') === 'night') return 'stars';
            return null;
        }

        function colourFor(kind) {
            var dark = root.getAttribute('data-theme') === 'dark';
            if (kind === 'snow') return dark ? 'rgba(255,255,255,0.55)' : 'rgba(112,136,170,0.45)';
            if (kind === 'rain') return dark ? 'rgba(186,206,226,0.22)' : 'rgba(84,106,128,0.22)';
            return 'rgba(255,244,220,1)';
        }

        function seed() {
            var area = w * h, n, i;
            particles = [];
            if (effect === 'snow') {
                n = Math.min(70, Math.round(area / 22000));
                for (i = 0; i < n; i++) particles.push({ x: Math.random() * w, y: Math.random() * h, r: 0.8 + Math.random() * 1.6, v: 0.25 + Math.random() * 0.45, p: Math.random() * 6.28 });
            } else if (effect === 'rain') {
                n = Math.min(90, Math.round(area / 15000));
                for (i = 0; i < n; i++) particles.push({ x: Math.random() * w, y: Math.random() * h, l: 10 + Math.random() * 10, v: 6 + Math.random() * 4 });
            } else if (effect === 'stars') {
                n = Math.min(60, Math.round(area / 26000));
                for (i = 0; i < n; i++) particles.push({ x: Math.random() * w, y: Math.random() * h * 0.7, r: 0.5 + Math.random() * 1.1, p: Math.random() * 6.28 });
            }
        }

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = window.innerWidth; h = window.innerHeight;
            canvas.width = w * dpr; canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
        }

        function frame(t) {
            ctx.clearRect(0, 0, w, h);
            var i, q;
            if (effect === 'snow') {
                ctx.fillStyle = colour;
                for (i = 0; i < particles.length; i++) {
                    q = particles[i];
                    q.y += q.v;
                    q.x += Math.sin(t / 1800 + q.p) * 0.3;
                    if (q.y > h + 4) { q.y = -4; q.x = Math.random() * w; }
                    ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
                }
            } else if (effect === 'rain') {
                ctx.strokeStyle = colour; ctx.lineWidth = 1; ctx.beginPath();
                for (i = 0; i < particles.length; i++) {
                    q = particles[i];
                    q.y += q.v; q.x -= q.v * 0.18;
                    if (q.y > h + 20) { q.y = -20; q.x = Math.random() * (w + 60); }
                    ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + q.l * 0.18, q.y - q.l);
                }
                ctx.stroke();
            } else if (effect === 'stars') {
                for (i = 0; i < particles.length; i++) {
                    q = particles[i];
                    ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t / 1400 + q.p));
                    ctx.fillStyle = colour;
                    ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
            raf = requestAnimationFrame(frame);
        }

        function stop() { cancelAnimationFrame(raf); raf = 0; }
        function start() { if (!raf && effect && !document.hidden) raf = requestAnimationFrame(frame); }

        function refresh() {
            if (!ctx || still) return;
            var next = pick();
            colour = colourFor(next);
            if (next !== effect) { effect = next; seed(); }
            if (!effect) { stop(); ctx.clearRect(0, 0, w, h); } else start();
        }

        var ready = false;
        if (ctx && !still) {
            resize();
            window.addEventListener('resize', resize);
            document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
            // Let the page fade in first, then bring the weather in gently.
            setTimeout(function () { ready = true; canvas.classList.add('on'); refresh(); }, 1500);
        }
        return { refresh: function () { if (ready) refresh(); } };
    })();

    applyScene();
    // Morning turns to day, day to evening: re-check every few minutes.
    setInterval(applyScene, 5 * 60 * 1000);

    // Greeting, by the visitor's own clock.
    var hour = new Date().getHours();
    document.getElementById('greet-text').textContent =
        hour >= 5 && hour < 12 ? "Good morning, hope you're doing well." :
        hour >= 12 && hour < 17 ? "Good afternoon, hope you're doing well." :
        hour >= 17 && hour < 21 ? "Good evening, hope you're doing well." :
        "Hey there, night owl. Hope you're doing well.";

    var greet = document.querySelector('.greet');
    var wave = greet.querySelector('.wave');
    function doWave() {
        wave.classList.remove('waving');
        void wave.offsetWidth; // restart the animation
        wave.classList.add('waving');
    }
    wave.addEventListener('animationend', function () { wave.classList.remove('waving'); });
    greet.addEventListener('mouseenter', doWave);
    greet.addEventListener('click', doWave);
    setTimeout(doWave, 1100);

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
