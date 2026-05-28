const express = require('express');
const router = express.Router();
const db = require('../db');
const ATService = require('../services/africastalking');
const fetch = require('node-fetch');

// Helper function to send SMS with n8n HTTP + direct AT SDK fallback
async function sendSMSHelper(phoneNumber, message) {
    const payload = { phoneNumber, message };
    let success = false;
    let n8nUrlTest = `${process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook'}-test/safarimove-sms`;
    let n8nUrlProd = `${process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook'}/safarimove-sms`;

    // 1. Try n8n Test Webhook
    try {
        console.log(`Attempting to dispatch SMS via n8n test webhook: ${n8nUrlTest}`);
        const response = await fetch(n8nUrlTest, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            console.log('SMS successfully sent via n8n test webhook.');
            success = true;
        } else {
            console.warn(`n8n test webhook returned status ${response.status}`);
        }
    } catch (err) {
        console.warn(`n8n test webhook failed: ${err.message}`);
    }

    // 2. Try n8n Prod Webhook if test failed
    if (!success) {
        try {
            console.log(`Attempting to dispatch SMS via n8n prod webhook: ${n8nUrlProd}`);
            const response = await fetch(n8nUrlProd, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                console.log('SMS successfully sent via n8n prod webhook.');
                success = true;
            } else {
                console.warn(`n8n prod webhook returned status ${response.status}`);
            }
        } catch (err) {
            console.warn(`n8n prod webhook failed: ${err.message}`);
        }
    }

    // 3. Fallback: Use Africa's Talking SDK directly
    if (!success) {
        try {
            console.log(`Fallback: Sending SMS directly via Africa's Talking SDK...`);
            const atResponse = await ATService.sendSMS(phoneNumber, message);
            console.log('AT SMS direct response:', atResponse);
            success = true;
        } catch (atErr) {
            console.error('Failed to send SMS via both n8n and Africa\'s Talking SDK:', atErr);
            throw atErr;
        }
    }
    
    // Log outbound SMS in database
    try {
        await db.execute(
            'INSERT INTO sms_logs (phone, message, direction, status) VALUES (?, ?, ?, ?)',
            [phoneNumber, message, 'outbound', success ? 'sent' : 'failed']
        );
    } catch (dbErr) {
        console.error('Failed to log outbound SMS to database:', dbErr);
    }

    return success;
}

// Helper function to send Airtime with n8n HTTP + direct AT SDK fallback
async function sendAirtimeHelper(phoneNumber, amount, currencyCode = 'TZS') {
    const payload = { phoneNumber, amount, currencyCode };
    let success = false;
    let n8nUrlTest = `${process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook'}-test/safarimove-airtime`;
    let n8nUrlProd = `${process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook'}/safarimove-airtime`;

    // 1. Try n8n Test Webhook
    try {
        console.log(`Attempting to dispatch Airtime via n8n test webhook: ${n8nUrlTest}`);
        const response = await fetch(n8nUrlTest, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            console.log('Airtime successfully sent via n8n test webhook.');
            success = true;
        } else {
            console.warn(`n8n test webhook returned status ${response.status}`);
        }
    } catch (err) {
        console.warn(`n8n test webhook failed: ${err.message}`);
    }

    // 2. Try n8n Prod Webhook if test failed
    if (!success) {
        try {
            console.log(`Attempting to dispatch Airtime via n8n prod webhook: ${n8nUrlProd}`);
            const response = await fetch(n8nUrlProd, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                console.log('Airtime successfully sent via n8n prod webhook.');
                success = true;
            } else {
                console.warn(`n8n prod webhook returned status ${response.status}`);
            }
        } catch (err) {
            console.warn(`n8n prod webhook failed: ${err.message}`);
        }
    }

    // 3. Fallback: Use Africa's Talking SDK directly
    if (!success) {
        try {
            console.log(`Fallback: Sending Airtime directly via Africa's Talking SDK...`);
            const atResponse = await ATService.sendAirtime(phoneNumber, amount);
            console.log('AT Airtime direct response:', atResponse);
            success = true;
        } catch (atErr) {
            console.error('Failed to send Airtime via both n8n and Africa\'s Talking SDK:', atErr);
            throw atErr;
        }
    }

    return success;
}

// Inbound SMS webhook
router.post('/sms', async (req, res) => {
    const { from, text, date, id } = req.body;
    console.log(`Received SMS from ${from}: ${text}`);
    
    // Log SMS
    try {
        await db.execute(
            'INSERT INTO sms_logs (phone, message, direction, status) VALUES (?, ?, ?, ?)',
            [from, text, 'inbound', 'received']
        );
    } catch (err) {
        console.error('Failed to log inbound SMS', err);
    }

    res.sendStatus(200);
});

// Payments callback webhook
router.post('/payments', async (req, res) => {
    console.log('Payment notification received:', req.body);
    // Process transaction update logic here
    res.sendStatus(200);
});

