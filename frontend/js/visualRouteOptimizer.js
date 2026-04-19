// Complete updated VisualRouteOptimizer class
class VisualRouteOptimizer {
    constructor() {
        this.bins = [];
        this.predictions = [];
        this.optimizedRoute = null;
        this.coordinates = null;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.currentStep = 0;
        this.animationProgress = 0;
        this.isAnimating = false;
        this.vehicleX = 0;
        this.vehicleY = 0;
        this.currentFrom = null;
        this.currentTo = null;
        this.collectedBins = new Set();
        this.startTime = null;
        this.timerInterval = null;
        
        // Zoom properties
        this.zoomLevel = 1;
        this.minZoom = 0.5;
        this.maxZoom = 2.5;
        
        // Dynamic coordinates storage
        this.dynamicCoordinates = {};
        
        this.init();
    }

    async init() {
        // Don't load fixed coordinates - we'll generate dynamically
        this.initCanvas();
        this.setupEventListeners();
        this.setupPanning();
    }

    initCanvas() {
        this.canvas = document.getElementById('visualMapCanvas');
        if (this.canvas) {
            this.canvas.width = 800;
            this.canvas.height = 650;
            this.ctx = this.canvas.getContext('2d');
            this.setupCanvasEvents();
            this.drawEmptyMap();
        }
    }

