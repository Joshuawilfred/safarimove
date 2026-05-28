const express  = require('express');
const router   = express.Router();
const db       = require('../db');
const ATService  = require('../services/africastalking');
const UssdService = require('../services/ussd');

// ─── USSD callback (Africa's Talking POSTs here on every keypress) ────────────
router.post('/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    const response = await UssdService.processMenu(sessionId, phoneNumber, text);

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

// ─── USSD session-end notification ────────────────────────────────────────────
router.post('/ussd/notify', (req, res) => {
    console.log('[USSD] Session ended:', req.body);
    res.set('Content-Type', 'text/plain');
    res.send('OK');
});

// ─── Inbound SMS (AT POSTs here when someone texts your shortcode) ────────────
router.post('/sms', async (req, res) => {
    const { from, text, date, id } = req.body;
    console.log(`[SMS] Inbound from ${from}: ${text}`);

    try {
        await db.execute(
            'INSERT INTO sms_logs (phone, message, direction, status) VALUES (?, ?, ?, ?)',
            [from, text, 'inbound', 'received']
        );
    } catch (err) {
        console.error('[SMS] Failed to log inbound message:', err.message);
    }

    res.sendStatus(200);
});

// ─── Send SMS (called by frontend or other server routes) ─────────────────────
router.post('/send-sms', async (req, res) => {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'phoneNumber and message are required' });
    }

    const sent = await ATService.sendSMS(phoneNumber, message);

    // Log outbound attempt
    try {
        await db.execute(
            'INSERT INTO sms_logs (phone, message, direction, status) VALUES (?, ?, ?, ?)',
            [phoneNumber, message, 'outbound', sent ? 'sent' : 'failed']
        );
    } catch (err) {
        console.error('[SMS] Failed to log outbound message:', err.message);
    }

    if (!sent) {
        return res.status(500).json({ error: 'Failed to send SMS. Check server logs.' });
    }

    res.json({ success: true, message: 'SMS sent successfully.' });
});

// ─── Send Airtime ─────────────────────────────────────────────────────────────
router.post('/send-airtime', async (req, res) => {
    const { phoneNumber, amount } = req.body;

    if (!phoneNumber || !amount) {
        return res.status(400).json({ error: 'phoneNumber and amount are required' });
    }

    const sent = await ATService.sendAirtime(phoneNumber, Number(amount));

    if (!sent) {
        return res.status(500).json({ error: 'Failed to send airtime. Check server logs.' });
    }

    res.json({ success: true, message: 'Airtime sent successfully.' });
});

// ─── Payment callback (AT POSTs here for payment events) ─────────────────────
router.post('/payments', (req, res) => {
    console.log('[Payments] Callback received:', req.body);
    // Extend this when payment flow is wired up
    res.sendStatus(200);
});

module.exports = router;
