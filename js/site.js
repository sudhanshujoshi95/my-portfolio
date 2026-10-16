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
})();
