# 🚨 LoRa Industrial Highway Monitoring Dashboard - FINAL EDITION

## ✨ Latest Updates (Fixed Version)

### 🔧 Critical Bug Fixes
- ✅ **Fixed Hamburger Menu Issue** - Menu button is now ALWAYS visible in the navbar
- ✅ **Mobile Responsive Sidebar** - Slides in/out with overlay on mobile devices
- ✅ **Desktop Persistent Sidebar** - Always visible on desktop, collapses only on mobile
- ✅ **Proper Toggle Logic** - Click hamburger to open/close, click overlay to close on mobile
- ✅ **Sidebar State Persistence** - Remembers your last sidebar state in localStorage

### 🎉 New Features Added
- 📊 **Chart Download** - Download individual charts as PNG images
- 📈 **Export Chart Data** - Export all chart data as JSON
- 📄 **Report Generation Tab** - Create custom PDF/JSON reports with selected sections
- 🗺️ **Map Screenshot** - Capture map as image (placeholder for future enhancement)
- ⚙️ **Sidebar Settings** - Control sidebar auto-hide and pin behavior
- 🎚️ **5 Tabs Total** - Overview, Analytics, Heatmap, Logs, and Reports

---

## 🌟 Complete Feature List

### Core Features
- ✅ Real-time WebSocket monitoring
- ✅ GPS-based node tracking with Leaflet.js
- ✅ 6 live updating charts
- ✅ Emergency alerts with notifications
- ✅ Siren control via GPIO
- ✅ System event logging
- ✅ Data export functionality

### UI/UX Improvements
- 🌓 Dark mode toggle
- 📱 Fully responsive design
- ✨ Smooth animations & transitions
- 🎨 Modern gradient interface
- 🔍 Node search & filtering
- 📍 Map controls (center, refresh, screenshot)
- ⛓️ Color-coded status indicators

### Advanced Features
- 📊 Multi-metric analytics
- 🔥 Heatmap visualization
- 📝 System logs with filtering
- 📄 Report generation engine
- 💾 JSON export for all data
- 🔔 Browser push notifications
- 🎚️ Configurable settings
- ⛱️ Fullscreen mode

---

## 🚀 Installation

### Prerequisites
- Python 3.8+
- Raspberry Pi with UART enabled
- Heltec LoRa32 V3 modules

### Steps