// Unified route to send SMS (exposed to frontend)
router.post('/send-sms', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        if (!phoneNumber || !message) {
            return res.status(400).json({ error: 'phoneNumber and message are required' });
        }
        await sendSMSHelper(phoneNumber, message);
        res.json({ success: true, message: 'SMS dispatched successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to dispatch SMS' });
    }
});

// Unified route to send Airtime (exposed to frontend)
router.post('/send-airtime', async (req, res) => {
    try {
        const { phoneNumber, amount, currencyCode } = req.body;
        if (!phoneNumber || !amount) {
            return res.status(400).json({ error: 'phoneNumber and amount are required' });
        }
        await sendAirtimeHelper(phoneNumber, amount, currencyCode);
        res.json({ success: true, message: 'Airtime reward dispatched successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to dispatch airtime' });
    }
});

// USSD callback webhook
router.post('/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = '';

    // Standardize phone number for search
    try {
        let user;
        const [users] = await db.execute('SELECT * FROM users WHERE phone = ?', [phoneNumber]);
        if (users.length > 0) {
            user = users[0];
        } else {
            // Automatically register user if they don't exist
            const [result] = await db.execute('INSERT INTO users (phone, role, balance) VALUES (?, ?, ?)', [phoneNumber, 'rider', 10000.00]);
            const [newUsers] = await db.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
            user = newUsers[0];
        }

        const choices = text.split('*');
        const mainChoice = choices[0];

        if (text === '') {
            response = `CON Welcome to SafariMove (Tanzania)
1. Book a Ride
2. Check Balance
3. Buy Transit Ticket`;
        } else if (mainChoice === '1') {
            if (choices.length === 1) {
                response = `CON Select vehicle type:
1. SafariSaver (Car) - 3000 TZS + 1000 TZS/km
2. SafariMoto (Boda) - 1500 TZS + 400 TZS/km`;
            } else if (choices.length === 2) {
                const vehicleType = choices[1] === '2' ? 'SafariMoto' : 'SafariSaver';
                // Insert a simulated trip in DB
                const [tripResult] = await db.execute(
                    `INSERT INTO trips (rider_id, type, fare, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status) 
                     VALUES (?, 'ride', ?, -6.7924, 39.2083, -6.8000, 39.2150, 'pending')`,
                    [user.id, choices[1] === '2' ? 2500.00 : 5000.00]
                );
                
                // Trigger SMS notification via helper
                try {
                    await sendSMSHelper(
                        phoneNumber,
                        `SafariMove: Your USSD request for ${vehicleType} is received. Driver will contact you shortly.`
                    );
                } catch (smsErr) {
                    console.error('USSD trip request SMS helper failed:', smsErr.message);
                }

                response = `END Trip requested! A driver will be assigned. Total fare: TZS ${choices[1] === '2' ? '2,500' : '5,000'}.`;
            }
        } else if (mainChoice === '2') {
            response = `END Your active wallet balance is TZS ${parseFloat(user.balance).toLocaleString()}`;
        } else if (mainChoice === '3') {
            if (choices.length === 1) {
                response = `CON Select Transit Route:
1. Kariakoo - Kimara (650 TZS)
2. Mwenge - Posta (750 TZS)
3. Morocco - Kivukoni (650 TZS)`;
            } else {
                const routeIndex = choices[1];
                const fares = { '1': 650.00, '2': 750.00, '3': 650.00 };
                const names = { '1': 'Kariakoo - Kimara', '2': 'Mwenge - Posta', '3': 'Morocco - Kivukoni' };
                const fare = fares[routeIndex] || 650.00;
                const routeName = names[routeIndex] || 'Morocco - Kivukoni';

                if (user.balance < fare) {
                    response = `END Insufficient funds. Current balance: TZS ${parseFloat(user.balance).toLocaleString()}`;
                } else {
                    // Deduct from balance
                    await db.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [fare, user.id]);
                    await db.execute('INSERT INTO transactions (user_id, amount, type, reference, status) VALUES (?, ?, \'payment\', ?, \'completed\')', [
                        user.id,
                        fare,
                        'TRANSIT_TICKET_' + routeIndex + '_' + Date.now()
                    ]);

                    // Trigger SMS with ticket confirmation via helper
                    try {
                        const randomCode = Math.floor(Math.random() * 90000) + 10000;
                        await sendSMSHelper(
                            phoneNumber,
                            `SafariMove Ticket Confirmed for ${routeName}. TZS ${fare} deducted. Show this code to boarding inspector: SM-TKT-${randomCode}`
                        );
                    } catch (tktErr) {
                        console.error('USSD ticket SMS helper failed:', tktErr.message);
                    }

                    response = `END Ticket purchased successfully! You will receive your boarding QR/SMS ticket. Remaining: TZS ${parseFloat(user.balance - fare).toLocaleString()}`;
                }
            }
        } else {
            response = `END Invalid choice. Please try again.`;
        }
    } catch (err) {
        console.error('USSD processing error:', err);
        response = `END System error. Please try again later.`;
    }

    // Send the response back to the API
    res.set('Content-Type', 'text/plain');
    res.send(response);
});

module.exports = router;
