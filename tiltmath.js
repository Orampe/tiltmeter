/*
 * Tilt meter maths (no DOM). Browser: window.TiltMath. Node: require('./tiltmath.js').
 *
 * Device axes (W3C DeviceOrientation): x to the right of the screen, y up the screen,
 * z out of the screen towards the viewer. The browser reports beta (about x) and gamma
 * (about y) of the rotation R = Rz(alpha) * Rx(beta) * Ry(gamma) from device to earth frame.
 *
 * Use: the phone lies flat against the BACK of the camera, screen facing you, so the
 * phone's back points where the lens points.
 *   pitch > 0  lens points below the horizon (same convention as the GoPro gravity vector
 *              pitch = asin(z))
 *   roll  > 0  the right-hand side (as you look at the screen) is lower
 */
(function (root) {
  'use strict';
  var RAD = Math.PI / 180;

  // Earth "up" in device coordinates = third row of R. alpha (compass) drops out.
  function upFromOrientation(beta, gamma) {
    var b = beta * RAD, g = gamma * RAD;
    return [-Math.sin(g) * Math.cos(b), Math.sin(b), Math.cos(b) * Math.cos(g)];
  }

  function normalize(v) {
    var n = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
  }

  // Lens direction = -z, so sin(pitch) = (-z) . down = z . up = u_z.
  // Roll: angle of "up" within the screen plane, measured from the nearest edge-up position,
  // so portrait and landscape both read 0 when level. Undefined when the phone lies ~flat.
  function pitchRoll(up) {
    var u = normalize(up);
    var pitch = Math.asin(Math.max(-1, Math.min(1, u[2]))) / RAD;
    var roll = null;
    if (Math.hypot(u[0], u[1]) > 0.1) {
      var r = Math.atan2(-u[0], u[1]) / RAD;
      roll = (((r + 45) % 90) + 90) % 90 - 45;
    }
    return { pitch: pitch, roll: roll };
  }

  // Exponential smoothing of unit vectors with time constant tau (s); no angle wrap-around issues.
  function smooth(prev, next, dt, tau) {
    var a = 1 - Math.exp(-Math.max(0, dt) / tau);
    return normalize([prev[0] + a * (next[0] - prev[0]),
                      prev[1] + a * (next[1] - prev[1]),
                      prev[2] + a * (next[2] - prev[2])]);
  }

  // Advice for reaching the target pitch; tolerance in degrees.
  function advice(pitch, target, tolerance) {
    var d = pitch - target;
    if (Math.abs(d) < tolerance) return { level: 'ok', text: 'on target', diff: d };
    return { level: Math.abs(d) < 3 * tolerance ? 'near' : 'off',
             text: (d > 0 ? 'tilt the lens up ' : 'tilt the lens down ') + Math.abs(d).toFixed(1) + '°',
             diff: d };
  }

  var api = { upFromOrientation: upFromOrientation, pitchRoll: pitchRoll, smooth: smooth, advice: advice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TiltMath = api;
})(typeof window !== 'undefined' ? window : this);
