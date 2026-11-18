# Tilt meter

A small offline web app that shows the camera's tilt on your phone.
- No ads, no tracking, no account; nothing leaves the phone.
- About 300 lines in total.
- It uses the same convention as the GoPro gravity vector: pitch > 0 means the lens points below the horizon.

**Use**
1. Hold the phone flat against the back of the GoPro, screen facing you.
2. Read the tilt and follow the arrow (▲ tilt the lens up / ▼ tilt the lens down) until it shows "on target".
   - The target defaults to 15° and can be changed under Settings.
   - Roll is shown too ("level" / "left/right side low").
   - "Hold" freezes the reading.

**Calibrate once** to remove any offset between the phone and the GoPro's own sensor:
1. Put the phone on the camera, take a test photo and tap **Hold** at that moment.
2. Later, read the photo's true tilt from its GoPro gravity vector with exiftool:
   `exiftool -b -GravityVector GP010001.JPG | awk '{print atan2($3, sqrt($1*$1+$2*$2))*57.2958}'`
3. Enter that value under Settings › "Tilt from a test shot" and tap Set.

Set uses the held reading, so the phone no longer has to sit on the camera. An offset above 5° is refused as a likely mistake. An active offset is shown on the main screen ("cal +0.8°"). Expect about ±0.5–1° after calibration.

## Put it on the phone

Phones only give motion-sensor data to pages served over **https**. That means the app can't be opened as a local file, and it can't run as a Claude artifact either, because the artifact viewer blocks motion sensors. Host the folder once on any free static host. These files are needed:

```
index.html  app.js  tiltmath.js  sw.js  manifest.webmanifest  icon-192.png  icon-512.png
```

**GitHub Pages (free, permanent)**
1. On github.com, create a new public repository, e.g. `tiltmeter`. The app contains no personal data.
2. Use *Add file › Upload files* to upload the seven files.
3. Under *Settings › Pages*, choose *Deploy from a branch* with `main` and `/ (root)`.
4. About a minute later it is live at `https://<user>.github.io/tiltmeter/`.

**Netlify Drop (fastest)**
1. Open app.netlify.com/drop and drag the `tiltmeter` folder onto it.
2. You get an https link at once. Sign up (free) so it doesn't expire.

**On the phone**
1. Open the link in Safari (iPhone) or Chrome (Android).
2. Tap **Start**. An iPhone asks for motion access: tap Allow.
3. Add it to the home screen: Safari *Share › Add to Home Screen*, or Chrome *⋮ › Add to Home screen / Install app*.

After the first visit it works offline, in the forest too. The line under the reading shows "ready for offline use" once everything is cached.

**iPhone:** the home-screen app keeps its own copy and its own settings, separate from the Safari tab. So:
1. Open the home-screen icon once while you have internet.
2. Calibrate inside it.
3. Before you leave, test it in airplane mode.

**30-second check on a new phone**
- Upright against a wall: about 0°.
- Flat on a table, screen up: about 90°.
- Top edge leaning towards you: negative.
- The same in landscape, with no jumps.

## Development
- `#demo` at the end of the URL feeds synthetic readings, for checking the layout on a computer.
- Maths tests, run from this folder: `node --test tests/tiltmath.test.js`
- After changing any file, bump `CACHE` in `sw.js` so installed copies update.
