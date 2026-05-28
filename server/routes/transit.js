const express = require('express');
const router = express.Router();

// Mock transit API
router.get('/routes', (req, res) => {
    res.json([
        { id: 1, name: 'Route 23W', description: 'CBD to Westlands', fare: 50, status: 'Active' },
        { id: 2, name: 'Route 44', description: 'CBD to Roysambu', fare: 80, status: 'Active' }
    ]);
});

module.exports = router;
