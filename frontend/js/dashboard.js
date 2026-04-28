// Dashboard Controller
class DashboardController {
    constructor() {
        this.currentPage = 'dashboard';
        this.currentPageNum = 1;
        this.currentLimit = 20;
        this.socket = null;
        this.init();
    }

    async init() {
        await this.loadDashboard();
        this.initWebSocket();
        this.initEventListeners();
        this.startAutoRefresh();
    }

    async loadDashboard() {
        try {
            // Load stats
            const stats = await api.getStats();
            if (stats.success) {
                this.updateKPIs(stats.stats);
            }
            
            // Load trends
            const trends = await api.getHourlyTrends();
            if (trends.success) {
                const weightTrendCtx = document.getElementById('weightTrendChart').getContext('2d');
                chartManager.createWeightTrendChart(weightTrendCtx, trends.trends);
            }
            
            // Load dashboard summary
            const summary = await api.getDashboardSummary();
            if (summary.success) {
                const statusCtx = document.getElementById('statusChart').getContext('2d');
                chartManager.createStatusChart(statusCtx, summary.summary.current);
                
                const weekendCtx = document.getElementById('weekendChart').getContext('2d');
                chartManager.createWeekendChart(weekendCtx, summary.summary.weekendComparison);
                
                this.updateCriticalLocations(summary.summary.criticalLocations);
            }
            
            await this.loadAlerts();
            await this.loadHistory();
            
        } catch (error) {
            console.error('Dashboard load error:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    updateKPIs(stats) {
        document.getElementById('total-readings').textContent = stats.totalRecords || 0;
        document.getElementById('warning-count').textContent = stats.warningCount || 0;
        document.getElementById('overflow-count').textContent = stats.overflowCount || 0;
        document.getElementById('avg-weight').innerHTML = `${(stats.avgWeight || 0).toFixed(1)}<span>kg</span>`;
    }

    updateCriticalLocations(locations) {
        const container = document.getElementById('critical-locations-list');
        if (!locations || locations.length === 0) {
            container.innerHTML = '<div class="loading">No critical locations</div>';
            return;
        }
        
        container.innerHTML = locations.map(loc => `
            <div class="location-item">
                <span class="location-name">${loc._id}</span>
                <span class="location-count">${loc.count} alerts</span>
            </div>
        `).join('');
    }

    async loadAlerts() {
        try {
            const alerts = await api.getRecentAlerts();
            const container = document.getElementById('alerts-list');
            
            if (!alerts.success || alerts.alerts.length === 0) {
                container.innerHTML = '<div class="loading">No recent alerts</div>';
                return;
            }
            
            document.getElementById('notification-count').textContent = alerts.alerts.length;
            
            container.innerHTML = alerts.alerts.map(alert => `
                <div class="alert-item">
                    <div class="alert-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="alert-content">
                        <div class="alert-title">${alert.message}</div>
                        <div class="alert-time">${new Date(alert.timestamp).toLocaleString()}</div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Load alerts error:', error);
        }
    }

    async loadHistory() {
        try {
            const data = await api.getHistoricalData({
                page: this.currentPageNum,
                limit: this.currentLimit
            });
            
            if (data.success) {
                this.renderHistoryTable(data.records);
                this.renderPagination(data.pagination);
            }
        } catch (error) {
            console.error('Load history error:', error);
        }
    }

    renderHistoryTable(records) {
        const tbody = document.getElementById('history-tbody');
        
        if (!records || records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">No records found</td></tr>';
            return;
        }
        
        tbody.innerHTML = records.map(record => `
            <tr>
                <td>${new Date(record.timestamp).toLocaleString()}</td>
                <td>${record.hour}:00</td>
                <td>${record.weight_kg.toFixed(1)}</td>
                <td>${record.distance_cm.toFixed(1)}</td>
                <td>${record.is_weekend === 1 ? 'Yes' : 'No'}</td>
                <td><span class="status-badge ${this.getStatusClass(record.overflow_status)}">${this.getStatusText(record.overflow_status)}</span></td>
                <td>${record.prediction_confidence ? (record.prediction_confidence * 100).toFixed(1) + '%' : 'N/A'}</td>
            </tr>
        `).join('');
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!pagination || pagination.pages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = '';
        for (let i = 1; i <= Math.min(pagination.pages, 10); i++) {
            html += `<button class="${i === pagination.page ? 'active' : ''}" onclick="dashboardController.goToPage(${i})">${i}</button>`;
        }
        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPageNum = page;
        this.loadHistory();
    }

    async makePrediction() {
        const hour = parseInt(document.getElementById('pred-hour').value);
        const weight = parseFloat(document.getElementById('pred-weight').value);
        const distance = parseFloat(document.getElementById('pred-distance').value);
        const weekend = parseInt(document.getElementById('pred-weekend').value);
        
        if (isNaN(hour) || isNaN(weight) || isNaN(distance)) {
            this.showError('Please fill all fields');
            return;
        }
        
        const resultDiv = document.getElementById('prediction-result');
        resultDiv.classList.remove('hidden', 'normal', 'warning', 'overflow');
        
        try {
            const prediction = await api.predict({ hour, weight, distance, weekend });
            
            if (prediction.success) {
                const statusClass = this.getStatusClass(prediction.prediction);
                const statusText = this.getStatusText(prediction.prediction);
                const statusIcon = this.getStatusIcon(prediction.prediction);
                
                resultDiv.classList.add(statusClass);
                resultDiv.innerHTML = `
                    <div class="result-icon">${statusIcon}</div>
                    <div class="result-text">${statusText}</div>
                    <div class="result-confidence">Confidence: ${prediction.confidence ? (prediction.confidence * 100).toFixed(1) + '%' : 'N/A'}</div>
                    <div class="result-message">${prediction.message}</div>
                `;
            }
        } catch (error) {
            this.showError('Prediction failed: ' + error.message);
        }
    }

    async triggerRetrain() {
        try {
            // Get recent records for retraining
            const data = await api.getHistoricalData({ limit: 500 });
            
            if (data.success && data.records.length > 0) {
                const result = await api.triggerRetrain(data.records);
                this.showSuccess(result.message);
            } else {
                this.showError('Not enough data for retraining');
            }
        } catch (error) {
            this.showError('Retraining failed: ' + error.message);
        }
    }

    async refreshAnalytics() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const location = document.getElementById('location-filter').value;
        
        try {
            const filters = { limit: 1000 };
            if (startDate) filters.startDate = startDate;
            if (endDate) filters.endDate = endDate;
            if (location !== 'all') filters.location = location;
            
            const data = await api.getHistoricalData(filters);
            
            if (data.success && data.records.length > 0) {
                const analyticsCtx = document.getElementById('analyticsTrendChart').getContext('2d');
                chartManager.createAnalyticsTrendChart(analyticsCtx, data.records);
                
                const heatmapCtx = document.getElementById('heatmapChart').getContext('2d');
                chartManager.createHeatmapChart(heatmapCtx, data.records);
                
                this.updateStatsSummary(data.records);
            }
        } catch (error) {
            console.error('Refresh analytics error:', error);
        }
    }

    updateStatsSummary(records) {
        const weights = records.map(r => r.weight_kg);
        const distances = records.map(r => r.distance_cm);
        
        const summary = `
            <div class="stat-row">
                <span>Total Records:</span>
                <strong>${records.length}</strong>
            </div>
            <div class="stat-row">
                <span>Avg Weight:</span>
                <strong>${(weights.reduce((a,b) => a+b, 0) / weights.length).toFixed(1)} kg</strong>
            </div>
            <div class="stat-row">
                <span>Max Weight:</span>
                <strong>${Math.max(...weights).toFixed(1)} kg</strong>
            </div>
            <div class="stat-row">
                <span>Avg Distance:</span>
                <strong>${(distances.reduce((a,b) => a+b, 0) / distances.length).toFixed(1)} cm</strong>
            </div>
            <div class="stat-row">
                <span>Min Distance:</span>
                <strong>${Math.min(...distances).toFixed(1)} cm</strong>
            </div>
            <div class="stat-row">
                <span>Overflow Rate:</span>
                <strong>${(records.filter(r => r.overflow_status === 2).length / records.length * 100).toFixed(1)}%</strong>
            </div>
        `;
        
        document.getElementById('stats-summary').innerHTML = summary;
    }

    async exportData() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        const filters = {};
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        
        api.exportCSV(filters);
    }

    initWebSocket() {
        this.socket = api.initSocket();
        
        this.socket.on('connect', () => {
            console.log('WebSocket connected');
            this.socket.emit('subscribe', 'dashboard');
        });
        
        this.socket.on('readingUpdate', (data) => {
            this.updateRealTimeData(data);
        });
        
        this.socket.on('overflowAlert', (alert) => {
            this.showNotification('Overflow Alert!', alert.message);
            this.loadAlerts();
        });
    }

    updateRealTimeData(data) {
        document.getElementById('sensor-weight').innerHTML = `${data.weight.toFixed(1)}<span>kg</span>`;
        document.getElementById('sensor-distance').innerHTML = `${data.distance.toFixed(1)}<span>cm</span>`;
        document.getElementById('sensor-time').textContent = new Date(data.timestamp).toLocaleTimeString();
        
        const weightPercent = Math.min((data.weight / 60) * 100, 100);
        const distancePercent = Math.min(((100 - data.distance) / 100) * 100, 100);
        
        document.getElementById('weight-progress').style.width = `${weightPercent}%`;
        document.getElementById('distance-progress').style.width = `${distancePercent}%`;
        
        const statusClass = this.getStatusClass(data.overflow_status);
        const statusText = this.getStatusText(data.overflow_status);
        
        const statusEl = document.getElementById('sensor-status');
        statusEl.textContent = statusText;
        statusEl.className = `status-badge ${statusClass}`;
    }

    initEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.switchPage(page);
                
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });
        
        // Prediction form
        document.getElementById('prediction-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.makePrediction();
        });
        
        // Search
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            this.searchRecords(e.target.value);
        });
        
        // Limit change
        document.getElementById('records-limit')?.addEventListener('change', (e) => {
            this.currentLimit = parseInt(e.target.value);
            this.currentPageNum = 1;
            this.loadHistory();
        });
        
        // Auto-refresh toggle
        document.getElementById('auto-refresh')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
    }

    async searchRecords(query) {
        if (!query) {
            this.loadHistory();
            return;
        }
        
        try {
            const data = await api.getHistoricalData({ limit: 100 });
            if (data.success) {
                const filtered = data.records.filter(r => 
                    r.location.toLowerCase().includes(query.toLowerCase()) ||
                    r.device_id.toLowerCase().includes(query.toLowerCase())
                );
                this.renderHistoryTable(filtered);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }

  switchPage(page) {
    this.currentPage = page;
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}-page`).classList.add('active');
    
    const titles = {
        dashboard: 'Dashboard',
        'real-time': 'Real-Time Monitoring',
        analytics: 'Analytics',
        predictions: 'Predictions',
        history: 'History',
        'route-optimization': 'Route Optimizer',  // Add this
        settings: 'Settings'
    };
    
    document.getElementById('page-title').textContent = titles[page] || 'Dashboard';
    
    // Load page-specific data
    if (page === 'analytics') {
        this.refreshAnalytics();
    } else if (page === 'real-time') {
        this.updateRealTimeData({
            weight: Math.random() * 60,
            distance: Math.random() * 100,
            overflow_status: Math.floor(Math.random() * 3),
            timestamp: new Date()
        });
    } else if (page === 'route-optimization') {
        // Refresh canvas if needed
        setTimeout(() => {
            if (routeOptimizer) routeOptimizer.drawRoute();
        }, 100);
    }
}

    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            if (this.currentPage === 'dashboard') {
                this.loadDashboard();
            }
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    getStatusClass(status) {
        switch(status) {
            case 0: return 'normal';
            case 1: return 'warning';
            case 2: return 'overflow';
            default: return 'normal';
        }
    }

    getStatusText(status) {
        switch(status) {
            case 0: return 'Normal';
            case 1: return 'Warning';
            case 2: return 'Overflow';
            default: return 'Unknown';
        }
    }

    getStatusIcon(status) {
        switch(status) {
            case 0: return '✅';
            case 1: return '⚠️';
            case 2: return '🔴';
            default: return '❓';
        }
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showNotification(title, message) {
        if (Notification.permission === 'granted') {
            new Notification(title, { body: message });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
        this.showToast(message, 'warning');
    }

    showToast(message, type) {
        // Simple toast implementation
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#00b894' : '#fdcb6e'};
            color: white;
            border-radius: 8px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Global refresh functions
function refreshAlerts() {
    dashboardController.loadAlerts();
}

function refreshAnalytics() {
    dashboardController.refreshAnalytics();
}

function exportData() {
    dashboardController.exportData();
}

function triggerRetrain() {
    dashboardController.triggerRetrain();
}

// Initialize dashboard
const dashboardController = new DashboardController();


// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    .hidden { display: none; }
`;
document.head.appendChild(style);