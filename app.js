// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BASE          = 'https://api.open-meteo.com/v1/forecast';
const GEO           = 'https://geocoding-api.open-meteo.com/v1/search';
const HOURLY_PARAMS = 'temperature_2m,apparent_temperature,weathercode,windspeed_10m,relativehumidity_2m,surface_pressure,visibility,precipitation_probability';
const DAILY_PARAMS  = 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max';

// ─── WMO CODE MAPS ────────────────────────────────────────────────────────────
const WMO_DESC = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Fog',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',
  80:'Rain showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm',99:'Thunderstorm w/ hail'
};
const WMO_ICON = {
  0:'01d',1:'01d',2:'02d',3:'04d',45:'50d',48:'50d',
  51:'09d',53:'09d',55:'09d',61:'10d',63:'10d',65:'10d',
  71:'13d',73:'13d',75:'13d',80:'09d',81:'09d',82:'09d',95:'11d',99:'11d'
};
const wmIcon = (code, large = false) =>
  `https://openweathermap.org/img/wn/${WMO_ICON[code] ?? '01d'}${large ? '@2x' : ''}.png`;

// ─── DOM ──────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const cityInput = $('cityInput');
const dashboard = $('dashboard');
const errorEl   = $('error');
const loaderEl  = $('loader');
let   tempChart = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
$('searchBtn').addEventListener('click', () => searchByCity(cityInput.value.trim()));
$('locBtn').addEventListener('click', getLocation);
cityInput.addEventListener('keydown', e => e.key === 'Enter' && searchByCity(cityInput.value.trim()));

// Store city name and coords separately — search uses name, map uses coords
const saved = JSON.parse(localStorage.getItem('weather_saved') || 'null');
if (saved) fetchWeather(saved.lat, saved.lon, saved.label);
else getLocation();

