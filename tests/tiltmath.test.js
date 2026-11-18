// Run from the tiltmeter folder: node --test tests/tiltmath.test.js
const test = require('node:test');
const assert = require('node:assert');
const TM = require('../tiltmath.js');

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const RAD = Math.PI / 180;

// earth-up in device coordinates for a phone tilted back by pitch p and turned in the screen plane
// by theta (counter-clockwise as you look at the screen; 0 = portrait, 90 = landscape with right edge up)
function upFor(p, theta) {
  const c = Math.cos(p * RAD), s = Math.sin(p * RAD);
  return [Math.sin(theta * RAD) * c, Math.cos(theta * RAD) * c, s];
}
// invert u = (-sin g cos b, sin b, cos b cos g) to the browser's beta/gamma (gamma in [-90, 90))
function angles(u) {
  let b = Math.asin(u[1]) / RAD, g = Math.atan2(-u[0], u[2]) / RAD;
  if (g >= 90) { g -= 180; b = 180 - b; } else if (g < -90) { g += 180; b = 180 - b; }
  if (b > 180) b -= 360;
  return [b, g];
}

test('upright portrait is level', () => {
  const r = TM.pitchRoll(TM.upFromOrientation(90, 0));
  near(r.pitch, 0); near(r.roll, 0);
});

test('tilted back 15 deg (screen faces up a bit) = lens 15 deg down', () => {
  near(TM.pitchRoll(TM.upFromOrientation(75, 0)).pitch, 15);
});

test('leaning towards you = lens up (negative pitch)', () => {
  near(TM.pitchRoll(TM.upFromOrientation(100, 0)).pitch, -10);
});

test('flat on the table = lens straight down, roll undefined', () => {
  const r = TM.pitchRoll(TM.upFromOrientation(0, 0));
  near(r.pitch, 90); assert.strictEqual(r.roll, null);
});

test('landscape (right edge up) tilted back 15 deg reads the same pitch, roll 0', () => {
  const r = TM.pitchRoll(TM.upFromOrientation(0, -75));
  near(r.pitch, 15); near(r.roll, 0);
});

test('round trip over many pitches and in-plane turns: pitch exact, roll = deviation from the nearest edge-up', () => {
  for (const p of [-20, -5, 0.5, 5, 12, 15, 20, 33, 60, 80]) {
    for (const theta of [0, 2, -2, 90, 88, 92, -90, 180, 178, 45.5, -44]) {
      const [b, g] = angles(upFor(p, theta));
      const r = TM.pitchRoll(TM.upFromOrientation(b, g));
      near(r.pitch, p, 1e-9);
      if (r.roll !== null) {
        // turning clockwise (negative theta) lowers the right-hand side -> positive roll
        const expected = -((((theta + 45) % 90) + 90) % 90 - 45);
        near(r.roll, expected, 1e-9);
      }
    }
  }
});

test('right-hand side low reads positive roll in portrait', () => {
  const [b, g] = angles(upFor(15, -2));   // turned 2 deg clockwise
  const r = TM.pitchRoll(TM.upFromOrientation(b, g));
  near(r.pitch, 15, 1e-9); near(r.roll, 2, 1e-9);
});

test('smoothing converges and keeps unit length', () => {
  let u = TM.upFromOrientation(90, 0);
  const target = TM.upFromOrientation(75, 0);
  for (let i = 0; i < 200; i++) u = TM.smooth(u, target, 0.05, 0.25);
  near(TM.pitchRoll(u).pitch, 15, 1e-6);
  near(Math.hypot(...u), 1);
});

test('advice direction matches the python tilt command', () => {
  assert.strictEqual(TM.advice(17, 15, 1).text, 'tilt the lens up 2.0°');
  assert.strictEqual(TM.advice(13.6, 15, 1).text, 'tilt the lens down 1.4°');
  assert.strictEqual(TM.advice(15.4, 15, 1).level, 'ok');
  assert.strictEqual(TM.advice(16.5, 15, 1).level, 'near');
  assert.strictEqual(TM.advice(19, 15, 1).level, 'off');
});
