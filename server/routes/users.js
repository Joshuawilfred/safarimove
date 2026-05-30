const express = require('express');
const router = express.Router();
const db = require('../db');

// Login or register a user by phone
router.post('/auth', async (req, res) => {
    const { phone, name, email } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });
    try {
        const [existing] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        if (name) { // SIGNUP
            if (existing.length > 0) return res.status(200).json({ user: existing[0] });
            const [result] = await db.execute(
                'INSERT INTO users (phone, name, email, role, balance) VALUES (?, ?, ?, ?, ?)',
                [phone, name, email || null, 'rider', 100000.00]
            );
            const [created] = await db.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
            return res.status(201).json({ user: created[0] });
        }
        // LOGIN
        if (existing.length === 0)
            return res.status(404).json({ error: 'No account found for this number. Please sign up.' });
        return res.status(200).json({ user: existing[0] });
    } catch (err) {
        console.error('[Auth] Error:', err.message);
        return res.status(500).json({ error: 'Database error during authentication.' });
    }
});

// Get user profile
router.get('/:id', async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, phone, name, email, role, balance FROM users WHERE id = ?', [req.params.id]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
