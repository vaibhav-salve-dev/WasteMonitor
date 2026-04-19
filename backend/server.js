const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

// Import modules
const connectDB = require('./config/database');

// Import routes - make sure these are exported correctly
const predictionRoutes = require('./routes/predictions');
const dataRoutes = require('./routes/data');
const dashboardRoutes = require('./routes/dashboard');

const GarbageRecord = require('./models/GarbageRecord');
const optimizationRoutes = require('./routes/optimization');
// Initialize app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Connect to MongoDB
connectDB();

// Routes - make sure these are functions
app.use('/api/predictions', predictionRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/optimization', optimizationRoutes);
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
    console.log('New client connected');
    
    socket.on('subscribe', (room) => {
        socket.join(room);
        console.log(`Client subscribed to ${room}`);
    });
    
    socket.on('newReading', async (data) => {
        io.emit('readingUpdate', data);
        
        if (data.overflow_status === 2) {
            io.emit('overflowAlert', {
                ...data,
                timestamp: new Date()
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Simulate real-time sensor data (for demo purposes)
if (process.env.NODE_ENV !== 'production') {
    setInterval(async () => {
        try {
            const hour = new Date().getHours();
            const isWeekend = [0, 6].includes(new Date().getDay()) ? 1 : 0;
            
            const weight = Math.random() * 60;
            const distance = Math.random() * 100;
            
            // Use fetch to call internal API
            const fetch = await import('node-fetch');
            
            const response = await fetch.default(`http://localhost:${PORT}/api/predictions/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hour,
                    weight,
                    distance,
                    weekend: isWeekend,
                    location: 'Demo Sensor',
                    device_id: 'DEMO_001'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                io.emit('readingUpdate', {
                    hour,
                    weight,
                    distance,
                    isWeekend,
                    overflow_status: result.prediction,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            // Silent fail for demo data
        }
    }, 30000);
}

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend available at http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
});