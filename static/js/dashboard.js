// ====================================
// INDUSTRIAL-GRADE DASHBOARD - FINAL VERSION
// Fixed Sidebar Toggle + New Features
// ====================================

const appState = {
    socket: null,
    map: null,
    charts: {},
    markers: {},
    nodes: [],
    alerts: [],
    settings: {
        zoom: 12,
        autoCenter: true,
        sound: true,
        timeout: 30,
        refresh: 5,
        sidebarAutohide: true,
        sidebarPin: false
    },
    isDarkMode: false,
    currentTab: 'overview',
    selectedNode: null,
    isFullscreen: false,
    sidebarOpen: window.innerWidth > 768  // Sidebar open by default on desktop
};

const dataStore = {
    temperature: [],
    humidity: [],
    pressure: [],
    iaq: [],
    battery: [],
    rssi: [],
    maxPoints: 50
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Dashboard...');

    loadSettings();

    setTimeout(() => {
        hideLoadingScreen();
        initializeMap();
        initializeCharts();
        initializeWebSocket();
        loadInitialData();
        startPeriodicUpdates();
        initializeEventListeners();
        setSidebarState();
    }, 1000);
});

// Hide loading screen
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.add('hidden');
    setTimeout(() => loadingScreen.remove(), 500);
}

// ====================================
// FIXED SIDEBAR TOGGLE FUNCTIONALITY
// ====================================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    appState.sidebarOpen = !appState.sidebarOpen;

    if (window.innerWidth <= 768) {
        // Mobile: use overlay + slide animation
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }

    // Save state
    localStorage.setItem('sidebarOpen', appState.sidebarOpen);
}

function setSidebarState() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    // Restore saved state
    const savedState = localStorage.getItem('sidebarOpen');
    if (savedState !== null) {
        appState.sidebarOpen = JSON.parse(savedState);
    }

    if (window.innerWidth <= 768) {
        if (appState.sidebarOpen) {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        } else {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        }
    }
}

// Handle window resize for responsive behavior
window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth > 768) {
        sidebar.classList.remove('active');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }
});

// Close sidebar when clicking on a node (mobile)
function selectNode(nodeId) {
    appState.selectedNode = nodeId;
    const node = appState.nodes.find(n => n.node_id === nodeId);

    if (node && node.latest_data && node.latest_data.latitude) {
        appState.map.setView([node.latest_data.latitude, node.latest_data.longitude], 15);

        if (appState.markers[nodeId]) {
            appState.markers[nodeId].openPopup();
        }
    }

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        toggleSidebar();
    }
}

// ====================================
// MAP INITIALIZATION
// ====================================

function initializeMap() {
    console.log('📍 Initializing map...');

    appState.map = L.map('map').setView([27.7, 85.3], appState.settings.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(appState.map);

    L.control.scale().addTo(appState.map);

    console.log('✓ Map initialized');
}

function centerMap() {
    if (Object.keys(appState.markers).length === 0) return;

    const group = new L.featureGroup(Object.values(appState.markers));
    appState.map.fitBounds(group.getBounds().pad(0.1));
}

function refreshMap() {
    appState.map.invalidateSize();
    loadNodes();
    showNotification('Map refreshed', 'info');
}

function downloadMapImage() {
    showNotification('Map screenshot will be available soon', 'info');
}

// ====================================
// CHART INITIALIZATION & MANAGEMENT
// ====================================

function initializeCharts() {
    console.log('📈 Initializing charts...');

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: true, position: 'top' },
            tooltip: { enabled: true, backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 12, cornerRadius: 8 }
        },
        scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: false, grid: { color: 'rgba(0, 0, 0, 0.05)' } }
        }
    };

    createChart('tempChart', 'Temperature (°C)', '#ef4444', chartOptions);
    createChart('humidityChart', 'Humidity (%)', '#3b82f6', chartOptions);
    createChart('iaqChart', 'Air Quality Index', '#10b981', chartOptions);
    createChart('batteryChart', 'Battery (mV)', '#f59e0b', chartOptions);
    createChart('rssiChart', 'Signal Strength (dBm)', '#8b5cf6', chartOptions);
    createChart('pressureChart', 'Pressure (hPa)', '#06b6d4', chartOptions);

    console.log('✓ Charts initialized');
}

