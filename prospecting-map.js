// Prospecting Map - Leaflet integration

// Element references (initialized on DOMContentLoaded)
let resultsList;
let resultsCount;
let mineralFilter;
let searchInput;
let companyFilter;
let applyFilters;
let clearFilters;
let detailModal;
let detailContent;
let detailClose;
let zoomRange;
let zoomIn;
let zoomOut;
let reserveSizeFilter;
let prodMin;
let prodMax;
let officialOnly;
let sortBy;
let sgbToggle;
let sgbLayerGroup = null;
let sgbClusters = null;

// Theme helpers
let themeToggleBtn = null;
let themeIconEl = null;
function setTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeIconEl) themeIconEl.textContent = '☀️';
        localStorage.setItem('siteTheme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
        if (themeIconEl) themeIconEl.textContent = '🌙';
        localStorage.setItem('siteTheme', 'dark');
    }
}

function initThemeFromStorage() {
    const saved = localStorage.getItem('siteTheme');
    if (saved === 'light') setTheme('light'); else setTheme('dark');
}

let areas = [];
let filtered = [];
let page = 0;
const PAGE_SIZE = 6;

let map = null;
let markersLayerGroup = null;
let markersClusterGroup = null;
let userMarksLayer = null;
let measureMode = false;
let markMode = false;
let measurePoints = [];
let showSynthetic = true; // client-side toggle for presentation mocks

async function loadAreas() {
    try {
        // Prefer an enriched dataset if present; fall back to the simple mock
        let res = await fetch('areas_enriched.json').catch(() => null);
        if (!res || !res.ok) {
            res = await fetch('areas_mock.json');
        }
        areas = await res.json();
        console.log('✅ Áreas carregadas', areas.length);
        filtered = areas.slice();
        initMap();
        renderMarkers();
        renderResults(true);
        updateStats();
    } catch (err) {
        console.error('Erro ao carregar areas_mock.json', err);
    }
}

