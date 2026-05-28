const express = require('express');
const router = express.Router();
const db = require('../db');
const ATService = require('../services/africastalking');
const auth = require('../middleware/auth');

// Record a transaction
router.post('/', auth, async (req, res) => {
    try {
        const { user_id, trip_id, amount, type, reference } = req.body;
        
        if (!user_id || !amount || !type) {
            return res.status(400).json({ error: 'user_id, amount, and type are required' });
        }

        const [result] = await db.execute(
            `INSERT INTO transactions (user_id, trip_id, amount, type, reference, status) 
             VALUES (?, ?, ?, ?, ?, 'completed')`,
            [user_id, trip_id || null, amount, type, reference || '']
        );
        
        // Update user balance if it's a topup or payment
        if (type === 'topup' || type === 'reward') {
             await db.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, user_id]);
        } else if (type === 'payment') {
             await db.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, user_id]);
        }

        res.status(201).json({ message: 'Transaction recorded successfully', transaction_id: result.insertId });
    } catch (error) {
        console.error('Error recording transaction:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Top-up wallet via M-Pesa, Airtel Money, Halo Pesa, or Tigo Pesa (Africa's Talking Payments API with simulated fallback)
router.post('/topup', auth, async (req, res) => {
    try {
        const { user_id, amount, provider, phone: customPhone } = req.body;
        if (!user_id || !amount) {
            return res.status(400).json({ error: 'user_id and amount are required' });
        }

        // 1. Get user's phone number if customPhone not provided
        let phone = customPhone;
        if (!phone) {
            const [users] = await db.execute('SELECT phone FROM users WHERE id = ?', [user_id]);
            if (users.length === 0) return res.status(404).json({ error: 'User not found' });
            phone = users[0].phone;
        }

        // 2. Map provider to reference prefix
        const selectedProvider = (provider || 'mpesa').toLowerCase();
        let prefix = 'MPESA_DEP_';
        if (selectedProvider === 'airtel') prefix = 'AIRTEL_DEP_';
        else if (selectedProvider === 'halopesa') prefix = 'HALOPESA_DEP_';
        else if (selectedProvider === 'tigopesa') prefix = 'TIGOPESA_DEP_';

        const fallbackRef = prefix + Math.floor(Math.random() * 10000000) + '_' + Date.now();

        // 3. Initiate AT Mobile Checkout
        let transactionId = fallbackRef;
        try {
            const paymentResponse = await ATService.initiatePayment(phone, amount, { userId: user_id, provider: selectedProvider });
            console.log('AT Payment Response:', paymentResponse);
            if (paymentResponse && paymentResponse.transactionId && paymentResponse.transactionId !== 'None') {
                transactionId = paymentResponse.transactionId;
            }
        } catch (atError) {
            console.warn("Africa's Talking Payment checkout failed/skipped (sandbox mode). Proceeding with simulated fallback.", atError.message);
        }

        // 4. Record transaction as pending
        const [result] = await db.execute(
            `INSERT INTO transactions (user_id, amount, type, reference, status) 
             VALUES (?, ?, 'topup', ?, 'pending')`,
            [user_id, amount, transactionId]
        );

        // 5. Simulate the user entering PIN / STK approval after 4 seconds
        setTimeout(async () => {
            try {
                // Verify the transaction is still pending
                const [txs] = await db.execute('SELECT status FROM transactions WHERE id = ?', [result.insertId]);
                if (txs.length > 0 && txs[0].status === 'pending') {
                    // Update transaction status to completed
                    await db.execute(
                        `UPDATE transactions SET status = 'completed' WHERE id = ?`,
                        [result.insertId]
                    );
                    // Add amount to user balance
                    await db.execute(
                        `UPDATE users SET balance = balance + ? WHERE id = ?`,
                        [amount, user_id]
                    );
                    console.log(`STK simulation complete: Transaction #${result.insertId} approved, balance credited with TZS ${amount} via ${selectedProvider.toUpperCase()}`);
                }
            } catch (err) {
                console.error('Error during simulated transaction completion:', err);
            }
        }, 4000);

        res.json({ 
            message: `${selectedProvider.toUpperCase()} STK Push sent to ${phone}. Enter PIN to authorize.`, 
            status: 'pending',
            transactionId: transactionId
        });

    } catch (error) {
        console.error('Error in topup route:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get transactions list
router.get('/', auth, async (req, res) => {
    try {
        let query = 'SELECT * FROM transactions';
        let params = [];
        
        // If not admin, restrict to their own transactions
        if (req.user.role !== 'admin') {
            query += ' WHERE user_id = ?';
            params.push(req.user.id);
        } else {
            // Admin can filter by user_id query param
            const userId = req.query.user_id;
            if (userId) {
                query += ' WHERE user_id = ?';
                params.push(userId);
            }
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