function createChart(canvasId, label, color, options) {
    appState.charts[canvasId.replace('Chart', '')] = new Chart(
        document.getElementById(canvasId),
        {
            type: 'line',
            data: {
                datasets: [{
                    label: label,
                    data: [],
                    borderColor: color,
                    backgroundColor: color + '1a',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: options
        }
    );
}

function downloadChart(chartId) {
    const chart = appState.charts[chartId.replace('Chart', '')];
    if (chart) {
        const image = chart.toBase64Image();
        const link = document.createElement('a');
        link.href = image;
        link.download = `${chartId}_${new Date().toISOString().split('T')[0]}.png`;
        link.click();
        showNotification('Chart downloaded', 'success');
    }
}

function exportChartData() {
    const data = {
        timestamp: new Date().toISOString(),
        charts: {}
    };

    Object.entries(appState.charts).forEach(([key, chart]) => {
        if (chart && chart.data.datasets[0]) {
            data.charts[key] = chart.data.datasets[0].data;
        }
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    showNotification('Chart data exported', 'success');
}

// ====================================
// WEBSOCKET CONNECTION
// ====================================

function initializeWebSocket() {
    console.log('🔌 Connecting to WebSocket...');

    appState.socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    appState.socket.on('connect', function() {
        console.log('✓ WebSocket connected');
        updateConnectionStatus(true);
        showNotification('Connected to server', 'success');
    });

    appState.socket.on('disconnect', function() {
        console.log('⚠️ WebSocket disconnected');
        updateConnectionStatus(false);
        showNotification('Disconnected from server', 'error');
    });

    appState.socket.on('sensorUpdate', function(data) {
        handleSensorUpdate(data);
    });
}

function updateConnectionStatus(connected) {
    const statusText = document.getElementById('connection-status');
    const statusDot = document.getElementById('status-dot');

    if (connected) {
        statusText.textContent = 'Connected';
        statusDot.classList.add('connected');
    } else {
        statusText.textContent = 'Disconnected';
        statusDot.classList.remove('connected');
    }
}

function handleSensorUpdate(data) {
    console.log('📊 Sensor update:', data.node_id);

    updateNodeMarker(data);
    updateChartData(data);
    updateNodeInList(data);
    updateStatistics();
    updateQuickStats();
    addLogEntry(data);

    if (data.emergency) {
        handleEmergency(data);
    }

    checkWarnings(data);
}

// ====================================
// NODE MANAGEMENT
// ====================================

async function loadNodes() {
    try {
        const response = await fetch('/api/nodes');
        const nodes = await response.json();
        appState.nodes = nodes;

        renderNodeList(nodes);

        nodes.forEach(node => {
            if (node.latest_data && node.latest_data.latitude && node.latest_data.longitude) {
                updateNodeMarker({
                    node_id: node.node_id,
                    ...node.latest_data
                });
            }
        });

        updateStatistics();
    } catch (error) {
        console.error('Error loading nodes:', error);
    }
}

function renderNodeList(nodes) {
    const container = document.getElementById('nodes-container');
    container.innerHTML = '';

    if (nodes.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 20px; text-align: center;">No nodes found</p>';
        return;
    }

    nodes.forEach(node => {
        const card = createNodeCard(node);
        container.appendChild(card);
    });
}

function createNodeCard(node) {
    const card = document.createElement('div');
    const data = node.latest_data || {};
    const isOnline = node.last_seen && (new Date() - new Date(node.last_seen)) < 600000;

    let statusClass = 'node-card';
    if (data.emergency) statusClass += ' emergency';
    else if (!isOnline) statusClass += ' offline';
    else if (data.battery_mv < 3300) statusClass += ' warning';

    card.className = statusClass;
    card.innerHTML = `
        <h5>
            <i class="fas fa-broadcast-tower"></i> ${node.name}
            ${data.emergency ? '<i class="fas fa-exclamation-triangle" style="color: var(--danger-color); float: right;"></i>' : ''}
        </h5>
        <div class="node-info">
            <div><i class="fas fa-map-marker-alt"></i> ${data.latitude?.toFixed(6) || 'N/A'}, ${data.longitude?.toFixed(6) || 'N/A'}</div>
            <div><i class="fas fa-thermometer-half"></i> ${data.temperature?.toFixed(1) || '--'}°C | <i class="fas fa-tint"></i> ${data.humidity?.toFixed(1) || '--'}%</div>
            <div><i class="fas fa-wind"></i> IAQ: ${data.iaq || '--'} | <i class="fas fa-signal"></i> ${data.rssi || '--'}dBm</div>
            <div><i class="fas fa-battery-three-quarters"></i> ${data.battery_mv || '--'}mV</div>
            <div style="color: ${isOnline ? 'var(--success-color)' : 'var(--danger-color)'};">
                <i class="fas fa-circle" style="font-size: 8px;"></i> ${isOnline ? 'Online' : 'Offline'}
            </div>
        </div>
    `;

    card.onclick = () => selectNode(node.node_id);

    return card;
}

function updateNodeInList(data) {
    const existingNode = appState.nodes.find(n => n.node_id === data.node_id);

    if (existingNode) {
        existingNode.latest_data = data;
        existingNode.last_seen = data.timestamp;
    } else {
        appState.nodes.push({
            node_id: data.node_id,
            name: `Node ${data.node_id}`,
            latest_data: data,
            last_seen: data.timestamp
        });
    }

    renderNodeList(appState.nodes);
}

function filterNodes() {
    const searchTerm = document.getElementById('node-search').value.toLowerCase();
    const cards = document.querySelectorAll('.node-card');

    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// ====================================
// MAP MARKERS
// ====================================

function updateNodeMarker(data) {
    const lat = data.latitude;
    const lon = data.longitude;

    if (!lat || !lon || lat === 0 || lon === 0) return;

    let iconColor = 'blue';
    if (data.emergency) iconColor = 'red';
    else if (data.battery_mv < 3300) iconColor = 'orange';

    const icon = L.icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${iconColor}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    if (appState.markers[data.node_id]) {
        appState.markers[data.node_id].setLatLng([lat, lon]).setIcon(icon);
    } else {
        appState.markers[data.node_id] = L.marker([lat, lon], {icon: icon}).addTo(appState.map);
    }

    const popupContent = createMarkerPopup(data);
    appState.markers[data.node_id].bindPopup(popupContent);

    if (data.emergency && appState.settings.autoCenter) {
        appState.map.setView([lat, lon], 15);
        appState.markers[data.node_id].openPopup();
    }
}

function createMarkerPopup(data) {
    const qualityLevel = getAirQualityLevel(data.iaq);
    const batteryPercent = ((data.battery_mv - 3000) / 1200 * 100).toFixed(0);

    return `
        <div style="min-width: 200px;">
            <h3 style="margin: 0 0 10px 0; color: var(--primary-color);">
                <i class="fas fa-broadcast-tower"></i> Node ${data.node_id}
            </h3>
            <div style="font-size: 14px; line-height: 1.8;">
                <div><strong>🌡️ Temperature:</strong> ${data.temperature?.toFixed(1)}°C</div>
                <div><strong>💧 Humidity:</strong> ${data.humidity?.toFixed(1)}%</div>
                <div><strong>🌫️ Air Quality:</strong> ${data.iaq} (${qualityLevel})</div>
                <div><strong>🏔️ Pressure:</strong> ${data.pressure} hPa</div>
                <div><strong>🔋 Battery:</strong> ${data.battery_mv}mV (${batteryPercent}%)</div>
                <div><strong>📶 Signal:</strong> ${data.rssi}dBm</div>
                ${data.emergency ? '<div style="color: red; font-weight: bold; margin-top: 8px;">⚠️ EMERGENCY ACTIVE</div>' : ''}
            </div>
        </div>
    `;
}

function getAirQualityLevel(iaq) {
    if (iaq <= 50) return 'Excellent';
    if (iaq <= 100) return 'Good';
    if (iaq <= 150) return 'Moderate';
    if (iaq <= 200) return 'Poor';
    return 'Very Poor';
}

// ====================================
// STATISTICS & METRICS
// ====================================

function updateStatistics() {
    const activeNodes = appState.nodes.filter(n => {
        if (!n.last_seen) return false;
        return (new Date() - new Date(n.last_seen)) < 600000;
    });

    const onlineCount = activeNodes.length;
    const warningCount = activeNodes.filter(n => 
        n.latest_data && (n.latest_data.battery_mv < 3300 || n.latest_data.iaq > 150)
    ).length;
    const alertCount = appState.alerts.filter(a => !a.acknowledged).length;

    document.getElementById('stat-nodes').textContent = appState.nodes.length;
    document.getElementById('stat-online').textContent = onlineCount;
    document.getElementById('stat-warnings').textContent = warningCount;
    document.getElementById('stat-alerts').textContent = alertCount;
}

function updateQuickStats() {
    const activeNodes = appState.nodes.filter(n => n.latest_data);

    if (activeNodes.length === 0) return;

    const avgTemp = activeNodes.reduce((sum, n) => sum + (n.latest_data.temperature || 0), 0) / activeNodes.length;
    const avgHumidity = activeNodes.reduce((sum, n) => sum + (n.latest_data.humidity || 0), 0) / activeNodes.length;
    const avgIAQ = activeNodes.reduce((sum, n) => sum + (n.latest_data.iaq || 0), 0) / activeNodes.length;
    const avgRSSI = activeNodes.reduce((sum, n) => sum + (n.latest_data.rssi || 0), 0) / activeNodes.length;

    document.getElementById('avg-temp').textContent = avgTemp.toFixed(1) + '°C';
    document.getElementById('avg-humidity').textContent = avgHumidity.toFixed(1) + '%';
    document.getElementById('avg-iaq').textContent = Math.round(avgIAQ);
    document.getElementById('avg-rssi').textContent = avgRSSI.toFixed(0) + ' dBm';
}

// ====================================
// CHART DATA UPDATE
// ====================================

function updateChartData(data) {
    const timestamp = new Date(data.timestamp);

    const chartUpdates = {
        'temp': data.temperature,
        'humidity': data.humidity,
        'iaq': data.iaq,
        'battery': data.battery_mv,
        'rssi': data.rssi,
        'pressure': data.pressure
    };

    Object.entries(chartUpdates).forEach(([key, value]) => {
        if (appState.charts[key]) {
            const dataset = appState.charts[key].data.datasets[0];

            dataset.data.push({ x: timestamp, y: value });

            if (dataset.data.length > dataStore.maxPoints) {
                dataset.data.shift();
            }

            appState.charts[key].update('none');
        }
    });
}

// ====================================
// EMERGENCY & ALERT HANDLING
// ====================================

async function handleEmergency(data) {
    console.log('🚨 EMERGENCY DETECTED:', data.node_id);

    const banner = document.getElementById('emergency-banner');
    const message = document.getElementById('emergency-message');

    message.innerHTML = `
        <strong>Node ${data.node_id}</strong> triggered emergency alert at 
        <strong>${new Date(data.timestamp).toLocaleString()}</strong><br>
        Location: ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}
    `;

    banner.style.display = 'block';

    if (appState.settings.sound) {
        playAlertSound();
    }

    appState.alerts.unshift({
        id: Date.now(),
        node_id: data.node_id,
        timestamp: data.timestamp,
        latitude: data.latitude,
        longitude: data.longitude,
        acknowledged: false
    });

    updateAlertsDisplay();
    updateStatistics();

    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
    }

    showBrowserNotification('Emergency Alert', `Node ${data.node_id} requires immediate attention!`);

    // Auto-acknowledge after timeout
    setTimeout(() => {
        if (appState.settings.timeout > 0) {
            acknowledgeEmergency();
        }
    }, appState.settings.timeout * 1000);
}

function acknowledgeEmergency() {
    document.getElementById('emergency-banner').style.display = 'none';

    if (appState.alerts.length > 0) {
        appState.alerts[0].acknowledged = true;
    }

    updateAlertsDisplay();
    updateStatistics();

    showNotification('Emergency acknowledged', 'success');
}

function checkWarnings(data) {
    const warnings = [];

    if (data.battery_mv < 3300) {
        warnings.push(`Low battery: ${data.battery_mv}mV`);
    }

    if (data.iaq > 150) {
        warnings.push(`Poor air quality: ${data.iaq}`);
    }

    if (data.rssi < -100) {
        warnings.push(`Weak signal: ${data.rssi}dBm`);
    }

    if (data.temperature > 40) {
        warnings.push(`High temperature: ${data.temperature}°C`);
    }

    if (warnings.length > 0) {
        console.warn(`⚠️ Warnings for Node ${data.node_id}:`, warnings);
        addLogEntry(data, 'warning', warnings.join(', '));
    }
}

async function loadAlerts() {
    try {
        const response = await fetch('/api/alerts');
        appState.alerts = await response.json();
        updateAlertsDisplay();
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

function updateAlertsDisplay() {
    const container = document.getElementById('alerts-container');
    const unacknowledged = appState.alerts.filter(a => !a.acknowledged);

    container.innerHTML = '';

    if (unacknowledged.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 20px; text-align: center;">No active alerts</p>';
        return;
    }

    unacknowledged.slice(0, 10).forEach(alert => {
        const item = document.createElement('div');
        item.className = 'alert-item';
        item.innerHTML = `
            <strong><i class="fas fa-exclamation-triangle"></i> Node ${alert.node_id}</strong><br>
            ${new Date(alert.timestamp).toLocaleString()}<br>
            <small>${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}</small>
        `;
        container.appendChild(item);
    });
}

// ====================================
// SIREN CONTROL
// ====================================

async function controlSiren(action) {
    try {
        const response = await fetch('/api/siren/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action })
        });

        const data = await response.json();

        if (data.success) {
            const status = document.getElementById('siren-status');
            const indicator = status.querySelector('.siren-indicator');

            if (action === 'on') {
                indicator.classList.add('active');
                status.querySelector('span:last-child').textContent = 'Siren: ON';
                showNotification('Siren activated', 'warning');
            } else {
                indicator.classList.remove('active');
                status.querySelector('span:last-child').textContent = 'Siren: OFF';
                showNotification('Siren deactivated', 'info');
            }
        } else {
            showNotification('Siren control failed: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Siren control error:', error);
        showNotification('Failed to control siren', 'error');
    }
}

// ====================================
// LOGGING SYSTEM
// ====================================

const logSystem = {
    entries: [],
    maxEntries: 500
};

function addLogEntry(data, level = 'info', message = '') {
    const entry = {
        timestamp: new Date(data.timestamp || Date.now()),
        level: level,
        nodeId: data.node_id,
        message: message || `Node ${data.node_id} update received`,
        data: data
    };

    logSystem.entries.unshift(entry);

    if (logSystem.entries.length > logSystem.maxEntries) {
        logSystem.entries.pop();
    }

    if (appState.currentTab === 'logs') {
        renderLogs();
    }
}

function renderLogs() {
    const container = document.getElementById('logs-container');
    const filter = document.getElementById('log-filter')?.value || 'all';

    let filtered = logSystem.entries;
    if (filter !== 'all') {
        filtered = logSystem.entries.filter(e => e.level === filter);
    }

    container.innerHTML = '';

    filtered.slice(0, 100).forEach(entry => {
        const logDiv = document.createElement('div');
        logDiv.className = `log-entry ${entry.level}`;
        logDiv.innerHTML = `
            <strong>[${entry.timestamp.toLocaleTimeString()}]</strong> 
            <span style="text-transform: uppercase; font-weight: bold;">[${entry.level}]</span>
            Node ${entry.nodeId}: ${entry.message}
        `;
        container.appendChild(logDiv);
    });
}

function filterLogs() {
    renderLogs();
}

function clearLogs() {
    if (confirm('Are you sure you want to clear all logs?')) {
        logSystem.entries = [];
        renderLogs();
        showNotification('Logs cleared', 'info');
    }
}

function exportLogs() {
    const data = logSystem.entries.map(e => ({
        timestamp: e.timestamp.toISOString(),
        level: e.level,
        node_id: e.nodeId,
        message: e.message
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lora_logs_${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    showNotification('Logs exported', 'success');
}

// ====================================
// REPORT GENERATION
// ====================================

function generateReport() {
    const reportType = document.querySelector('input[name="report-type"]:checked').value;
    const includeSections = Array.from(document.querySelectorAll('.report-include:checked')).map(cb => cb.value);
    const timePeriod = document.getElementById('report-period').value;

    const report = {
        generated: new Date().toISOString(),
        reportType: reportType,
        timePeriod: timePeriod,
        sections: includeSections,
        data: {}
    };

    if (includeSections.includes('nodes')) {
        report.data.nodes = appState.nodes;
    }

    if (includeSections.includes('metrics')) {
        report.data.metrics = {
            avgTemp: document.getElementById('avg-temp').textContent,
            avgHumidity: document.getElementById('avg-humidity').textContent,
            avgIAQ: document.getElementById('avg-iaq').textContent,
            avgRSSI: document.getElementById('avg-rssi').textContent
        };
    }

    if (includeSections.includes('alerts')) {
        report.data.alerts = appState.alerts;
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lora_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    showNotification('Report generated and downloaded', 'success');
}

// ====================================
// TAB NAVIGATION
// ====================================

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    appState.currentTab = tabName;

    if (tabName === 'overview') {
        appState.map.invalidateSize();
    } else if (tabName === 'analytics') {
        Object.values(appState.charts).forEach(chart => chart.update());
    } else if (tabName === 'logs') {
        renderLogs();
    }
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

function playAlertSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        background: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.3s;
    `;

    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ';
    const color = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6';

    notification.innerHTML = `
        <span style="font-size: 20px; color: ${color};">${icon}</span>
        <span style="color: #0f172a; font-weight: 500;">${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showBrowserNotification(title, body) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(title, { body });
            }
        });
    }
}

// ====================================
// SETTINGS & CONFIGURATION
// ====================================

function showSettings() {
    document.getElementById('settings-modal').classList.add('active');

    document.getElementById('setting-zoom').value = appState.settings.zoom;
    document.getElementById('setting-autocenter').checked = appState.settings.autoCenter;
    document.getElementById('setting-sound').checked = appState.settings.sound;
    document.getElementById('setting-timeout').value = appState.settings.timeout;
    document.getElementById('setting-refresh').value = appState.settings.refresh;
    document.getElementById('setting-sidebar-autohide').checked = appState.settings.sidebarAutohide;
    document.getElementById('setting-sidebar-pin').checked = appState.settings.sidebarPin;
}

function closeSettings() {
    document.getElementById('settings-modal').classList.remove('active');
}

function saveSettings() {
    appState.settings.zoom = parseInt(document.getElementById('setting-zoom').value);
    appState.settings.autoCenter = document.getElementById('setting-autocenter').checked;
    appState.settings.sound = document.getElementById('setting-sound').checked;
    appState.settings.timeout = parseInt(document.getElementById('setting-timeout').value);
    appState.settings.refresh = parseInt(document.getElementById('setting-refresh').value);
    appState.settings.sidebarAutohide = document.getElementById('setting-sidebar-autohide').checked;
    appState.settings.sidebarPin = document.getElementById('setting-sidebar-pin').checked;

    localStorage.setItem('dashboardSettings', JSON.stringify(appState.settings));

    closeSettings();
    showNotification('Settings saved', 'success');
}

function loadSettings() {
    const saved = localStorage.getItem('dashboardSettings');
    if (saved) {
        appState.settings = { ...appState.settings, ...JSON.parse(saved) };
    }
}

// ====================================
// THEME & UI CONTROLS
// ====================================

function toggleDarkMode() {
    appState.isDarkMode = !appState.isDarkMode;
    document.body.classList.toggle('dark-mode');

    const icon = document.getElementById('theme-icon');
    icon.className = appState.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';

    localStorage.setItem('darkMode', appState.isDarkMode);

    Object.values(appState.charts).forEach(chart => {
        chart.options.scales.y.grid.color = appState.isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        chart.update();
    });
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        appState.isFullscreen = true;
    } else {
        document.exitFullscreen();
        appState.isFullscreen = false;
    }
}

// ====================================
// DATA EXPORT
// ====================================

function exportData() {
    const exportData = {
        nodes: appState.nodes,
        alerts: appState.alerts,
        timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lora_data_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    showNotification('Data exported successfully', 'success');
}

// ====================================
// PERIODIC UPDATES & INITIALIZATION
// ====================================

function loadInitialData() {
    loadNodes();
    loadAlerts();
}

function startPeriodicUpdates() {
    setInterval(() => {
        document.getElementById('current-time').textContent = new Date().toLocaleString();
    }, 1000);

    setInterval(() => {
        loadNodes();
    }, appState.settings.refresh * 1000);

    setInterval(() => {
        checkStaleNodes();
    }, 60000);
}

function checkStaleNodes() {
    const now = new Date();
    appState.nodes.forEach(node => {
        if (node.last_seen) {
            const lastSeen = new Date(node.last_seen);
            const minutesAgo = (now - lastSeen) / 60000;

            if (minutesAgo > 10 && minutesAgo < 11) {
                addLogEntry({node_id: node.node_id, timestamp: now}, 'warning', `Node ${node.node_id} offline for ${Math.round(minutesAgo)} minutes`);
            }
        }
    });
}

function initializeEventListeners() {
    document.getElementById('settings-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeSettings();
        }
    });

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    @keyframes slideDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
    }
`;
document.head.appendChild(style);

console.log('✅ Dashboard initialized successfully');
