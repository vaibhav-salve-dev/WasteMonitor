const express = require('express');
const router = express.Router();
const GarbageRecord = require('../models/GarbageRecord');
const mlService = require('../services/mlService');

// Dijkstra's Algorithm Implementation
class RouteOptimizer {
    constructor(graph) {
        this.graph = graph;
    }

    dijkstra(start, end) {
        const distances = {};
        const previous = {};
        const unvisited = new Set();
        
        // Initialize distances
        for (const node in this.graph) {
            distances[node] = Infinity;
            previous[node] = null;
            unvisited.add(node);
        }
        distances[start] = 0;
        
        while (unvisited.size > 0) {
            // Find node with minimum distance
            let current = null;
            for (const node of unvisited) {
                if (current === null || distances[node] < distances[current]) {
                    current = node;
                }
            }
            
            if (current === end || distances[current] === Infinity) break;
            
            unvisited.delete(current);
            
            // Update neighbors
            for (const neighbor in this.graph[current]) {
                const distance = this.graph[current][neighbor];
                const newDistance = distances[current] + distance;
                
                if (newDistance < distances[neighbor]) {
                    distances[neighbor] = newDistance;
                    previous[neighbor] = current;
                }
            }
        }
        
        // Build path
        const path = [];
        let current = end;
        while (current !== null) {
            path.unshift(current);
            current = previous[current];
        }
        
        return {
            path: path,
            distance: distances[end],
            isReachable: distances[end] !== Infinity
        };
    }
}

// Define city graph (you can expand this)
const cityGraph = {
    'Depot': { 'Bin1': 5, 'Bin2': 8, 'Bin3': 12, 'Bin4': 15, 'Bin5': 20 },
    'Bin1': { 'Depot': 5, 'Bin2': 3, 'Bin3': 7, 'Bin4': 10, 'Bin5': 18 },
    'Bin2': { 'Depot': 8, 'Bin1': 3, 'Bin3': 4, 'Bin4': 6, 'Bin5': 12 },
    'Bin3': { 'Depot': 12, 'Bin1': 7, 'Bin2': 4, 'Bin4': 5, 'Bin5': 9 },
    'Bin4': { 'Depot': 15, 'Bin1': 10, 'Bin2': 6, 'Bin3': 5, 'Bin5': 4 },
    'Bin5': { 'Depot': 20, 'Bin1': 18, 'Bin2': 12, 'Bin3': 9, 'Bin4': 4 }
};

// Calculate urgency score based on ML prediction
function calculateUrgencyScore(confidence, overflowStatus) {
    let urgencyScore = 0;
    
    // Base score from overflow status
    if (overflowStatus === 2) urgencyScore = 100;
    else if (overflowStatus === 1) urgencyScore = 60;
    else urgencyScore = 20;
    
    // Adjust by confidence
    urgencyScore += (confidence * 40);
    
    return Math.min(urgencyScore, 100);
}

// Generate optimized route based on urgency
function generateOptimizedRoute(bins, depot = 'Depot') {
    // Sort bins by urgency (highest first)
    const sortedBins = [...bins].sort((a, b) => b.urgencyScore - a.urgencyScore);
    
    // Route planning
    let currentLocation = depot;
    const route = [depot];
    const unvisited = new Set(sortedBins.map(b => b.id));
    
    while (unvisited.size > 0) {
        let closestBin = null;
        let minDistance = Infinity;
        
        for (const binId of unvisited) {
            if (cityGraph[currentLocation] && cityGraph[currentLocation][binId]) {
                const distance = cityGraph[currentLocation][binId];
                // Adjust by urgency (higher urgency = prioritize even if slightly farther)
                const bin = sortedBins.find(b => b.id === binId);
                const adjustedDistance = distance * (1 - (bin.urgencyScore / 200));
                
                if (adjustedDistance < minDistance) {
                    minDistance = adjustedDistance;
                    closestBin = binId;
                }
            }
        }
        
        if (closestBin) {
            route.push(closestBin);
            currentLocation = closestBin;
            unvisited.delete(closestBin);
        } else {
            break;
        }
    }
    
    // Return to depot
    if (cityGraph[currentLocation] && cityGraph[currentLocation][depot]) {
        route.push(depot);
    }
    
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
        const from = route[i];
        const to = route[i + 1];
        if (cityGraph[from] && cityGraph[from][to]) {
            totalDistance += cityGraph[from][to];
        }
    }
    
    return { route, totalDistance };
}

