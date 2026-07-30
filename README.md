# ⛅ Weather Dashboard

A responsive, production-ready weather dashboard. No build tools, no API key required.

## Features
- Current conditions — temp, feels like, humidity, wind, pressure, visibility
- 48-hour temperature trend chart
- 5-day forecast
- Live rain radar & satellite map with time scrubber (RainViewer)
- Location detection + city search
- Fully responsive — works on mobile, tablet, desktop

## Data Sources
| Data | Provider | Key required |
|------|----------|-------------|
| Weather & forecast | [Open-Meteo](https://open-meteo.com) | ❌ Free, no key |
| Geocoding | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | ❌ Free, no key |
| Reverse geocoding | [Nominatim / OSM](https://nominatim.org) | ❌ Free, no key |
| Rain radar & satellite | [RainViewer](https://rainviewer.com) | ❌ Free, no key |
| Map tiles | [CartoDB Dark Matter](https://carto.com/basemaps/) | ❌ Free, no key |

## Run Locally
Just open `index.html` in a browser, or double-click `start.bat` on Windows.

## Deploy

### Netlify (recommended — 30 seconds)
1. Go to [netlify.com](https://netlify.com) → Log in
2. Drag and drop this folder onto the Netlify dashboard
3. Done — live URL instantly

### GitHub Pages
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/weather.git
git push -u origin main
```
Then in GitHub repo → Settings → Pages → Source: `main` / `root`

### Any static host
Upload `index.html`, `style.css`, `app.js` — that's it.
