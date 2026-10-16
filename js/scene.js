// Loaded in <head>, before any CSS paints, so the right scene shows from the first frame.
// Scene = time of day x season. Season always follows the Indian calendar; time of day is "auto" (visitor's clock) or picked.
// Runs before paint so the right colours show from the first frame.
window.sjScene = function () {
    var now = new Date(), h = now.getHours();
    var m = Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: 'Asia/Kolkata' }).format(now));
    var auto = {
        time: h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night',
        season: m >= 3 && m <= 6 ? 'summer' : m >= 7 && m <= 9 ? 'monsoon' : 'winter'
    };
    var pick = { time: 'auto', season: 'auto' };
    try {
        pick.time = localStorage.getItem('scene-time') || 'auto';
    } catch (e) {}
    // Preview any scene with ?scene=monsoon-evening
    var q = location.search.match(/[?&]scene=(winter|summer|monsoon)-(morning|day|evening|night)\b/);
    if (q) { pick.season = q[1]; pick.time = q[2]; }
    if (!/^(morning|day|evening|night)$/.test(pick.time)) pick.time = 'auto';
    if (!/^(winter|summer|monsoon)$/.test(pick.season)) pick.season = 'auto';
    return {
        time: pick.time === 'auto' ? auto.time : pick.time,
        season: pick.season === 'auto' ? auto.season : pick.season,
        pick: pick
    };
};
window.sjApply = function () {
    var root = document.documentElement, s = window.sjScene();
    root.setAttribute('data-time', s.time);
    root.setAttribute('data-season', s.season);
    root.setAttribute('data-theme', s.time === 'evening' || s.time === 'night' ? 'dark' : 'light');
    return s;
};
window.sjApply();
document.documentElement.classList.add('js');
try { localStorage.removeItem('theme'); localStorage.removeItem('scene-season'); } catch (e) {} // retired settings