// Optimize route using Dijkstra for multiple points
function optimizeMultiPointRoute(points, startPoint = 'Depot', endPoint = 'Depot') {
    const routeOptimizer = new RouteOptimizer(cityGraph);
    
    // Generate all possible permutations for small number of bins (n <= 6)
    function generatePermutations(arr) {
        if (arr.length <= 1) return [arr];
        const permutations = [];
        for (let i = 0; i < arr.length; i++) {
            const current = arr[i];
            const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
            const subPermutations = generatePermutations(remaining);
            for (const perm of subPermutations) {
                permutations.push([current, ...perm]);
            }
        }
        return permutations;
    }
    
    if (points.length <= 6) {
        // For small number of points, try all permutations
        const permutations = generatePermutations(points);
        let bestRoute = null;
        let shortestDistance = Infinity;
        
        for (const perm of permutations) {
            const fullPath = [startPoint, ...perm, endPoint];
            let totalDistance = 0;
            let valid = true;
            
            for (let i = 0; i < fullPath.length - 1; i++) {
                const from = fullPath[i];
                const to = fullPath[i + 1];
                if (cityGraph[from] && cityGraph[from][to]) {
                    totalDistance += cityGraph[from][to];
                } else {
                    valid = false;
                    break;
                }
            }
            
            if (valid && totalDistance < shortestDistance) {
                shortestDistance = totalDistance;
                bestRoute = fullPath;
            }
        }
        
        return {
            route: bestRoute || [startPoint, ...points, endPoint],
            totalDistance: shortestDistance,
            algorithm: 'permutation'
        };
    } else {
        // For larger numbers, use nearest neighbor with urgency
        const sortedByUrgency = [...points].sort((a, b) => b.urgencyScore - a.urgencyScore);
        return {
            route: [startPoint, ...sortedByUrgency, endPoint],
            totalDistance: null,
            algorithm: 'urgency-based'
        };
    }
}

// Get ML prediction for multiple bins
router.post('/batch-predict', async (req, res) => {
    try {
        const { bins } = req.body;
        
        if (!bins || !Array.isArray(bins) || bins.length === 0) {
            return res.status(400).json({ error: 'Invalid bins data' });
        }
        
        const predictions = [];
        
        for (const bin of bins) {
            const prediction = await mlService.predict({
                hour: bin.hour || new Date().getHours(),
                weight_kg: parseFloat(bin.weight),
                distance_cm: parseFloat(bin.distance),
                is_weekend: bin.is_weekend || 0
            });
            
            const urgencyScore = calculateUrgencyScore(
                prediction.confidence || 0.5,
                prediction.status
            );
            
            predictions.push({
                id: bin.id || `Bin_${predictions.length + 1}`,
                name: bin.name || `Bin ${predictions.length + 1}`,
                location: bin.location || { x: Math.random() * 100, y: Math.random() * 100 },
                weight: parseFloat(bin.weight),
                distance: parseFloat(bin.distance),
                overflowStatus: prediction.status,
                confidence: prediction.confidence || 0.5,
                urgencyScore: urgencyScore,
                statusText: prediction.status === 2 ? 'Critical' : prediction.status === 1 ? 'Warning' : 'Normal',
                message: prediction.message
            });
        }
        
        res.json({
            success: true,
            predictions: predictions
        });
        
    } catch (error) {
        console.error('Batch prediction error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Optimize route based on bin predictions
router.post('/optimize-route', async (req, res) => {
    try {
        const { bins, startPoint = 'Depot', endPoint = 'Depot' } = req.body;
        
        if (!bins || !Array.isArray(bins) || bins.length === 0) {
            return res.status(400).json({ error: 'Invalid bins data' });
        }
        
        // Sort bins by urgency for route optimization
        const sortedBins = [...bins].sort((a, b) => b.urgencyScore - a.urgencyScore);
        const binIds = sortedBins.map(bin => bin.id);
        
        // Optimize route
        const optimization = optimizeMultiPointRoute(binIds, startPoint, endPoint);
        
        // Calculate total distance if not already calculated
        let totalDistance = optimization.totalDistance;
        if (!totalDistance && optimization.route) {
            totalDistance = 0;
            for (let i = 0; i < optimization.route.length - 1; i++) {
                const from = optimization.route[i];
                const to = optimization.route[i + 1];
                if (cityGraph[from] && cityGraph[from][to]) {
                    totalDistance += cityGraph[from][to];
                }
            }
        }
        
        // Calculate estimated time (assuming 30 km/h average speed)
        const estimatedTime = totalDistance ? (totalDistance / 30) * 60 : 0;
        
        res.json({
            success: true,
            optimization: {
                route: optimization.route,
                totalDistance: totalDistance ? totalDistance.toFixed(2) : null,
                estimatedTime: estimatedTime.toFixed(2),
                numberOfStops: bins.length,
                algorithm: optimization.algorithm,
                binsInOrder: optimization.route.filter(r => r !== 'Depot')
            },
            bins: bins
        });
        
    } catch (error) {
        console.error('Route optimization error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get bin coordinates for visualization
router.get('/bin-coordinates', (req, res) => {
    const coordinates = {
        'Depot': { x: 50, y: 50, name: 'Depot / Garage' },
        'Bin1': { x: 20, y: 30, name: 'Bin 1 - Downtown' },
        'Bin2': { x: 35, y: 65, name: 'Bin 2 - Residential' },
        'Bin3': { x: 60, y: 25, name: 'Bin 3 - Commercial' },
        'Bin4': { x: 75, y: 55, name: 'Bin 4 - Industrial' },
        'Bin5': { x: 85, y: 80, name: 'Bin 5 - Suburb' }
    };
    
    res.json({
        success: true,
        coordinates: coordinates
    });
});

module.exports = router;