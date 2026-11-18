/* Tilt meter UI: camera tilt from the phone held flat against the back of the camera. */
(function () {
  'use strict';
  var TM = window.TiltMath;
  var TOLERANCE = 1;          // degrees counted as "on target"
  var TAU = 0.25;             // smoothing time constant in seconds
  var MAX_OFFSET = 5;         // a larger calibration offset is almost certainly a mistake
  var STALE_S = 1.5;          // no sensor event for this long -> grey out the reading
  var $ = function (id) { return document.getElementById(id); };

  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('tiltmeter.' + k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem('tiltmeter.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  var target = store.get('target', 15);
  var offset = store.get('offset', 0);
  var up = null, lastT = 0, gotData = false, started = false;
  var held = null;            // raw {pitch, roll} frozen by Hold; calibration uses it while set
  var recent = [];            // [time, pitch] of the last second, for the "steady" indicator

  function round1(v) { var r = Math.round(v * 10) / 10; return r === 0 ? 0 : r; }
  function fmt(v) { return round1(v).toFixed(1) + '°'; }
  function signed(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '°'; }
  function status(text) { $('status').textContent = text; $('status').hidden = !text; }
  function now() { return performance.now() / 1000; }

  function onOrientation(e) {
    if (e.beta === null || e.gamma === null || e.beta === undefined) return;
    var t = now();
    var u = TM.upFromOrientation(e.beta, e.gamma);
    up = up ? TM.smooth(up, u, Math.min(0.5, t - lastT), TAU) : u;
    lastT = t;
    if (!gotData) { gotData = true; status(''); }
    var r = TM.pitchRoll(up);
    recent.push([t, r.pitch]);
    while (recent.length && t - recent[0][0] > 1) recent.shift();
    if (!held) render(r);
  }

  function render(raw) {
    var shown = round1(raw.pitch + offset);
    $('pitch').textContent = fmt(shown);
    var a = TM.advice(shown, target, TOLERANCE);
    $('advice').className = 'advice ' + a.level;
    $('advice').textContent = (a.level === 'ok' ? '✓ ' : a.diff > 0 ? '▲ ' : '▼ ') + a.text;
    $('roll').textContent = raw.roll === null ? 'roll –'
      : Math.abs(raw.roll) < 0.5 ? 'roll: level'
      : 'roll: ' + (raw.roll > 0 ? 'right' : 'left') + ' side low ' + Math.abs(raw.roll).toFixed(1) + '°';
    var ps = recent.map(function (x) { return x[1]; });
    var steady = ps.length > 5 && Math.max.apply(null, ps) - Math.min.apply(null, ps) < 0.3;
    $('steady').textContent = held ? '' : steady ? 'steady' : 'moving';
    $('steady').className = 'steady' + (steady ? ' yes' : '');
  }

  function rerender() { if (held) render(held); else if (up) render(TM.pitchRoll(up)); }

  function showSettings() {
    $('target').textContent = fmt(target);
    $('targetShown').textContent = fmt(target);
    $('offset').textContent = signed(offset);
    $('calBadge').textContent = 'cal ' + signed(offset);
    $('calBadge').hidden = Math.abs(offset) < 0.05;
  }

  function setHeld(on) {
    held = on && up ? TM.pitchRoll(up) : null;
    $('hold').textContent = held ? 'Release' : 'Hold';
    $('heldBadge').hidden = !held;
    $('pitch').classList.toggle('held', !!held);
    rerender();
  }

  // grey out the reading when the sensor stops sending
  setInterval(function () {
    var stale = started && gotData && !held && now() - lastT > STALE_S;
    $('pitch').classList.toggle('stale', stale);
    if (stale) status('No new sensor readings. Keep the page open in the foreground.');
    else if (gotData && $('status').textContent.indexOf('No new sensor') === 0) status('');
  }, 500);

  function keepAwake() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').catch(function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (started && document.visibilityState === 'visible') keepAwake();
  });

  function begin() {
    if (!started) window.addEventListener('deviceorientation', onOrientation);
    started = true;
    $('start').hidden = true;
    keepAwake();
    setTimeout(function () {
      if (!gotData) {
        status('No sensor data. Open the page directly in Safari or Chrome (not inside another app), allow motion access, then tap Start again.');
        $('start').hidden = false;
      }
    }, 2500);
  }

  function start() {
    if (!window.isSecureContext) { status('This page has to be opened over https:// to read the motion sensor.'); return; }
    if (typeof DeviceOrientationEvent === 'undefined') { status('This browser has no motion sensor access.'); return; }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {      // iPhone / iPad: needs a tap
      DeviceOrientationEvent.requestPermission().then(function (res) {
        if (res === 'granted') begin();
        else status('Motion access was refused. Quit Safari (or the home-screen app) completely, open the page again and tap “Allow”.');
      }).catch(function (err) { status('Could not get motion access: ' + err.message); });
    } else {
      begin();
    }
  }

  $('start').addEventListener('click', start);
  $('hold').addEventListener('click', function () { setHeld(!held); });
  $('targetDown').addEventListener('click', function () { target -= 1; store.set('target', target); showSettings(); rerender(); });
  $('targetUp').addEventListener('click', function () { target += 1; store.set('target', target); showSettings(); rerender(); });
  $('calForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var truth = parseFloat(String($('calTrue').value).replace(',', '.'));
    if (!isFinite(truth)) { $('calMsg').textContent = 'Enter the tilt from the test shot, e.g. 13.6'; return; }
    var ref = held || (up ? TM.pitchRoll(up) : null);
    if (!ref) { $('calMsg').textContent = 'Start the sensor and hold the phone against the camera first.'; return; }
    var next = truth - ref.pitch;
    if (Math.abs(next) > MAX_OFFSET) {
      $('calMsg').textContent = 'That would be an offset of ' + signed(next) + ', which is too large. Check the value, and tap Hold while the phone sits on the camera at the test shot.';
      return;
    }
    offset = next;
    store.set('offset', offset);
    $('calMsg').textContent = 'Offset set to ' + signed(offset) + (held ? ' (from the held reading).' : '.');
    showSettings(); rerender();
  });
  $('calReset').addEventListener('click', function () {
    offset = 0; store.set('offset', 0); $('calMsg').textContent = 'Offset cleared.'; showSettings(); rerender();
  });

  showSettings();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
    navigator.serviceWorker.ready.then(function () { $('offline').hidden = false; });
  }

  // #demo: synthetic readings, for checking the layout on a computer
  if (location.hash === '#demo') {
    started = true; $('start').hidden = true; $('demoBadge').hidden = false;
    var t0 = now();
    var tick = function () {
      var t = now() - t0;
      onOrientation({ beta: 76.5 + 1.5 * Math.sin(t / 2), gamma: 4 * Math.sin(t / 3) });
    };
    tick(); setInterval(tick, 50);
  }
})();
