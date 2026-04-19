const express = require('express');
const router = express.Router();
const GarbageRecord = require('../models/GarbageRecord');
const mlService = require('../services/mlService');

// Get historical data with filters
router.get('/historical', async (req, res) => {
    try {
        const { startDate, endDate, location, limit = 1000, page = 1 } = req.query;
        
        let query = {};
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        
        if (location) query.location = location;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const records = await GarbageRecord.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await GarbageRecord.countDocuments(query);
        
        res.json({
            success: true,
            records,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching historical data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export data as CSV
router.get('/export/csv', async (req, res) => {
    try {
        const { startDate, endDate, limit = 10000 } = req.query;
        
        let query = {};
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        
        const records = await GarbageRecord.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        // Convert to CSV
        const csvHeader = 'Timestamp,Hour,Weight_kg,Distance_cm,Is_Weekend,Overflow_Status,Prediction_Confidence,Location,Device_ID\n';
        const csvRows = records.map(record => 
            `${record.timestamp},${record.hour},${record.weight_kg},${record.distance_cm},${record.is_weekend},${record.overflow_status},${record.prediction_confidence},${record.location},${record.device_id}`
        );
        
        const csv = csvHeader + csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=garbage_data_${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Trigger model retraining with new data
router.post('/retrain', async (req, res) => {
    try {
        const { records } = req.body;
        
        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ 
                error: 'Valid records array required for retraining',
                message: 'Please provide at least one record'
            });
        }
        
        // Validate each record has required fields
        const requiredFields = ['hour', 'weight_kg', 'distance_cm', 'is_weekend', 'overflow_status'];
        const invalidRecords = records.filter(record => 
            !requiredFields.every(field => record[field] !== undefined)
        );
        
        if (invalidRecords.length > 0) {
            return res.status(400).json({
                error: 'Invalid record format',
                message: `Each record must have: ${requiredFields.join(', ')}`,
                invalid_count: invalidRecords.length
            });
        }
        
        console.log(`Starting model retraining with ${records.length} records...`);
        
        const result = await mlService.retrainModel(records);
        
        res.json({
            success: true,
            message: 'Model retrained successfully',
            result: result
        });
        
    } catch (error) {
        console.error('Retraining error:', error);
        res.status(500).json({ 
            error: 'Failed to retrain model',
            message: error.message 
        });
    }
});
// Delete old data (admin only - add auth middleware in production)
router.delete('/cleanup', async (req, res) => {
    try {
        const { daysOld = 30 } = req.body;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        const result = await GarbageRecord.deleteMany({ timestamp: { $lt: cutoffDate } });
        
        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} records older than ${daysOld} days`
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;