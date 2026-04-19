const mongoose = require('mongoose');

const garbageRecordSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    hour: {
        type: Number,
        required: true,
        min: 0,
        max: 23
    },
    weight_kg: {
        type: Number,
        required: true,
        min: 0
    },
    distance_cm: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    is_weekend: {
        type: Number,
        required: true,
        enum: [0, 1]
    },
    overflow_status: {
        type: Number,
        required: true,
        enum: [0, 1, 2], // 0: Normal, 1: Warning, 2: Overflow
        default: 0
    },
    prediction_confidence: {
        type: Number,
        default: 0
    },
    location: {
        type: String,
        default: 'Default Location'
    },
    device_id: {
        type: String,
        default: 'SENSOR_001'
    }
}, {
    timestamps: true
});

// Index for efficient queries
garbageRecordSchema.index({ timestamp: -1 });
garbageRecordSchema.index({ location: 1, timestamp: -1 });

module.exports = mongoose.model('GarbageRecord', garbageRecordSchema);