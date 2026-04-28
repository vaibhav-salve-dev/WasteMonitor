// API Configuration
const API_BASE_URL = window.location.origin || 'http://localhost:5000/';
const SOCKET_URL = API_BASE_URL;

// API Service
class APIService {
    constructor() {
        this.socket = null;
    }

    async fetch(endpoint, options = {}) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
        }
        
        return response.json();
    }

    // Dashboard endpoints
    async getDashboardSummary() {
        return this.fetch('/api/dashboard/summary');
    }

    async getRecentAlerts() {
        return this.fetch('/api/dashboard/alerts');
    }

    // Prediction endpoints
    async predict(data) {
        return this.fetch('/api/predictions/predict', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getRecentPredictions(limit = 50) {
        return this.fetch(`/api/predictions/recent?limit=${limit}`);
    }

    async getStats() {
        return this.fetch('/api/predictions/stats');
    }

    async getHourlyTrends() {
        return this.fetch('/api/predictions/trends/hourly');
    }

    // Data endpoints
    async getHistoricalData(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.fetch(`/api/data/historical?${params}`);
    }

    async exportCSV(filters = {}) {
        const params = new URLSearchParams(filters);
        window.open(`${API_BASE_URL}/api/data/export/csv?${params}`, '_blank');
    }

    async triggerRetrain(records) {
        return this.fetch('/api/data/retrain', {
            method: 'POST',
            body: JSON.stringify({ records })
        });
    }

    // Initialize WebSocket
    initSocket() {
        this.socket = io(SOCKET_URL);
        return this.socket;
    }
}

// Create global API instance
const api = new APIService();