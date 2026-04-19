const express = require('express');
const router = express.Router();
const GarbageRecord = require('../models/GarbageRecord');
const mlService = require('../services/mlService');

// Helper function - defined at the top level (not inside a class)
function getStatusMessage(status) {
    switch(parseInt(status)) {
        case 0: return 'Normal - Bin has sufficient capacity';
        case 1: return 'Warning - Bin is approaching capacity';
        case 2: return 'Overflow - Bin requires immediate attention';
        default: return 'Unknown status';
    }
}

// Real-time prediction endpoint
router.post('/predict', async (req, res) => {
    try {
        const { hour, weight, distance, weekend, location, device_id } = req.body;
        
        // Validate input
        if (hour === undefined || weight === undefined || distance === undefined || weekend === undefined) {
            return res.status(400).json({
                error: 'Missing required fields: hour, weight, distance, weekend'
            });
        }

        console.log('Received prediction request:', { hour, weight, distance, weekend });

        // Get prediction from ML service
        const prediction = await mlService.predict({
            hour: parseInt(hour),
            weight_kg: parseFloat(weight),
            distance_cm: parseFloat(distance),
            is_weekend: parseInt(weekend)
        });

        console.log('ML Service response:', prediction);

        // Save to database
        const record = new GarbageRecord({
            hour: parseInt(hour),
            weight_kg: parseFloat(weight),
            distance_cm: parseFloat(distance),
            is_weekend: parseInt(weekend),
            overflow_status: prediction.status,
            prediction_confidence: prediction.confidence || 0,
            location: location || 'Default Location',
            device_id: device_id || 'SENSOR_001'
        });

        await record.save();

        res.json({
            success: true,
            prediction: prediction.status,
            message: getStatusMessage(prediction.status),  // Now using the helper function correctly
            confidence: prediction.confidence,
            record_id: record._id
        });
    } catch (error) {
        console.error('Prediction error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Batch predictions
router.post('/predict/batch', async (req, res) => {
    try {
        const { readings } = req.body;
        
        if (!readings || !Array.isArray(readings)) {
            return res.status(400).json({ error: 'Invalid readings array' });
        }

        const predictions = await mlService.batchPredict(readings);
        
        // Save all records
        const savedRecords = [];
        for (let i = 0; i < readings.length; i++) {
            const record = new GarbageRecord({
                hour: readings[i].hour,
                weight_kg: readings[i].weight_kg,
                distance_cm: readings[i].distance_cm,
                is_weekend: readings[i].is_weekend,
                overflow_status: predictions[i].status,
                prediction_confidence: predictions[i].confidence || 0,
                location: readings[i].location || 'Default Location',
                device_id: readings[i].device_id || 'SENSOR_001'
            });
            savedRecords.push(await record.save());
        }

        res.json({
            success: true,
            predictions: predictions,
            records: savedRecords
        });
    } catch (error) {
        console.error('Batch prediction error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Get recent predictions
router.get('/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const records = await GarbageRecord.find()
            .sort({ timestamp: -1 })
            .limit(limit);
        
        res.json({
            success: true,
            records: records
        });
    } catch (error) {
        console.error('Error fetching recent predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await GarbageRecord.aggregate([
            {
                $group: {
                    _id: null,
                    totalRecords: { $sum: 1 },
                    avgWeight: { $avg: '$weight_kg' },
                    avgDistance: { $avg: '$distance_cm' },
                    overflowCount: { $sum: { $cond: [{ $eq: ['$overflow_status', 2] }, 1, 0] } },
                    warningCount: { $sum: { $cond: [{ $eq: ['$overflow_status', 1] }, 1, 0] } },
                    normalCount: { $sum: { $cond: [{ $eq: ['$overflow_status', 0] }, 1, 0] } }
                }
            }
        ]);

        res.json({
            success: true,
            stats: stats[0] || {
                totalRecords: 0,
                avgWeight: 0,
                avgDistance: 0,
                overflowCount: 0,
                warningCount: 0,
                normalCount: 0
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get hourly trends
router.get('/trends/hourly', async (req, res) => {
    try {
        const trends = await GarbageRecord.aggregate([
            {
                $group: {
                    _id: '$hour',
                    avgWeight: { $avg: '$weight_kg' },
                    avgDistance: { $avg: '$distance_cm' },
                    maxWeight: { $max: '$weight_kg' },
                    overflowRate: {
                        $avg: { $cond: [{ $eq: ['$overflow_status', 2] }, 1, 0] }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            trends: trends
        });
    } catch (error) {
        console.error('Error fetching hourly trends:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;