function initMap() {
    if (map) return;
    map = L.map('leafletMap', { zoomControl: false }).setView([-14.2, -51.9], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    // marker cluster group for performance with many markers
    try {
        markersClusterGroup = L.markerClusterGroup({ chunkedLoading: true, removeOutsideVisibleBounds: true });
        markersClusterGroup.addTo(map);
    } catch (e) {
        // fallback if plugin missing
        markersLayerGroup = L.layerGroup().addTo(map);
    }
    // attach sgb layer to the initialized map if present
    if (sgbLayerGroup) sgbLayerGroup.addTo(map);

    zoomRange.addEventListener('input', () => {
        const v = Number(zoomRange.value);
        const zoom = 3 + (v - 1) * 2; // map 1..5 to zoom levels
        map.setZoom(zoom);
    });
    zoomIn.addEventListener('click', () => { zoomRange.value = Math.min(Number(zoomRange.value) + 1, 5); zoomRange.dispatchEvent(new Event('input')); });
    zoomOut.addEventListener('click', () => { zoomRange.value = Math.max(Number(zoomRange.value) - 1, 1); zoomRange.dispatchEvent(new Event('input')); });
}

function colorFor(mineral) {
    const mapColors = {
        'Lítio': '#FFD54F',
        'Nióbio': '#5DADE2',
        'Cobre': '#FFA726',
        'Ferro': '#EF5350',
        'Terras Raras': '#7BE28A',
        'Grafita': '#6B6B6B',
        'Ouro': '#FFD700'
    };
    return mapColors[mineral] || '#888';
}

function renderMarkers() {
    // clear previous markers
    if (markersClusterGroup) {
        markersClusterGroup.clearLayers();
    }
    if (markersLayerGroup) {
        markersLayerGroup.clearLayers();
    }

    filtered.forEach(area => {
        if (!showSynthetic && area.synthetic) return; // respect synthetic toggle
        const lat = area.coordinates && area.coordinates[0];
        const lon = area.coordinates && area.coordinates[1];
        if (lat === undefined || lon === undefined) return;
        const color = colorFor(area.mineral);

        // Create a small colored div icon so MarkerCluster can cluster it efficiently
        const size = area.synthetic ? 10 : 12;
        const opacity = area.synthetic ? 0.65 : 1.0;
        const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(0,0,0,0.05);opacity:${opacity}"></div>`;
        const icon = L.divIcon({ html: html, className: 'area-dot-icon', iconSize: [size, size], iconAnchor: [size/2, size/2] });

        const marker = L.marker([lat, lon], { icon: icon, title: `${area.id} — ${area.mineral}` });
        marker.bindTooltip(`${area.id} — ${area.mineral}`, { direction: 'top' });
        marker.on('click', () => openDetail(area));

        if (markersClusterGroup) markersClusterGroup.addLayer(marker);
        else if (markersLayerGroup) markersLayerGroup.addLayer(marker);
    });
}

function renderResults(reset = false) {
    if (reset) page = 0;
    const start = page * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE);
    if (reset) resultsList.innerHTML = '';

    slice.forEach(area => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <div class="result-header">
                <span class="result-mineral">${iconFor(area.mineral)} ${area.mineral}</span>
                <strong class="result-id">Área: ${area.id}</strong>
            </div>
            <div class="result-body">
                <div>${area.location}</div>
                <div>🏢 ${area.company}</div>
                <div>📐 ${area.area_hectares} ha</div>
                <div>📊 ${area.status}</div>
                <div>🔬 ${area.synthetic ? 'Sintético' : 'Origem pública'}</div>
                ${area.source ? `<div>🔗 <a href="${area.source}" target="_blank" rel="noopener">Fonte</a></div>` : ''}
            </div>
            <div class="result-actions">
                <button class="btn btn-primary" data-id="${area.id}">Ver Detalhes</button>
            </div>
        `;
        resultsList.appendChild(item);
    });

    resultsCount.textContent = filtered.length;

    // attach detail handlers
    resultsList.querySelectorAll('.result-actions button').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const area = areas.find(a => a.id === id);
            if (area) openDetail(area);
        });
    });
}

function iconFor(mineral) {
    const map = {
        'Lítio': '🟡',
        'Nióbio': '🔵',
        'Cobre': '🟠',
        'Ferro': '🔴',
        'Terras Raras': '🟢',
        'Grafita': '⚫',
        'Ouro': '🥇'
    };
    return map[mineral] || '⚫';
}

function applyFiltersNow() {
    const mineral = mineralFilter ? mineralFilter.value : 'all';
    const q = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase();
    const companyQ = (companyFilter && companyFilter.value ? companyFilter.value : '').toLowerCase();
    const statuses = Array.from(document.querySelectorAll('.checkboxes input:checked')).map(c => c.value);
    const reserveSize = reserveSizeFilter ? reserveSizeFilter.value : 'all';
    const pmin = prodMin && prodMin.value ? Number(prodMin.value) : null;
    const pmax = prodMax && prodMax.value ? Number(prodMax.value) : null;
    const onlyOfficial = officialOnly && officialOnly.checked;
    const order = sortBy ? sortBy.value : 'relevance';

    filtered = areas.filter(a => {
        if (mineral !== 'all' && a.mineral !== mineral) return false;
        if (!statuses.includes(a.status)) return false;
        if (companyQ && !a.company.toLowerCase().includes(companyQ)) return false;
        if (q) {
            const inId = a.id.toLowerCase().includes(q);
            const inLoc = a.location.toLowerCase().includes(q);
            if (!(inId || inLoc)) return false;
        }
        // official data filter
        if (onlyOfficial && a.synthetic) return false;
        // production filter (use estimated_production_tpa when available)
        const prod = a.estimated_production_tpa || 0;
        if (pmin !== null && prod < pmin) return false;
        if (pmax !== null && prod > pmax) return false;
        // reserve size filter (proxy using production)
        if (reserveSize !== 'all') {
            if (reserveSize === 'small' && prod >= 10000) return false;
            if (reserveSize === 'medium' && (prod < 10000 || prod > 100000)) return false;
            if (reserveSize === 'large' && prod <= 100000) return false;
        }
        return true;
    });

    // ordering
    if (order === 'production_desc') filtered.sort((a,b) => (b.estimated_production_tpa||0) - (a.estimated_production_tpa||0));
    if (order === 'production_asc') filtered.sort((a,b) => (a.estimated_production_tpa||0) - (b.estimated_production_tpa||0));
    if (order === 'area_desc') filtered.sort((a,b) => (b.area_hectares||0) - (a.area_hectares||0));
    if (order === 'area_asc') filtered.sort((a,b) => (a.area_hectares||0) - (b.area_hectares||0));

    renderMarkers();
    renderResults(true);
    updateStats();
}

function clearFiltersNow() {
    mineralFilter.value = 'all';
    searchInput.value = '';
    companyFilter.value = '';
    document.querySelectorAll('.checkboxes input').forEach(c => c.checked = true);
    applyFiltersNow();
}

function openDetail(area) {
    detailContent.innerHTML = `
        <h2>📍 ${area.id}</h2>
        <p><strong>Minério:</strong> ${area.mineral}</p>
        <p><strong>Local:</strong> ${area.location}</p>
        <p><strong>Empresa:</strong> ${area.company}</p>
        <p><strong>Status:</strong> ${area.status}</p>
        <p><strong>Área:</strong> ${area.area_hectares} hectares</p>
        <p><strong>Período:</strong> ${area.concession_period}</p>
        <p><strong>Produção estimada:</strong> ${area.estimated_production} ton/ano</p>
        <div style="margin-top:1rem;"><button class=\"btn btn-primary\" onclick=\"closeDetail()\">Fechar</button></div>
    `;
    detailModal.classList.add('active');
}

function closeDetail() {
    detailModal.classList.remove('active');
}

function updateStats() {
    document.getElementById('statTotal').textContent = areas.length;
    document.getElementById('statOneradas').textContent = areas.filter(a => a.status === 'Onerada').length;
    document.getElementById('statDisponiveis').textContent = areas.filter(a => a.status === 'Disponível').length;
    const companies = new Set(areas.map(a => a.company));
    document.getElementById('statEmpresas').textContent = companies.size;
}

// Wire events and initial load after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('prospecting-map: DOM ready — inicializando mapa e UI');
    resultsList = document.getElementById('resultsList');
    resultsCount = document.getElementById('resultsCount');
    mineralFilter = document.getElementById('mineralFilter');
    searchInput = document.getElementById('searchInput');
    companyFilter = document.getElementById('companyFilter');
    reserveSizeFilter = document.getElementById('reserveSizeFilter');
    prodMin = document.getElementById('prodMin');
    prodMax = document.getElementById('prodMax');
    officialOnly = document.getElementById('officialOnly');
    sortBy = document.getElementById('sortBy');
    applyFilters = document.getElementById('applyFilters');
    clearFilters = document.getElementById('clearFilters');
    detailModal = document.getElementById('detailModal');
    detailContent = document.getElementById('detailContent');
    detailClose = document.getElementById('detailClose');
    zoomRange = document.getElementById('zoomRange');
    zoomIn = document.getElementById('zoomIn');
    zoomOut = document.getElementById('zoomOut');
    sgbToggle = document.getElementById('sgbToggle');
    themeToggleBtn = document.getElementById('themeToggle');
    themeIconEl = document.getElementById('themeIcon');
    // init theme
    try { initThemeFromStorage(); } catch (e) { /* ignore */ }
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        setTheme(isLight ? 'dark' : 'light');
    });
    // new controls
    const layersBtn = document.getElementById('layersBtn');
    const measureBtn = document.getElementById('measureBtn');
    const markBtn = document.getElementById('markBtn');
    const exportBtn = document.getElementById('exportBtn');
    const sidebarToggle = document.getElementById('sidebarToggle');

    applyFilters.addEventListener('click', applyFiltersNow);
    clearFilters.addEventListener('click', clearFiltersNow);
    // live updates for some controls
    if (mineralFilter) mineralFilter.addEventListener('change', applyFiltersNow);
    if (reserveSizeFilter) reserveSizeFilter.addEventListener('change', applyFiltersNow);
    if (officialOnly) officialOnly.addEventListener('change', applyFiltersNow);
    if (sortBy) sortBy.addEventListener('change', applyFiltersNow);
    if (prodMin) prodMin.addEventListener('input', applyFiltersNow);
    if (prodMax) prodMax.addEventListener('input', applyFiltersNow);
    if (sgbToggle) sgbToggle.addEventListener('change', () => {
        if (sgbToggle.checked) {
            // lazy load clusters and show
            if (!sgbClusters) loadSgbClusters().then(() => showSgbLayer(true)); else showSgbLayer(true);
        } else {
            showSgbLayer(false);
        }
    });
    detailClose.addEventListener('click', closeDetail);
    window.closeDetail = closeDetail; // expose for inline buttons

    // prepare user marks layer
    userMarksLayer = L.layerGroup();
    // handlers for new controls
    if (layersBtn) layersBtn.addEventListener('click', () => {
        // toggle legend visibility
        const legend = document.querySelector('.map-legend');
        const stats = document.querySelector('.map-stats');
        if (legend) legend.classList.toggle('hidden');
        if (stats) stats.classList.toggle('hidden');
    });

    if (measureBtn) measureBtn.addEventListener('click', () => {
        measureMode = !measureMode;
        markMode = false;
        measurePoints = [];
        measureBtn.classList.toggle('active', measureMode);
        if (measureMode) alert('Modo medição ativado: clique no mapa para definir pontos (duas marcações calculam distância). Clique novamente no botão para sair.');
    });

    if (markBtn) markBtn.addEventListener('click', () => {
        markMode = !markMode;
        measureMode = false;
        markBtn.classList.toggle('active', markMode);
        if (markMode) alert('Clique no mapa para marcar uma área e adicionar uma anotação. Clique novamente no botão para sair.');
    });

    if (exportBtn) exportBtn.addEventListener('click', () => {
        exportFilteredAsCSV();
    });

    if (sidebarToggle) sidebarToggle.addEventListener('click', () => {
        const sidebar = document.querySelector('.map-sidebar');
        if (sidebar) sidebar.classList.toggle('collapsed');
        // after collapsing, invalidate map size so Leaflet redraws
        setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    });

    // global map click handler to support measure & mark modes
    document.addEventListener('click', () => {});


    // click outside closes modal
    detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeDetail(); });

    // initial load
    loadAreas();
    // prepare empty layer group for SGB clusters (will be attached to map when map exists)
    sgbLayerGroup = L.layerGroup();
});

async function loadSgbClusters() {
    try {
        const res = await fetch('areas_from_sgb_clusters.json');
        if (!res.ok) throw new Error('SGB clusters not found');
        sgbClusters = await res.json();
        // build features
        sgbLayerGroup.clearLayers();
        sgbClusters.forEach(c => {
            const centroid = c.centroid; // [lat, lon]
            const count = c.count || 1;
            // polygon/hull
            if (c.hull && c.hull.length > 1) {
                // ensure coordinates are [lat, lon]
                const latlngs = c.hull.map(p => [p[0], p[1]]);
                const poly = L.polygon(latlngs, {color:'#3388ff', weight:1, fillOpacity:0.15});
                poly.bindPopup(`<strong>${c.cluster_id}</strong><br/>pontos: ${count}<br/>centro: ${centroid[0].toFixed(6)}, ${centroid[1].toFixed(6)}<br/><a href="${c.pdf}" target="_blank">PDF fonte</a>`);
                sgbLayerGroup.addLayer(poly);
            }
            // centroid marker
            const marker = L.circleMarker([centroid[0], centroid[1]], {radius:4 + Math.log2(Math.max(1,count))*2, fillColor:'#ff7800', color:'#fff', weight:1, fillOpacity:0.9});
            marker.bindPopup(`<strong>${c.cluster_id}</strong><br/>pontos: ${count}<br/>centro: ${centroid[0].toFixed(6)}, ${centroid[1].toFixed(6)}<br/><a href="${c.pdf}" target="_blank">PDF fonte</a>`);
            sgbLayerGroup.addLayer(marker);
        });
        console.log('SGB clusters carregados:', sgbClusters.length);
    } catch (err) {
        console.warn('Falha ao carregar clusters SGB', err);
    }
}

// handle map clicks for measure/mark modes
function onMapClickForModes(e) {
    if (!map) return;
    if (measureMode) {
        measurePoints.push(e.latlng);
        L.circleMarker(e.latlng, {radius:4, color:'#fff', fillColor:'#2b9', fillOpacity:1}).addTo(userMarksLayer);
        if (measurePoints.length === 2) {
            const a = measurePoints[0];
            const b = measurePoints[1];
            const dist = map.distance(a, b); // meters
            const line = L.polyline([a,b], {color:'#2b9', weight:2}).addTo(userMarksLayer);
            L.popup().setLatLng(b).setContent(`<strong>Distância:</strong> ${(dist/1000).toFixed(3)} km`).openOn(map);
            // reset points to allow repeated measures
            measurePoints = [];
            measureMode = false;
            const measureBtn = document.getElementById('measureBtn'); if (measureBtn) measureBtn.classList.remove('active');
        }
    } else if (markMode) {
        const name = window.prompt('Nome da área/marcação (opcional)');
        const marker = L.marker(e.latlng).bindPopup(`<strong>${name || 'Marcação'}</strong><br/>${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
        userMarksLayer.addLayer(marker);
    }
}

// attach map click handler after map is initialized
function attachMapClickModes() {
    if (!map) return;
    map.on('click', onMapClickForModes);
    // ensure user marks layer is on map
    if (userMarksLayer && !map.hasLayer(userMarksLayer)) userMarksLayer.addTo(map);
}

// export filtered results as CSV and trigger download
function exportFilteredAsCSV() {
    const rows = [['id','mineral','company','lat','lon','status','area_hectares','source']];
    filtered.forEach(a => {
        if (!showSynthetic && a.synthetic) return;
        const lat = a.coordinates && a.coordinates[0] || '';
        const lon = a.coordinates && a.coordinates[1] || '';
        rows.push([a.id || '', a.mineral || '', a.company || '', lat, lon, a.status || '', a.area_hectares || '', a.source || '']);
    });
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'areas_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// update renderMarkers to ensure attach map click modes after first render
const originalRenderMarkers = renderMarkers;
renderMarkers = function() {
    originalRenderMarkers();
    attachMapClickModes();
}

function showSgbLayer(visible) {
    if (!sgbLayerGroup) return;
    if (visible) {
        // ensure visible on map
        sgbLayerGroup.addTo(map);
    } else {
        map.removeLayer(sgbLayerGroup);
    }
}