// ─── LOCATION ─────────────────────────────────────────────────────────────────
function getLocation() {
  if (!navigator.geolocation) return searchByCity('London');
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeather(pos.coords.latitude, pos.coords.longitude, null),
    ()   => searchByCity('London')
  );
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
async function searchByCity(city) {
  if (!city) return;
  try {
    showLoader();
    const res  = await fetch(`${GEO}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const data = await res.json();
    if (!data.results?.length) throw new Error(`"${city}" not found. Check spelling and try again.`);
    const { latitude, longitude, name, country } = data.results[0];
    await fetchWeather(latitude, longitude, `${name}, ${country}`);
  } catch (e) { showError(e.message); }
}

// ─── FETCH ────────────────────────────────────────────────────────────────────
async function fetchWeather(lat, lon, label) {
  try {
    showLoader();
    const url  = `${BASE}?latitude=${lat}&longitude=${lon}` +
      `&hourly=${HOURLY_PARAMS}&daily=${DAILY_PARAMS}` +
      `&current_weather=true&timezone=auto&forecast_days=6`;
    const data = await fetch(url).then(r => r.json());
    if (data.error) throw new Error(data.reason);

    if (!label) {
      try {
        const rg = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        ).then(r => r.json());
        label = rg.address?.city || rg.address?.town || rg.address?.village || rg.address?.county || 'Your Location';
        if (rg.address?.country) label += `, ${rg.address.country}`;
      } catch { label = 'Your Location'; }
    }

    // Save coords + label so we reload correctly without re-geocoding
    localStorage.setItem('weather_saved', JSON.stringify({ lat, lon, label }));
    render(data, label, lat, lon);
  } catch (e) { showError(e.message); }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render(data, label, lat, lon) {
  hideError();
  const cw = data.current_weather;
  const h  = data.hourly;
  const d  = data.daily;
  const ci = Math.max(0, h.time.findIndex(t => t === cw.time));

  $('cityName').textContent    = label;
  $('dateTime').textContent    = formatDate(new Date());
  $('temp').textContent        = `${Math.round(cw.temperature)}°C`;
  $('description').textContent = WMO_DESC[cw.weathercode] ?? 'Unknown';
  $('weatherIcon').src         = wmIcon(cw.weathercode, true);
  $('weatherIcon').alt         = WMO_DESC[cw.weathercode] ?? '';
  $('feelsLike').textContent   = `${Math.round(h.apparent_temperature[ci])}°C`;
  $('humidity').textContent    = `${h.relativehumidity_2m[ci]}%`;
  $('wind').textContent        = `${Math.round(cw.windspeed)} km/h`;
  $('pressure').textContent    = `${Math.round(h.surface_pressure[ci])} hPa`;
  $('visibility').textContent  = h.visibility ? `${(h.visibility[ci] / 1000).toFixed(1)} km` : 'N/A';
  $('uv').textContent          = 'N/A';

  // Hourly — next 8 slots
  $('hourlyCards').innerHTML = Array.from({ length: 8 }, (_, i) => ci + i)
    .filter(i => i < h.time.length)
    .map(i => `
      <div class="hourly-card">
        <div class="h-time">${h.time[i].slice(11, 16)}</div>
        <img src="${wmIcon(h.weathercode[i])}" alt="" loading="lazy" />
        <div class="h-temp">${Math.round(h.temperature_2m[i])}°C</div>
        <div class="h-pop">${h.precipitation_probability[i] ? h.precipitation_probability[i] + '% 💧' : ''}</div>
      </div>`).join('');

  // 5-day forecast
  $('forecastCards').innerHTML = Array.from({ length: 5 }, (_, i) => i + 1)
    .filter(i => i < d.time.length)
    .map(i => `
      <div class="forecast-card">
        <div class="day">${formatDay(d.time[i])}</div>
        <img src="${wmIcon(d.weathercode[i])}" alt="" loading="lazy" />
        <div class="fc-temp">${Math.round((d.temperature_2m_max[i] + d.temperature_2m_min[i]) / 2)}°C</div>
        <div class="fc-range">${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°</div>
        <div class="fc-desc">${WMO_DESC[d.weathercode[i]] ?? ''}</div>
      </div>`).join('');

  // Chart
  const slots = Array.from({ length: 16 }, (_, i) => ci + i).filter(i => i < h.time.length);
  renderChart(
    slots.map(i => h.time[i].slice(11, 16)),
    slots.map(i => Math.round(h.temperature_2m[i])),
    slots.map(i => Math.round(h.apparent_temperature[i]))
  );

  dashboard.classList.remove('hidden');
  loaderEl.classList.add('hidden');

  initMap(lat, lon);
}

// ─── CHART ────────────────────────────────────────────────────────────────────
function renderChart(labels, temps, feels) {
  if (tempChart) tempChart.destroy();
  tempChart = new Chart($('tempChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Temperature (°C)', data: temps, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.12)', fill: true, tension: 0.4, pointRadius: 3 },
        { label: 'Feels Like (°C)',  data: feels, borderColor: '#818cf8', backgroundColor: 'transparent', borderDash: [5, 4], tension: 0.4, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#64748b', callback: v => v + '°', font: { size: 10 } }, grid: { color: '#1e293b' } },
      },
    },
  });
}

// ─── MAP ──────────────────────────────────────────────────────────────────────
let weatherMap      = null;
let activeLayer     = null;
let currentMapLayer = 'rain';
let mapFrameIndex   = 0;
let rvRadarFrames   = [];
let rvSatFrames     = [];
const LAYER_OPACITY = 0.85;

async function initMap(lat, lon) {
  if (!weatherMap) {
    weatherMap = L.map('weatherMap', { zoomControl: true, attributionControl: true }).setView([lat, lon], 5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://carto.com">CARTO</a> © <a href="https://openstreetmap.org">OSM</a>',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(weatherMap);

    // Fetch RainViewer manifest
    try {
      const rv      = await fetch('https://api.rainviewer.com/public/weather-maps.json').then(r => r.json());
      rvRadarFrames = [...(rv.radar.past || []), ...(rv.radar.nowcast || [])];
      rvSatFrames   = rv.satellite?.infrared || [];
    } catch { /* silent — map still shows base tiles */ }

    buildTimeBar(rvRadarFrames);

    // Layer toggle
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMapLayer = btn.dataset.layer;
        const frames = currentMapLayer === 'satellite' ? rvSatFrames : rvRadarFrames;
        mapFrameIndex = Math.max(frames.length - 1, 0);
        buildTimeBar(frames);
        applyMapLayer();
      });
    });

  } else {
    weatherMap.setView([lat, lon], 5);
  }

  applyMapLayer();
}

function buildTimeBar(frames) {
  $('mapTimeBar').innerHTML = frames.map((f, i) => {
    const label = new Date(f.time * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const active = i === frames.length - 1;
    return `<button class="time-btn${active ? ' active' : ''}" data-idx="${i}">${label}</button>`;
  }).join('') || '<span style="color:var(--text-muted);font-size:0.8rem;padding:4px 0">No radar data available</span>';

  // Scroll to end (latest frame)
  const bar = $('mapTimeBar');
  requestAnimationFrame(() => { bar.scrollLeft = bar.scrollWidth; });

  // Bind clicks
  bar.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mapFrameIndex = +btn.dataset.idx;
      applyMapLayer();
    });
  });
}

function applyMapLayer() {
  if (activeLayer) { weatherMap.removeLayer(activeLayer); activeLayer = null; }
  const frames = currentMapLayer === 'satellite' ? rvSatFrames : rvRadarFrames;
  if (!frames.length) return;

  const frame = frames[Math.min(mapFrameIndex, frames.length - 1)];
  const url   = currentMapLayer === 'satellite'
    ? `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/0/0_0.png`
    : `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/4/1_1.png`;

  activeLayer = L.tileLayer(url, {
    opacity: currentMapLayer === 'satellite' ? 0.65 : LAYER_OPACITY,
    attribution: '© <a href="https://rainviewer.com">RainViewer</a>',
  }).addTo(weatherMap);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDay(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function showLoader() {
  loaderEl.classList.remove('hidden');
  dashboard.classList.add('hidden');
  hideError();
}

function showError(msg) {
  errorEl.textContent = `⚠️ ${msg}`;
  errorEl.classList.remove('hidden');
  loaderEl.classList.add('hidden');
}

function hideError() { errorEl.classList.add('hidden'); }
