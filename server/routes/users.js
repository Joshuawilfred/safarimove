const express = require('express');
const router = express.Router();
const db = require('../db');

// Login or register a user by phone
router.post('/auth', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number is required' });

        // Check if user exists
        const [users] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        
        let user;
        if (users.length > 0) {
            user = users[0];
            // Optionally update name/email if they are provided and weren't set
            let updates = [];
            let params = [];
            if (req.body.name && !user.name) {
                updates.push('name = ?');
                params.push(req.body.name);
                user.name = req.body.name;
            }
            if (req.body.email && !user.email) {
                updates.push('email = ?');
                params.push(req.body.email);
                user.email = req.body.email;
            }
            if (updates.length > 0) {
                params.push(user.id);
                await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
            }
        } else {
            // Create new user with 100,000.00 TZS promotional balance
            const welcomeBalance = 100000.00;
            const name = req.body.name || 'SafariMove Rider';
            const email = req.body.email || '';
            const [result] = await db.execute(
                'INSERT INTO users (phone, name, email, role, balance) VALUES (?, ?, ?, ?, ?)', 
                [phone, name, email, 'rider', welcomeBalance]
            );
            
            // Record a transaction for the promotional reward
            await db.execute(
                `INSERT INTO transactions (user_id, amount, type, reference, status) 
                 VALUES (?, ?, 'reward', ?, 'completed')`,
                [result.insertId, welcomeBalance, 'PROMO_WELCOME_' + Date.now()]
            );

            const [newUsers] = await db.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
            user = newUsers[0];
        }

        res.json({ message: 'Authentication successful', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
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
