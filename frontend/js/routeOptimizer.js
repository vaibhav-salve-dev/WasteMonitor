// Route Optimization Controller
class RouteOptimizerController {
    constructor() {
        this.bins = [];
        this.optimizedRoute = null;
        this.predictions = [];
        this.simulationInterval = null;
        this.currentStep = 0;
        this.canvas = null;
        this.ctx = null;
        this.coordinates = null;
        this.animationFrame = null;
        
        this.init();
    }
    
    async init() {
        await this.loadCoordinates();
        this.initCanvas();
    }
    
    async loadCoordinates() {
        try {
            const response = await api.fetch('/api/optimization/bin-coordinates');
            if (response.success) {
                this.coordinates = response.coordinates;
            }
        } catch (error) {
            console.error('Error loading coordinates:', error);
            // Use default coordinates
            this.coordinates = {
                'Depot': { x: 50, y: 50, name: 'Depot' },
                'Bin1': { x: 20, y: 30, name: 'Bin 1' },
                'Bin2': { x: 35, y: 65, name: 'Bin 2' },
                'Bin3': { x: 60, y: 25, name: 'Bin 3' },
                'Bin4': { x: 75, y: 55, name: 'Bin 4' },
                'Bin5': { x: 85, y: 80, name: 'Bin 5' }
            };
        }
    }
    
    initCanvas() {
        this.canvas = document.getElementById('routeCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
        }
    }
    
    resizeCanvas() {
        if (this.canvas) {
            const container = this.canvas.parentElement;
            const size = Math.min(container.clientWidth, 500);
            this.canvas.width = size;
            this.canvas.height = size;
            this.drawRoute();
        }
    }
    
    generateBinInputs() {
        const numBins = parseInt(document.getElementById('num-bins').value);
        
        if (isNaN(numBins) || numBins < 1 || numBins > 10) {
            alert('Please enter a number between 1 and 10');
            return;
        }
        
        const container = document.getElementById('bin-inputs-container');
        container.innerHTML = '';
        
        this.bins = [];
        
        for (let i = 0; i < numBins; i++) {
            const binId = `Bin${i + 1}`;
            this.bins.push({
                id: binId,
                name: `Bin ${i + 1}`,
                weight: (Math.random() * 50 + 5).toFixed(1),
                distance: (Math.random() * 90 + 5).toFixed(1),
                hour: new Date().getHours(),
                is_weekend: [0, 6].includes(new Date().getDay()) ? 1 : 0
            });
            
            const binCard = document.createElement('div');
            binCard.className = 'bin-card';
            binCard.innerHTML = `
                <div class="bin-header">
                    <h4>${binId}</h4>
                    <span class="status-badge pending">Pending Analysis</span>
                </div>
                <div class="bin-input-group">
                    <input type="number" id="weight-${binId}" placeholder="Weight (kg)" value="${this.bins[i].weight}" step="0.1">
                    <input type="number" id="distance-${binId}" placeholder="Distance (cm)" value="${this.bins[i].distance}" step="0.1">
                </div>
                <div id="prediction-${binId}" class="prediction-result-preview"></div>
            `;
            container.appendChild(binCard);
        }
        
        document.getElementById('analyze-btn').disabled = false;
        document.getElementById('predictions-summary').innerHTML = '';
        document.getElementById('route-display').style.display = 'none';
    }
    