1. **Extract ZIP**
   ```bash
   unzip lora_dashboard_final.zip
   cd lora_dashboard_final
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Serial Port**
   Edit `app.py` line 51-52:
   ```python
   SERIAL_PORT = '/dev/serial0'  # Your LoRa receiver port
   SERIAL_BAUDRATE = 115200
   ```

4. **Enable Raspberry Pi UART**
   ```bash
   sudo raspi-config
   # Interface Options → Serial Port
   # - Login shell: NO
   # - Serial hardware: YES
   sudo reboot
   ```

5. **Run Dashboard**
   ```bash
   python app.py
   ```
   Access at: **http://localhost:5000**

---

## 📱 UI/UX Guide

### Navigation
- **Hamburger Button** - Always visible in top-left navbar
- **Top Navbar** - Access settings, theme, export, fullscreen
- **Sidebar** - Shows stats, controls, nodes, alerts (collapsible on mobile)
- **Tabs** - Switch between Overview, Analytics, Heatmap, Logs, Report

### Hamburger Menu (FIXED!)
- **Desktop**: Sidebar always visible, hamburger button hidden
- **Mobile**: Sidebar slides in/out, overlay closes sidebar
- **Click anywhere on overlay** to close sidebar
- **Sidebar state saved** in localStorage

### Key Controls
- 🔊 **Siren**: Activate/deactivate in sidebar control panel
- 🌍 **Map**: Center, refresh, or capture screenshot
- 📊 **Charts**: Download as PNG or export data as JSON
- 📄 **Reports**: Generate customized reports with sections
- 🔍 **Search**: Find nodes quickly with search box
- ⚙️ **Settings**: Configure alert timeout, refresh rate, sidebar behavior

---

## 📊 New Report Generation Tab

### Report Types
1. **Summary Report** - Quick overview of all metrics
2. **Detailed Report** - Complete system analysis
3. **Emergency Events Only** - Historical emergency incidents

### Includable Sections
- Node Status - All active nodes with latest data
- Environmental Metrics - Temperature, humidity, IAQ, pressure stats
- Alert History - All emergency events and warnings
- Charts & Graphs - Historical chart data

### Time Periods
- Today - Last 24 hours
- Last 7 Days - Weekly summary
- Last 30 Days - Monthly report
- Custom Range - Specific date range (future)

**Click "Generate PDF Report"** to download as JSON (PDF in future versions)

---

## 🎨 Chart Download & Export

### Per-Chart Download
- Each chart has a **download button** (down arrow)
- Downloads chart as PNG image
- Filename includes date: `tempChart_2025-11-10.png`

### Bulk Export
- **Top navbar**: Click "export charts" button
- Exports all chart data as JSON
- Includes timestamps and all data points

---

## ⚙️ Settings (Fixed Sidebar Section)

### Map Configuration
- Zoom level (1-18)
- Auto-center on emergency

### Alerts
- Sound on/off
- Auto-acknowledge timeout

### Data Refresh
- Update interval in seconds

### Sidebar Behavior (NEW)
- Auto-hide on mobile
- Pin sidebar open (keep always visible)

---

## 🛠️ Troubleshooting

### Hamburger Menu Not Working
- Ensure you're on version with FIX
- Try refreshing page (Ctrl+F5)
- Check browser console for errors

### Sidebar Doesn't Close
- Click overlay (semi-transparent background)
- Or press hamburger button again
- On desktop, sidebar always visible

### Chart Data Not Updating
- Check WebSocket connection status
- Verify LoRa receiver is sending data
- Check browser console for errors

### Settings Not Saving
- Check browser localStorage is enabled
- Clear cache and try again
- Verify settings modal closes properly

---

## 📦 File Structure

```
lora_dashboard_final/
├── app.py                      # Flask backend
├── config.py                   # Configuration
├── requirements.txt            # Dependencies
├── esp32_lora_node.ino        # Arduino code
├── templates/
│   └── index.html             # Fixed HTML
└── static/
    ├── css/
    │   └── style.css          # Enhanced CSS
    └── js/
        └── dashboard.js       # Fixed JavaScript
```

---

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/nodes` | Get all nodes |
| GET | `/api/alerts` | Get unacknowledged alerts |
| POST | `/api/alerts/<id>/acknowledge` | Acknowledge alert |
| GET | `/api/history/<node_id>` | Historical data |
| POST | `/api/siren/control` | Control siren |

---

## 🔐 Security Features

- AES encryption ready (optional)
- CRC16 checksum validation
- Message acknowledgment protocol
- Frame counter for replay protection
- HTTPS recommended for production

---

## 📈 Performance Tips

1. Reduce chart max points (default: 50)
2. Increase refresh interval (default: 5s)
3. Use dark mode for better GPU efficiency
4. Close unused browser tabs
5. Enable hardware acceleration in browser

---

## 🐛 Known Issues & Future Improvements

### Currently Working
- ✅ Real-time monitoring
- ✅ Emergency alerts
- ✅ Data logging
- ✅ Report generation (JSON)
- ✅ Sidebar toggle (FIXED)

### Planned Features
- 🚧 PDF report export
- 🚧 Email notifications
- 🚧 Traffic layer integration
- 🚧 Marker clustering
- 🚧 Custom alert rules
- 🚧 User authentication
- 🚧 Mobile app
- 🚧 Cloud sync

---

## 📞 Support

For issues or questions, refer to:
1. This README
2. System logs (Logs tab)
3. Browser console (F12)
4. GitHub issues
5. Original research documentation

---

## 📄 License

MIT License - Free to use and modify

---

## ✅ Version History

### v2.0 (FINAL - Current)
- Fixed hamburger menu always visible
- Added chart download per-chart
- Added bulk chart data export
- Added report generation tab
- Improved mobile responsive sidebar
- Added sidebar settings
- Better error handling
- All UI/UX improvements

### v1.0 (Previous)
- Basic monitoring dashboard
- Charts, alerts, logs
- Map integration
- Siren control
- Dark mode

---

**Built for Highway Safety and Emergency Response**
