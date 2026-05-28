const express = require('express');
const router = express.Router();

// Mock fleet API
router.get('/', (req, res) => {
    res.json([
        { id: 1, vehicle_reg: 'KCA 123G', type: 'Toyota Probox', status: 'Active', lat: -1.2921, lng: 36.8219 },
        { id: 2, vehicle_reg: 'KCD 456X', type: 'Delivery Bike', status: 'Active', lat: -1.2800, lng: 36.8300 }
    ]);
});

module.exports = router;