    async analyzeBins() {
        // Collect bin data
        const binsData = [];
        for (let i = 0; i < this.bins.length; i++) {
            const binId = this.bins[i].id;
            const weight = parseFloat(document.getElementById(`weight-${binId}`).value);
            const distance = parseFloat(document.getElementById(`distance-${binId}`).value);
            
            if (isNaN(weight) || isNaN(distance)) {
                alert(`Please enter valid values for ${binId}`);
                return;
            }
            
            binsData.push({
                id: binId,
                name: this.bins[i].name,
                weight: weight,
                distance: distance,
                hour: new Date().getHours(),
                is_weekend: [0, 6].includes(new Date().getDay()) ? 1 : 0
            });
        }
        
        // Show loading state
        document.getElementById('analyze-btn').disabled = true;
        document.getElementById('analyze-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        
        try {
            // Get ML predictions for all bins
            const predictionResponse = await api.fetch('/api/optimization/batch-predict', {
                method: 'POST',
                body: JSON.stringify({ bins: binsData })
            });
            
            if (predictionResponse.success) {
                this.predictions = predictionResponse.predictions;
                this.updateBinPredictions();
                this.displayPredictionsSummary();
                
                // Get optimized route
                const routeResponse = await api.fetch('/api/optimization/optimize-route', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        bins: this.predictions,
                        startPoint: 'Depot',
                        endPoint: 'Depot'
                    })
                });
                
                if (routeResponse.success) {
                    this.optimizedRoute = routeResponse.optimization;
                    this.displayRoute();
                    this.drawRoute();
                    
                    // Show vehicle simulation
                    document.getElementById('vehicle-simulation').style.display = 'block';
                    document.getElementById('algorithm-badge').innerHTML = 
                        `Algorithm: ${this.optimizedRoute.algorithm === 'permutation' ? 'Dijkstra (Optimal)' : 'Nearest Neighbor + Urgency'}`;
                }
            }
            
        } catch (error) {
            console.error('Analysis error:', error);
            alert('Error analyzing bins: ' + error.message);
        } finally {
            document.getElementById('analyze-btn').disabled = false;
            document.getElementById('analyze-btn').innerHTML = '<i class="fas fa-chart-line"></i> Analyze & Optimize';
        }
    }
    
    updateBinPredictions() {
        for (const prediction of this.predictions) {
            const binCard = document.querySelector(`.bin-card:has(#weight-${prediction.id})`);
            if (binCard) {
                binCard.classList.remove('critical', 'warning');
                if (prediction.overflowStatus === 2) binCard.classList.add('critical');
                else if (prediction.overflowStatus === 1) binCard.classList.add('warning');
                
                const header = binCard.querySelector('.bin-header');
                const statusSpan = header.querySelector('.status-badge');
                statusSpan.className = `status-badge prediction-${prediction.statusText.toLowerCase()}`;
                statusSpan.innerHTML = `${prediction.statusText} (${(prediction.confidence * 100).toFixed(0)}%)`;
                
                const previewDiv = document.getElementById(`prediction-${prediction.id}`);
                previewDiv.innerHTML = `
                    <div class="prediction-badge prediction-${prediction.statusText.toLowerCase()}">
                        <i class="fas fa-chart-line"></i> Urgency: ${prediction.urgencyScore.toFixed(0)}%
                    </div>
                `;
            }
        }
    }
    
    displayPredictionsSummary() {
        const summary = document.getElementById('predictions-summary');
        const critical = this.predictions.filter(p => p.overflowStatus === 2).length;
        const warning = this.predictions.filter(p => p.overflowStatus === 1).length;
        const normal = this.predictions.filter(p => p.overflowStatus === 0).length;
        const avgUrgency = this.predictions.reduce((sum, p) => sum + p.urgencyScore, 0) / this.predictions.length;
        
        summary.innerHTML = `
            <h4>ML Predictions Summary</h4>
            <div class="urgency-summary">
                <div class="urgency-stat">
                    <div class="label">Critical</div>
                    <div class="value" style="color: var(--danger)">${critical}</div>
                </div>
                <div class="urgency-stat">
                    <div class="label">Warning</div>
                    <div class="value" style="color: var(--warning)">${warning}</div>
                </div>
                <div class="urgency-stat">
                    <div class="label">Normal</div>
                    <div class="value" style="color: var(--success)">${normal}</div>
                </div>
                <div class="urgency-stat">
                    <div class="label">Avg Urgency</div>
                    <div class="value">${avgUrgency.toFixed(0)}%</div>
                </div>
            </div>
        `;
    }
    
    displayRoute() {
        const routeDisplay = document.getElementById('route-display');
        routeDisplay.style.display = 'block';
        
        const routeDetails = document.getElementById('route-details');
        routeDetails.innerHTML = `
            <h4>Optimized Collection Route</h4>
            <div class="route-stats">
                <div class="stat">
                    <i class="fas fa-road"></i>
                    <span>Total Distance: <strong>${this.optimizedRoute.totalDistance || 'Calculating...'} km</strong></span>
                </div>
                <div class="stat">
                    <i class="fas fa-clock"></i>
                    <span>Est. Time: <strong>${this.optimizedRoute.estimatedTime} minutes</strong></span>
                </div>
                <div class="stat">
                    <i class="fas fa-trash-alt"></i>
                    <span>Stops: <strong>${this.optimizedRoute.numberOfStops}</strong></span>
                </div>
            </div>
            <div class="route-steps">
                ${this.optimizedRoute.route.map((stop, index) => `
                    <div class="route-step" data-step="${index}">
                        <div class="route-step-number">${index + 1}</div>
                        <div class="route-step-name">${stop}</div>
                        ${index < this.optimizedRoute.route.length - 1 ? 
                            `<div class="route-step-distance">→ ${this.getDistance(stop, this.optimizedRoute.route[index + 1]) || '?'} km</div>` : 
                            '<div class="route-step-distance">✓ Complete</div>'}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    getDistance(from, to) {
        if (this.coordinates && this.coordinates[from] && this.coordinates[to]) {
            const dx = this.coordinates[from].x - this.coordinates[to].x;
            const dy = this.coordinates[from].y - this.coordinates[to].y;
            return Math.sqrt(dx * dx + dy * dy).toFixed(1);
        }
        return null;
    }
    
    drawRoute() {
        if (!this.ctx || !this.coordinates || !this.optimizedRoute) return;
        
        const canvas = this.canvas;
        const ctx = this.ctx;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw background grid
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath();
            ctx.moveTo(i * width / 4, 0);
            ctx.lineTo(i * width / 4, height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * height / 4);
            ctx.lineTo(width, i * height / 4);
            ctx.stroke();
        }
        
        // Draw connections (optimized route)
        if (this.optimizedRoute.route) {
            ctx.beginPath();
            ctx.strokeStyle = '#2D9CDB';
            ctx.lineWidth = 3;
            
            for (let i = 0; i < this.optimizedRoute.route.length - 1; i++) {
                const from = this.optimizedRoute.route[i];
                const to = this.optimizedRoute.route[i + 1];
                
                if (this.coordinates[from] && this.coordinates[to]) {
                    const fromX = (this.coordinates[from].x / 100) * width;
                    const fromY = (this.coordinates[from].y / 100) * height;
                    const toX = (this.coordinates[to].x / 100) * width;
                    const toY = (this.coordinates[to].y / 100) * height;
                    
                    ctx.beginPath();
                    ctx.moveTo(fromX, fromY);
                    ctx.lineTo(toX, toY);
                    ctx.stroke();
                    
                    // Draw arrow
                    const angle = Math.atan2(toY - fromY, toX - fromX);
                    const arrowSize = 8;
                    const arrowX = toX - 15 * Math.cos(angle);
                    const arrowY = toY - 15 * Math.sin(angle);
                    
                    ctx.fillStyle = '#2D9CDB';
                    ctx.beginPath();
                    ctx.moveTo(arrowX, arrowY);
                    ctx.lineTo(arrowX - arrowSize * Math.cos(angle - Math.PI / 6), arrowY - arrowSize * Math.sin(angle - Math.PI / 6));
                    ctx.lineTo(arrowX - arrowSize * Math.cos(angle + Math.PI / 6), arrowY - arrowSize * Math.sin(angle + Math.PI / 6));
                    ctx.fill();
                }
            }
        }
        
        // Draw all points
        for (const [id, coord] of Object.entries(this.coordinates)) {
            const x = (coord.x / 100) * width;
            const y = (coord.y / 100) * height;
            
            // Find bin prediction if exists
            const binPrediction = this.predictions?.find(p => p.id === id);
            
            // Set color based on urgency
            let color = '#2D9CDB';
            let radius = 8;
            if (binPrediction) {
                if (binPrediction.overflowStatus === 2) {
                    color = '#e74c3c';
                    radius = 12;
                } else if (binPrediction.overflowStatus === 1) {
                    color = '#fdcb6e';
                    radius = 10;
                }
            }
            
            // Draw circle
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw label
            ctx.fillStyle = '#333';
            ctx.font = '12px Inter';
            ctx.fillText(id, x - 15, y - 12);
            
            // Draw urgency percentage for bins
            if (binPrediction && binPrediction.urgencyScore > 0) {
                ctx.fillStyle = '#666';
                ctx.font = '10px Inter';
                ctx.fillText(`${binPrediction.urgencyScore.toFixed(0)}%`, x - 12, y + 18);
            }
        }
    }
    
    startSimulation() {
        if (this.simulationInterval) this.stopSimulation();
        
        this.currentStep = 0;
        const route = this.optimizedRoute.route;
        
        this.simulationInterval = setInterval(() => {
            if (this.currentStep < route.length - 1) {
                this.currentStep++;
                this.updateSimulation(route[this.currentStep], this.currentStep);
                
                // Highlight current step in route display
                document.querySelectorAll('.route-step').forEach((step, idx) => {
                    if (idx === this.currentStep) {
                        step.classList.add('active');
                    } else {
                        step.classList.remove('active');
                    }
                });
            } else {
                this.stopSimulation();
                alert('Collection route completed! All bins have been serviced.');
            }
        }, 2000);
    }
    
    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
    }
    
    resetSimulation() {
        this.stopSimulation();
        this.currentStep = 0;
        this.updateSimulation('Depot', 0);
        document.querySelectorAll('.route-step').forEach(step => step.classList.remove('active'));
    }
    
    updateSimulation(location, step) {
        document.getElementById('current-location').textContent = location;
        
        const route = this.optimizedRoute.route;
        if (step < route.length - 1) {
            document.getElementById('next-stop').textContent = route[step + 1];
        } else {
            document.getElementById('next-stop').textContent = 'Complete';
        }
        
        // Calculate distance traveled
        let distanceTraveled = 0;
        for (let i = 0; i < step; i++) {
            const from = route[i];
            const to = route[i + 1];
            const dist = this.getDistance(from, to);
            if (dist) distanceTraveled += parseFloat(dist);
        }
        document.getElementById('distance-traveled').textContent = `${distanceTraveled.toFixed(1)} km`;
        document.getElementById('bins-collected').textContent = step;
        
        // Highlight current location on canvas
        this.drawRoute();
        
        if (this.coordinates[location]) {
            const canvas = this.canvas;
            const ctx = this.ctx;
            const width = canvas.width;
            const height = canvas.height;
            const x = (this.coordinates[location].x / 100) * width;
            const y = (this.coordinates[location].y / 100) * height;
            
            // Draw pulsing effect
            ctx.beginPath();
            ctx.arc(x, y, 18, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(45, 156, 219, 0.2)';
            ctx.fill();
        }
    }
}

// Initialize route optimizer when page loads
let routeOptimizer;

// Add to page navigation
document.addEventListener('DOMContentLoaded', () => {
    routeOptimizer = new RouteOptimizerController();
});

// Global functions for HTML buttons
function generateBinInputs() {
    routeOptimizer.generateBinInputs();
}

function analyzeBins() {
    routeOptimizer.analyzeBins();
}

function resetBins() {
    document.getElementById('bin-inputs-container').innerHTML = '';
    document.getElementById('predictions-summary').innerHTML = '';
    document.getElementById('route-display').style.display = 'none';
    document.getElementById('vehicle-simulation').style.display = 'none';
    document.getElementById('analyze-btn').disabled = true;
}

function startSimulation() {
    routeOptimizer.startSimulation();
}

function stopSimulation() {
    routeOptimizer.stopSimulation();
}

function resetSimulation() {
    routeOptimizer.resetSimulation();
}