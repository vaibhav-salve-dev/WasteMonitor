const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

class MLService {
    async predict(data) {
        try {
            const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
                hour: data.hour,
                weight: data.weight_kg,
                distance: data.distance_cm,
                weekend: data.is_weekend
            }, {
                timeout: 5000
            });
            
            return {
                status: response.data.status,
                message: response.data.message,
                confidence: response.data.confidence || null
            };
        } catch (error) {
            console.error('ML Prediction Error:', error.message);
            // Fallback prediction based on rules
            return this.fallbackPrediction(data);
        }
    }

    fallbackPrediction(data) {
        // Rule-based fallback when ML service is unavailable
        let status = 0;
        
        // High weight and low distance indicates overflow
        if (data.weight_kg > 40 && data.distance_cm < 30) {
            status = 2;
        } else if (data.weight_kg > 25 && data.distance_cm < 50) {
            status = 1;
        } else if (data.distance_cm < 20) {
            status = 2;
        } else if (data.distance_cm < 40) {
            status = 1;
        }
        
        return {
            status: status,
            message: 'Prediction using fallback logic',
            confidence: 0.7
        };
    }

    async retrainModel(newData) {
    try {
        // Format data properly for ML service
        let formattedData = [];
        
        if (Array.isArray(newData)) {
            formattedData = newData.map(record => ({
                hour: record.hour,
                weight_kg: record.weight_kg,
                distance_cm: record.distance_cm,
                is_weekend: record.is_weekend,
                overflow_status: record.overflow_status
            }));
        } else if (newData.records) {
            formattedData = newData.records;
        } else {
            formattedData = newData;
        }
        
        console.log(`Sending ${formattedData.length} records for retraining...`);
        
        const response = await axios.post(`${ML_SERVICE_URL}/update`, {
            records: formattedData
        }, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Retraining response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Model Retraining Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
        throw new Error(`Failed to retrain model: ${error.response?.data?.error || error.message}`);
    }
}

    async batchPredict(dataArray) {
        try {
            const promises = dataArray.map(data => this.predict(data));
            return await Promise.all(promises);
        } catch (error) {
            console.error('Batch Prediction Error:', error.message);
            return dataArray.map(data => this.fallbackPrediction(data));
        }
    }
}

module.exports = new MLService();