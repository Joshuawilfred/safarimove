const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../web')));

// API Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/fleet', require('./routes/fleet'));
app.use('/api/transit', require('./routes/transit'));
app.use('/api/at', require('./routes/at-callbacks'));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SafariMove API is running' });
});

// Fallback to index.html for SPA-like behavior if needed
// app.get('*', (req, res) => {
//    res.sendFile(path.join(__dirname, '../web/index.html'));
// });

app.listen(PORT, () => {
    console.log(`SafariMove server running on http://localhost:${PORT}`);
    console.log(`Serving static files from ${path.join(__dirname, '../web')}`);
});
