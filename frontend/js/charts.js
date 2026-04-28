// Chart Manager
class ChartManager {
    constructor() {
        this.charts = {};
    }

    createWeightTrendChart(ctx, data) {
        if (this.charts.weightTrend) {
            this.charts.weightTrend.destroy();
        }
        
        this.charts.weightTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => `${d._id}:00`),
                datasets: [
                    {
                        label: 'Average Weight (kg)',
                        data: data.map(d => d.avgWeight),
                        borderColor: '#2D9CDB',
                        backgroundColor: 'rgba(45, 156, 219, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Max Weight (kg)',
                        data: data.map(d => d.maxWeight),
                        borderColor: '#fdcb6e',
                        backgroundColor: 'rgba(253, 203, 110, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Weight (kg)' } },
                    x: { title: { display: true, text: 'Hour of Day' } }
                }
            }
        });
    }

    createStatusChart(ctx, data) {
        if (this.charts.status) {
            this.charts.status.destroy();
        }
        
        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Normal', 'Warning', 'Overflow'],
                datasets: [{
                    data: [data.normal || 0, data.warning || 0, data.overflow || 0],
                    backgroundColor: ['#00b894', '#fdcb6e', '#e74c3c'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    createWeekendChart(ctx, data) {
        if (this.charts.weekend) {
            this.charts.weekend.destroy();
        }
        
        this.charts.weekend = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Weekday', 'Weekend'],
                datasets: [
                    {
                        label: 'Average Weight (kg)',
                        data: [data.weekday?.avgWeight || 0, data.weekend?.avgWeight || 0],
                        backgroundColor: '#2D9CDB'
                    },
                    {
                        label: 'Overflow Rate (%)',
                        data: [
                            (data.weekday?.overflowRate || 0) * 100,
                            (data.weekend?.overflowRate || 0) * 100
                        ],
                        backgroundColor: '#e74c3c'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                let value = context.raw;
                                if (context.dataset.label.includes('Rate')) {
                                    return `${label}: ${value.toFixed(1)}%`;
                                }
                                return `${label}: ${value.toFixed(1)} kg`;
                            }
                        }
                    }
                }
            }
        });
    }

    createAnalyticsTrendChart(ctx, data) {
        if (this.charts.analyticsTrend) {
            this.charts.analyticsTrend.destroy();
        }
        
        this.charts.analyticsTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => new Date(d.timestamp).toLocaleDateString()),
                datasets: [
                    {
                        label: 'Weight Trend',
                        data: data.map(d => d.weight_kg),
                        borderColor: '#2D9CDB',
                        backgroundColor: 'rgba(45, 156, 219, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Distance Trend',
                        data: data.map(d => d.distance_cm),
                        borderColor: '#00b894',
                        backgroundColor: 'rgba(0, 184, 148, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}` } }
                }
            }
        });
    }

    createHeatmapChart(ctx, data) {
        // This would be a proper heatmap in production
        // For now, create a scatter plot
        if (this.charts.heatmap) {
            this.charts.heatmap.destroy();
        }
        
        this.charts.heatmap = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Normal',
                        data: data.filter(d => d.overflow_status === 0).map(d => ({ x: d.weight_kg, y: d.distance_cm })),
                        backgroundColor: 'rgba(0, 184, 148, 0.6)'
                    },
                    {
                        label: 'Warning',
                        data: data.filter(d => d.overflow_status === 1).map(d => ({ x: d.weight_kg, y: d.distance_cm })),
                        backgroundColor: 'rgba(253, 203, 110, 0.6)'
                    },
                    {
                        label: 'Overflow',
                        data: data.filter(d => d.overflow_status === 2).map(d => ({ x: d.weight_kg, y: d.distance_cm })),
                        backgroundColor: 'rgba(231, 76, 60, 0.6)'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: 'Weight (kg)' } },
                    y: { title: { display: true, text: 'Distance (cm)' }, reversed: true }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `Weight: ${ctx.raw.x.toFixed(1)}kg, Distance: ${ctx.raw.y.toFixed(1)}cm`
                        }
                    }
                }
            }
        });
    }
}

// Create global chart manager
const chartManager = new ChartManager();