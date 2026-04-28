const express = require('express');
const router = express.Router();
const GarbageRecord = require('../models/GarbageRecord');

// Dashboard summary data
router.get('/summary', async (req, res) => {
    try {
        // Current status (last 24 hours)
        const last24h = new Date();
        last24h.setHours(last24h.getHours() - 24);
        
        const recentRecords = await GarbageRecord.find();
        // console.log("recernt :",recentRecords);
        
        const currentOverflow = recentRecords.filter(r => r.overflow_status === 2).length;
        const currentWarning = recentRecords.filter(r => r.overflow_status === 1).length;
        const currentNormal = recentRecords.filter(r => r.overflow_status === 0).length;
        console.log("currentOverflow: ",currentOverflow,"  currentWarning: ",currentWarning,"   currentNormal: ",currentNormal);
        
        // Top critical locations
        const criticalLocations = await GarbageRecord.aggregate([
            { $match: { overflow_status: 2 } },
            { $group: { _id: '$location', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
        
        // Weight trends
        const weightTrends = await GarbageRecord.aggregate([
            { $match: { timestamp: { $gte: last24h } } },
            {
                $group: {
                    _id: { $hour: '$timestamp' },
                    avgWeight: { $avg: '$weight_kg' },
                    maxWeight: { $max: '$weight_kg' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        // Weekend vs weekday comparison
        const weekendComparison = await GarbageRecord.aggregate([
            {
                $group: {
                    _id: '$is_weekend',
                    avgWeight: { $avg: '$weight_kg' },
                    avgDistance: { $avg: '$distance_cm' },
                    overflowRate: { $avg: { $cond: [{ $eq: ['$overflow_status', 2] }, 1, 0] } }
                }
            }
        ]);
        
        res.json({
            success: true,
            summary: {
                current: {
                    overflow: currentOverflow,
                    warning: currentWarning,
                    normal: currentNormal,
                    total: recentRecords.length
                },
                criticalLocations,
                weightTrends,
                weekendComparison: {
                    weekday: weekendComparison.find(w => w._id === 0),
                    weekend: weekendComparison.find(w => w._id === 1)
                }
            }
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Real-time alerts
router.get('/alerts', async (req, res) => {
    try {
        const lastHour = new Date();
        lastHour.setHours(lastHour.getHours() - 1);
        
        const alerts = await GarbageRecord.find({
            overflow_status: 2,
            timestamp: { $gte: lastHour }
        }).sort({ timestamp: -1 });
        
        res.json({
            success: true,
            alerts: alerts.map(alert => ({
                id: alert._id,
                location: alert.location,
                timestamp: alert.timestamp,
                weight: alert.weight_kg,
                distance: alert.distance_cm,
                message: `Overflow detected at ${alert.location}`
            }))
        });
    } catch (error) {
        console.error('Alerts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;