    drawEmptyMap() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Draw background grid
        ctx.strokeStyle = '#cbd5e0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 8; i++) {
            ctx.beginPath();
            ctx.moveTo(i * width / 8, 0);
            ctx.lineTo(i * width / 8, height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * height / 8);
            ctx.lineTo(width, i * height / 8);
            ctx.stroke();
        }
        
        // Draw Depot at fixed position
        const depotX = width * 0.5;
        const depotY = height * 0.85;
        
        ctx.beginPath();
        ctx.arc(depotX, depotY, 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#2d3436';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Inter';
        ctx.fillText('🏠 Depot', depotX - 30, depotY - 15);
        
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 12px Inter';
        ctx.fillText('Starting Point', depotX - 35, depotY + 30);
        
        // Draw instruction text
        ctx.fillStyle = '#999';
        ctx.font = '14px Inter';
        ctx.fillText('Enter number of bins and click "Analyze & Optimize Route"', width/2 - 200, height - 20);
    }

    generateDynamicCoordinates(numBins) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const coordinates = {};
        
        // Depot at bottom center
        coordinates['Depot'] = {
            x: 50,
            y: 85,
            name: 'Waste Management Depot',
            address: 'Central Location',
            type: 'depot'
        };
        
        // Generate positions in a circular/spiral pattern
        const centerX = 50;
        const centerY = 50;
        const maxRadius = 40;
        
        for (let i = 0; i < numBins; i++) {
            const angle = (i / numBins) * 2 * Math.PI;
            const radius = maxRadius * (0.5 + (i / numBins) * 0.5);
            
            // Add some randomness for natural look
            const xOffset = (Math.random() - 0.5) * 15;
            const yOffset = (Math.random() - 0.5) * 15;
            
            let x = centerX + radius * Math.cos(angle) + xOffset;
            let y = centerY + radius * Math.sin(angle) + yOffset;
            
            // Ensure bins are within bounds
            x = Math.min(Math.max(x, 10), 90);
            y = Math.min(Math.max(y, 10), 80);
            
            const binId = `Bin${i + 1}`;
            coordinates[binId] = {
                x: x,
                y: y,
                name: `${binId} - ${this.getRandomLocationName(i)}`,
                address: this.getRandomAddress(i),
                type: 'bin'
            };
        }
        
        return coordinates;
    }

    getRandomLocationName(index) {
        const locations = [
            'Downtown', 'Residential Area', 'Shopping Mall', 'Business Park',
            'School Zone', 'Hospital District', 'Park Area', 'Industrial Zone',
            'Market Square', 'Community Center', 'Sports Complex', 'Library',
            'Train Station', 'Bus Terminal', 'University Campus'
        ];
        return locations[index % locations.length];
    }

    getRandomAddress(index) {
        const streets = [
            'Main Street', 'Oak Avenue', 'Maple Road', 'Pine Lane',
            'Cedar Drive', 'Elm Street', 'Washington Blvd', 'Park Avenue',
            'Lake Shore Drive', 'River Road', 'Hill Street', 'Valley View'
        ];
        const numbers = ['100', '250', '450', '680', '920', '150', '320', '570', '830'];
        return `${numbers[index % numbers.length]} ${streets[index % streets.length]}`;
    }

    setupCanvasEvents() {
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
        this.canvas.addEventListener('mouseleave', () => this.hideTooltip());
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }

    setupEventListeners() {
        const speedSlider = document.getElementById('sim-speed');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const speedLabel = document.getElementById('speed-label');
                speedLabel.textContent = `${e.target.value}x`;
            });
        }
    }

    setupPanning() {
        let isPanning = false;
        let startX, startY;
        let scrollLeft, scrollTop;
        
        const container = this.canvas.parentElement;
        
        container.addEventListener('mousedown', (e) => {
            if (this.zoomLevel > 1) {
                isPanning = true;
                startX = e.pageX - container.offsetLeft;
                startY = e.pageY - container.offsetTop;
                scrollLeft = container.scrollLeft;
                scrollTop = container.scrollTop;
                container.style.cursor = 'grabbing';
            }
        });
        
        container.addEventListener('mouseup', () => {
            isPanning = false;
            if (this.zoomLevel > 1) {
                container.style.cursor = 'grab';
            }
        });
        
        container.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const y = e.pageY - container.offsetTop;
            const walkX = (x - startX) * 1.5;
            const walkY = (y - startY) * 1.5;
            container.scrollLeft = scrollLeft - walkX;
            container.scrollTop = scrollTop - walkY;
        });
    }

    handleCanvasHover(e) {
        if (!this.coordinates) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        for (const [id, coord] of Object.entries(this.coordinates)) {
            const x = (coord.x / 100) * this.canvas.width;
            const y = (coord.y / 100) * this.canvas.height;
            const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
            
            if (distance < 25) {
                this.showBinTooltip(id, e.clientX, e.clientY);
                return;
            }
        }
        this.hideTooltip();
    }

    handleCanvasClick(e) {
        if (!this.coordinates) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        for (const [id, coord] of Object.entries(this.coordinates)) {
            const x = (coord.x / 100) * this.canvas.width;
            const y = (coord.y / 100) * this.canvas.height;
            const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
            
            if (distance < 25) {
                this.showBinDetailPanel(id);
                break;
            }
        }
    }

    showBinTooltip(binId, mouseX, mouseY) {
        let tooltip = document.getElementById('map-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'map-tooltip';
            tooltip.className = 'bin-tooltip';
            document.body.appendChild(tooltip);
        }
        
        const bin = this.coordinates[binId];
        const prediction = this.predictions?.find(p => p.id === binId);
        
        let urgencyColor = '#00b894';
        let urgencyText = 'Normal';
        if (prediction) {
            if (prediction.overflowStatus === 2) {
                urgencyColor = '#e74c3c';
                urgencyText = 'CRITICAL';
            } else if (prediction.overflowStatus === 1) {
                urgencyColor = '#fdcb6e';
                urgencyText = 'WARNING';
            }
        }
        
        tooltip.innerHTML = `
            <h4>${bin.name}</h4>
            <div class="tooltip-row">
                <span class="tooltip-label">Status:</span>
                <span class="tooltip-value" style="color: ${urgencyColor}; font-weight: bold;">${urgencyText}</span>
            </div>
            ${prediction ? `
                <div class="tooltip-row">
                    <span class="tooltip-label">Weight:</span>
                    <span class="tooltip-value">${prediction.weight} kg</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Distance:</span>
                    <span class="tooltip-value">${prediction.distance} cm</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Confidence:</span>
                    <span class="tooltip-value">${(prediction.confidence * 100).toFixed(0)}%</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Urgency Score:</span>
                    <span class="tooltip-value">${prediction.urgencyScore.toFixed(0)}%</span>
                </div>
                <div class="urgency-gauge">
                    <div class="urgency-fill" style="width: ${prediction.urgencyScore}%; background: ${urgencyColor};"></div>
                </div>
            ` : `
                <div class="tooltip-row">
                    <span class="tooltip-label">Address:</span>
                    <span class="tooltip-value">${bin.address || 'Not specified'}</span>
                </div>
            `}
            <div class="tooltip-row">
                <span class="tooltip-label">Collection Status:</span>
                <span class="tooltip-value">${this.collectedBins.has(binId) ? '✓ Collected' : 'Pending'}</span>
            </div>
        `;
        
        tooltip.style.left = `${mouseX + 15}px`;
        tooltip.style.top = `${mouseY - 50}px`;
        tooltip.style.display = 'block';
    }

    hideTooltip() {
        const tooltip = document.getElementById('map-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    showBinDetailPanel(binId) {
        const panel = document.getElementById('binDetailPanel');
        const bin = this.coordinates[binId];
        const prediction = this.predictions?.find(p => p.id === binId);
        
        let statusColor = '#00b894';
        let statusText = 'Normal';
        if (prediction) {
            if (prediction.overflowStatus === 2) {
                statusColor = '#e74c3c';
                statusText = 'CRITICAL - Immediate Collection Needed';
            } else if (prediction.overflowStatus === 1) {
                statusColor = '#fdcb6e';
                statusText = 'WARNING - Schedule Soon';
            }
        }
        
        document.getElementById('detail-bin-name').textContent = bin.name;
        document.getElementById('detail-content').innerHTML = `
            <div class="tooltip-row">
                <span class="tooltip-label">Status:</span>
                <span class="tooltip-value" style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Address:</span>
                <span class="tooltip-value">${bin.address || 'Not specified'}</span>
            </div>
            ${prediction ? `
                <div class="tooltip-row">
                    <span class="tooltip-label">Weight:</span>
                    <span class="tooltip-value">${prediction.weight} kg</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Fill Level:</span>
                    <span class="tooltip-value">${(100 - prediction.distance).toFixed(0)}%</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">ML Confidence:</span>
                    <span class="tooltip-value">${(prediction.confidence * 100).toFixed(0)}%</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Urgency Score:</span>
                    <span class="tooltip-value">${prediction.urgencyScore.toFixed(0)}%</span>
                </div>
                <div class="urgency-gauge" style="margin-top: 10px;">
                    <div class="urgency-fill" style="width: ${prediction.urgencyScore}%; background: ${statusColor};"></div>
                </div>
                <div class="tooltip-row" style="margin-top: 10px;">
                    <span class="tooltip-label">Prediction:</span>
                    <span class="tooltip-value">${prediction.message || 'Analysis complete'}</span>
                </div>
            ` : '<div class="tooltip-row">No prediction data available</div>'}
        `;
        
        panel.classList.add('show');
        
        setTimeout(() => {
            if (panel.classList.contains('show')) {
                panel.classList.remove('show');
            }
        }, 8000);
    }

    closeBinDetail() {
        document.getElementById('binDetailPanel').classList.remove('show');
    }

    generateBinInputs() {
        const numBins = parseInt(document.getElementById('num-bins').value);
        
        if (isNaN(numBins) || numBins < 1 || numBins > 8) {
            alert('Please enter a number between 1 and 8');
            return;
        }
        
        const container = document.getElementById('bin-inputs-container');
        container.innerHTML = '';
        
        this.bins = [];
        
        // Generate dynamic coordinates based on number of bins
        this.coordinates = this.generateDynamicCoordinates(numBins);
        
        for (let i = 0; i < numBins; i++) {
            const binId = `Bin${i + 1}`;
            this.bins.push({
                id: binId,
                name: this.coordinates[binId]?.name || `Bin ${i + 1}`,
                weight: (Math.random() * 50 + 5).toFixed(1),
                distance: (Math.random() * 90 + 5).toFixed(1),
                hour: new Date().getHours(),
                is_weekend: [0, 6].includes(new Date().getDay()) ? 1 : 0
            });
            
            const binCard = document.createElement('div');
            binCard.className = 'bin-card';
            binCard.innerHTML = `
                <div class="bin-header">
                    <h4><i class="fas fa-trash-alt"></i> ${binId}</h4>
                    <span class="status-badge pending">Pending</span>
                </div>
                <div class="bin-input-group">
                    <div class="input-field">
                        <label>📍 Weight (kg)</label>
                        <input type="number" id="weight-${binId}" value="${this.bins[i].weight}" step="0.1" style="font-size: 14px; padding: 10px;">
                    </div>
                    <div class="input-field">
                        <label>📏 Distance (cm)</label>
                        <input type="number" id="distance-${binId}" value="${this.bins[i].distance}" step="0.1" style="font-size: 14px; padding: 10px;">
                    </div>
                </div>
                <div id="prediction-${binId}" class="prediction-preview"></div>
            `;
            container.appendChild(binCard);
        }
        
        document.getElementById('analyze-btn').disabled = false;
        document.getElementById('route-details').style.display = 'none';
        document.getElementById('animation-controls').style.display = 'none';
        document.getElementById('collection-progress').style.display = 'none';
        
        // Draw the map with dynamic bins
        this.drawMap();
    }

    resetBins() {
        this.bins = [];
        this.predictions = [];
        this.optimizedRoute = null;
        this.collectedBins.clear();
        this.currentStep = 0;
        this.isAnimating = false;
        this.coordinates = null;
        
        const container = document.getElementById('bin-inputs-container');
        container.innerHTML = `
            <div class="info-message" style="text-align: center; padding: 50px;">
                <i class="fas fa-info-circle" style="font-size: 48px; color: var(--gray);"></i>
                <p style="margin-top: 15px; font-size: 16px;">Enter number of bins (1-8) to start route planning</p>
            </div>
        `;
        
        document.getElementById('analyze-btn').disabled = true;
        document.getElementById('route-details').style.display = 'none';
        document.getElementById('animation-controls').style.display = 'none';
        document.getElementById('collection-progress').style.display = 'none';
        
        // Draw empty map
        this.drawEmptyMap();
    }

    async analyzeBins() {
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
        
        document.getElementById('analyze-btn').disabled = true;
        document.getElementById('analyze-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing with ML...';
        
        try {
            const predictionResponse = await api.fetch('/api/optimization/batch-predict', {
                method: 'POST',
                body: JSON.stringify({ bins: binsData })
            });
            
            if (predictionResponse.success) {
                this.predictions = predictionResponse.predictions;
                this.updateBinPredictions();
                
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
                    this.displayRouteDetails();
                    this.drawMap();
                    
                    document.getElementById('animation-controls').style.display = 'flex';
                    document.getElementById('collection-progress').style.display = 'block';
                    document.getElementById('total-bins').textContent = this.bins.length;
                    document.getElementById('algorithm-badge').innerHTML = 
                        `🚚 Route Optimized | ${this.optimizedRoute.totalDistance} km | ${this.optimizedRoute.estimatedTime} min`;
                }
            }
        } catch (error) {
            console.error('Analysis error:', error);
            alert('Error: ' + error.message);
        } finally {
            document.getElementById('analyze-btn').disabled = false;
            document.getElementById('analyze-btn').innerHTML = '<i class="fas fa-chart-line"></i> Analyze & Optimize Route';
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
                statusSpan.className = `status-badge ${prediction.statusText.toLowerCase()}`;
                statusSpan.innerHTML = `${prediction.statusText} (${(prediction.confidence * 100).toFixed(0)}%)`;
                
                const previewDiv = document.getElementById(`prediction-${prediction.id}`);
                previewDiv.innerHTML = `
                    <div class="prediction-tag ${prediction.statusText.toLowerCase()}">
                        <i class="fas fa-chart-line"></i> Urgency: ${prediction.urgencyScore.toFixed(0)}%
                        <div class="mini-gauge">
                            <div class="mini-fill" style="width: ${prediction.urgencyScore}%"></div>
                        </div>
                    </div>
                `;
            }
        }
    }

    getDistance(from, to) {
        if (this.coordinates && this.coordinates[from] && this.coordinates[to]) {
            const dx = this.coordinates[from].x - this.coordinates[to].x;
            const dy = this.coordinates[from].y - this.coordinates[to].y;
            // Scale distance for realistic values (1 unit = ~0.5 km)
            return (Math.sqrt(dx * dx + dy * dy) * 0.5).toFixed(1);
        }
        return null;
    }

    // ... (rest of the methods: drawMap, displayRouteDetails, zoom functions, animation methods remain similar but need to be updated to use dynamic coordinates)

    drawMap() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Draw background grid
        ctx.strokeStyle = '#cbd5e0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 8; i++) {
            ctx.beginPath();
            ctx.moveTo(i * width / 8, 0);
            ctx.lineTo(i * width / 8, height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * height / 8);
            ctx.lineTo(width, i * height / 8);
            ctx.stroke();
        }
        
        // Draw optimized route if exists
        if (this.optimizedRoute && this.optimizedRoute.route && this.coordinates) {
            ctx.beginPath();
            ctx.strokeStyle = '#2D9CDB';
            ctx.lineWidth = 5;
            ctx.setLineDash([]);
            
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
                    
                    // Draw distance
                    const midX = (fromX + toX) / 2;
                    const midY = (fromY + toY) / 2;
                    const distance = this.getDistance(from, to);
                    if (distance) {
                        ctx.fillStyle = '#2D9CDB';
                        ctx.font = 'bold 11px Inter';
                        ctx.fillText(`${distance} km`, midX - 10, midY - 5);
                    }
                }
            }
        }
        
        // Draw all bins and depot
        if (this.coordinates) {
            for (const [id, coord] of Object.entries(this.coordinates)) {
                const x = (coord.x / 100) * width;
                const y = (coord.y / 100) * height;
                
                const binPrediction = this.predictions?.find(p => p.id === id);
                const isCollected = this.collectedBins.has(id);
                
                let color = '#2d3436';
                let radius = 16;
                
                if (id === 'Depot') {
                    color = '#2d3436';
                    radius = 20;
                } else if (binPrediction) {
                    if (binPrediction.overflowStatus === 2) {
                        color = '#e74c3c';
                        radius = 18;
                    } else if (binPrediction.overflowStatus === 1) {
                        color = '#fdcb6e';
                        radius = 16;
                    } else {
                        color = '#00b894';
                        radius = 14;
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
                
                // Draw checkmark if collected
                if (isCollected) {
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 16px Inter';
                    ctx.fillText('✓', x - 5, y + 6);
                }
                
                // Draw label
                ctx.fillStyle = '#1a1a2e';
                ctx.font = 'bold 11px Inter';
                ctx.fillText(id, x - 12, y - 12);
                
                // Draw urgency percentage
                if (binPrediction && !isCollected && binPrediction.urgencyScore > 0) {
                    ctx.fillStyle = color;
                    ctx.font = 'bold 10px Inter';
                    ctx.fillText(`${binPrediction.urgencyScore.toFixed(0)}%`, x - 10, y + 20);
                }
            }
        }
        
        // Draw vehicle
        if (this.vehicleX && this.vehicleY) {
            ctx.fillStyle = '#2D9CDB';
            ctx.beginPath();
            ctx.rect(this.vehicleX - 12, this.vehicleY - 10, 24, 20);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = '20px "Font Awesome 6 Free"';
            ctx.fillText('🚛', this.vehicleX - 10, this.vehicleY + 7);
        }
    }

    // Zoom methods
    zoomIn() {
        if (this.zoomLevel < this.maxZoom) {
            this.zoomLevel += 0.2;
            this.applyZoom();
        }
    }

    zoomOut() {
        if (this.zoomLevel > this.minZoom) {
            this.zoomLevel -= 0.2;
            this.applyZoom();
        }
    }

    resetZoom() {
        this.zoomLevel = 1;
        this.applyZoom();
    }

    applyZoom() {
        const canvas = this.canvas;
        const container = canvas.parentElement;
        
        canvas.style.transform = `scale(${this.zoomLevel})`;
        canvas.style.transformOrigin = 'top left';
        
        if (this.zoomLevel > 1) {
            container.style.overflow = 'auto';
            container.style.cursor = 'grab';
        } else {
            container.style.overflow = 'visible';
            container.style.cursor = 'default';
        }
        
        this.drawMap();
    }

    displayRouteDetails() {
        const routeDetails = document.getElementById('route-details');
        const stepsList = document.getElementById('route-steps-list');
        
        if (!this.optimizedRoute || !this.optimizedRoute.route) return;
        
        // Get unique stops (remove consecutive duplicates)
        const uniqueStops = [];
        for (const stop of this.optimizedRoute.route) {
            if (uniqueStops[uniqueStops.length - 1] !== stop) {
                uniqueStops.push(stop);
            }
        }
        
        stepsList.innerHTML = uniqueStops.map((stop, index) => {
            const isDepot = stop === 'Depot';
            const binPrediction = this.predictions?.find(p => p.id === stop);
            let statusIcon = '📍';
            let statusColor = '#2d3436';
            
            if (!isDepot && binPrediction) {
                if (binPrediction.overflowStatus === 2) {
                    statusIcon = '🔴';
                    statusColor = '#e74c3c';
                } else if (binPrediction.overflowStatus === 1) {
                    statusIcon = '🟡';
                    statusColor = '#fdcb6e';
                } else {
                    statusIcon = '🟢';
                    statusColor = '#00b894';
                }
            } else if (isDepot) {
                statusIcon = '🏠';
            }
            
            const stepNumber = index + 1;
            const isLast = index === uniqueStops.length - 1;
            
            let distanceText = '';
            if (!isLast) {
                const nextStop = uniqueStops[index + 1];
                const dist = this.getDistance(stop, nextStop);
                if (dist) distanceText = `→ ${dist} km`;
            }
            
            return `
                <div class="route-step" data-step="${index}">
                    <div class="step-number" style="background: ${statusColor};">${stepNumber}</div>
                    <div class="step-info">
                        <div class="step-name">${statusIcon} ${stop}</div>
                        <div class="step-desc">
                            ${!isDepot && binPrediction ? 
                                `${binPrediction.statusText} (${binPrediction.urgencyScore.toFixed(0)}% urgent)` : 
                                (isDepot && !isLast ? 'Starting Point' : 'Return to Depot')}
                        </div>
                    </div>
                    ${distanceText ? `<div class="step-distance">${distanceText}</div>` : ''}
                </div>
            `;
        }).join('');
        
        routeDetails.style.display = 'block';
    }

    startVisualSimulation() {
        if (!this.optimizedRoute || this.isAnimating) return;
        
        this.isAnimating = true;
        this.currentStep = 0;
        this.collectedBins.clear();
        this.startTime = Date.now();
        
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        
        // Start from depot
        const depotCoord = this.coordinates['Depot'];
        this.vehicleX = (depotCoord.x / 100) * this.canvas.width;
        this.vehicleY = (depotCoord.y / 100) * this.canvas.height;
        
        this.animateVehicle();
        document.getElementById('start-sim-btn').disabled = true;
    }

    animateVehicle() {
        if (!this.isAnimating) return;
        
        const route = this.optimizedRoute.route;
        
        if (this.currentStep >= route.length - 1) {
            this.completeSimulation();
            return;
        }
        
        this.currentFrom = route[this.currentStep];
        this.currentTo = route[this.currentStep + 1];
        
        const fromCoord = this.coordinates[this.currentFrom];
        const toCoord = this.coordinates[this.currentTo];
        
        if (!fromCoord || !toCoord) {
            this.currentStep++;
            this.animateVehicle();
            return;
        }
        
        const startX = (fromCoord.x / 100) * this.canvas.width;
        const startY = (fromCoord.y / 100) * this.canvas.height;
        const endX = (toCoord.x / 100) * this.canvas.width;
        const endY = (toCoord.y / 100) * this.canvas.height;
        
        const duration = 2000 / parseFloat(document.getElementById('sim-speed').value);
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            this.vehicleX = startX + (endX - startX) * progress;
            this.vehicleY = startY + (endY - startY) * progress;
            this.drawMap();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.vehicleX = endX;
                this.vehicleY = endY;
                this.drawMap();
                
                if (this.currentTo !== 'Depot') {
                    this.collectedBins.add(this.currentTo);
                    this.updateProgress();
                }
                
                this.currentStep++;
                setTimeout(() => this.animateVehicle(), 500);
            }
        };
        
        requestAnimationFrame(animate);
    }

    updateProgress() {
        const collected = this.collectedBins.size;
        const total = this.bins.length;
        const percentage = (collected / total) * 100;
        
        const progressBar = document.getElementById('collection-progress-bar');
        if (progressBar) progressBar.style.width = `${percentage}%`;
        
        const collectedCount = document.getElementById('collected-count');
        if (collectedCount) collectedCount.textContent = collected;
        
        // Calculate distance traveled
        let distanceTraveled = 0;
        for (let i = 0; i <= this.currentStep; i++) {
            if (i < this.optimizedRoute.route.length - 1) {
                const from = this.optimizedRoute.route[i];
                const to = this.optimizedRoute.route[i + 1];
                const dist = this.getDistance(from, to);
                if (dist) distanceTraveled += parseFloat(dist);
            }
        }
        
        const traveledDistance = document.getElementById('traveled-distance');
        if (traveledDistance) traveledDistance.textContent = distanceTraveled.toFixed(1);
        
        this.drawMap();
    }

    updateTimer() {
        if (!this.isAnimating) return;
        const elapsed = (Date.now() - this.startTime) / 1000 / 60;
        const elapsedTime = document.getElementById('elapsed-time');
        if (elapsedTime) elapsedTime.textContent = elapsed.toFixed(1);
    }

    completeSimulation() {
        this.isAnimating = false;
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        alert('✅ Collection Complete! All bins have been serviced.');
        document.getElementById('start-sim-btn').disabled = false;
    }

    pauseSimulation() {
        this.isAnimating = false;
        if (this.timerInterval) clearInterval(this.timerInterval);
        document.getElementById('start-sim-btn').disabled = false;
    }

    stopSimulation() {
        this.isAnimating = false;
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.resetSimulation();
    }

    resetSimulation() {
        this.isAnimating = false;
        this.currentStep = 0;
        this.collectedBins.clear();
        this.startTime = null;
        
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        // Reset vehicle to depot
        if (this.coordinates && this.coordinates['Depot']) {
            const depotCoord = this.coordinates['Depot'];
            this.vehicleX = (depotCoord.x / 100) * this.canvas.width;
            this.vehicleY = (depotCoord.y / 100) * this.canvas.height;
        }
        
        const progressBar = document.getElementById('collection-progress-bar');
        if (progressBar) progressBar.style.width = '0%';
        
        const collectedCount = document.getElementById('collected-count');
        if (collectedCount) collectedCount.textContent = '0';
        
        const traveledDistance = document.getElementById('traveled-distance');
        if (traveledDistance) traveledDistance.textContent = '0';
        
        const elapsedTime = document.getElementById('elapsed-time');
        if (elapsedTime) elapsedTime.textContent = '0';
        
        document.getElementById('start-sim-btn').disabled = false;
        
        this.drawMap();
    }
}

// Initialize
let visualRouteOptimizer;

document.addEventListener('DOMContentLoaded', () => {
    visualRouteOptimizer = new VisualRouteOptimizer();
});

// Global functions
function generateBinInputs() { visualRouteOptimizer.generateBinInputs(); }
function analyzeBins() { visualRouteOptimizer.analyzeBins(); }
function resetBins() { visualRouteOptimizer.resetBins(); }
function startVisualSimulation() { visualRouteOptimizer.startVisualSimulation(); }
function pauseSimulation() { visualRouteOptimizer.pauseSimulation(); }
function stopSimulation() { visualRouteOptimizer.stopSimulation(); }
function resetSimulation() { visualRouteOptimizer.resetSimulation(); }
function closeBinDetail() { visualRouteOptimizer.closeBinDetail(); }
function zoomIn() { visualRouteOptimizer.zoomIn(); }
function zoomOut() { visualRouteOptimizer.zoomOut(); }
function resetZoom() { visualRouteOptimizer.resetZoom(); }