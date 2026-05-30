const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Create a new trip (ride or delivery)
router.post('/', auth, async (req, res) => {
    try {
        const { rider_id, type, fare, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = req.body;
        
        if (!rider_id || !type) {
            return res.status(400).json({ error: 'rider_id and type are required' });
        }

        const [result] = await db.execute(
            `INSERT INTO trips (rider_id, type, fare, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                rider_id, 
                type, 
                fare || 0, 
                pickup_lat || -6.7924, 
                pickup_lng || 39.2083, 
                dropoff_lat || -6.8000, 
                dropoff_lng || 39.2150
            ]
        );

        res.status(201).json({ message: 'Trip requested successfully', trip_id: result.insertId });
    } catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({ error: 'Database error while creating trip' });
    }
});

// Get trips for a rider via ?rider_id=N query filter
router.get('/', auth, async (req, res) => {
    try {
        const { rider_id } = req.query;
        if (!rider_id) {
            return res.status(400).json({ error: 'rider_id query param required' });
        }
        const [trips] = await db.execute(
            'SELECT * FROM trips WHERE rider_id = ? ORDER BY created_at DESC LIMIT 20',
            [parseInt(rider_id, 10)]
        );
        res.json(trips);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get active trips for a user
router.get('/user/:id', auth, async (req, res) => {
    try {
        const [trips] = await db.execute('SELECT * FROM trips WHERE rider_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]);
        res.json(trips);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Update a trip's status
router.put('/:id', auth, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }
        await db.execute('UPDATE trips SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Trip status updated successfully' });
    } catch (error) {
        console.error('Error updating trip status:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
