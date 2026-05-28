const db = require('../db');
const ATService = require('./africastalking');

/**
 * SafariMove USSD service
 *
 * Session state is carried entirely by the `text` field that Africa's Talking
 * concatenates on every request (values separated by *). No DB session table needed.
 *
 * Menu tree:
 *   ""        → Welcome / main menu
 *   "1"       → Book a ride → vehicle type
 *   "1*1"     → SafariSaver confirmed
 *   "1*2"     → SafariMoto confirmed
 *   "2"       → Check balance
 *   "3"       → Buy transit ticket → route select
 *   "3*1..3"  → Ticket purchased
 */
class UssdService {
    /**
     * @param {string} sessionId
     * @param {string} phoneNumber  E.164 e.g. +255712345678
     * @param {string} text         Full concatenated input from AT
     * @returns {Promise<string>}   CON ... or END ...
     */
    async processMenu(sessionId, phoneNumber, text) {
        // AT sometimes sends a trailing * — strip it
        text = (text || '').replace(/\*$/, '');
        const parts = text === '' ? [] : text.split('*');
        const depth = parts.length;

        console.log(`[USSD] session=${sessionId} phone=${phoneNumber} text="${text}" depth=${depth}`);

        try {
            const user = await this._getOrCreateUser(phoneNumber);

            if (depth === 0) return this._mainMenu();
            if (depth === 1) return this._handleLevel1(parts[0], user, phoneNumber);
            if (depth === 2) return this._handleLevel2(parts[0], parts[1], user, phoneNumber);

            return 'END Invalid option. Please dial again.';
        } catch (err) {
            console.error('[USSD] Processing error:', err);
            return 'END System error. Please try again later.';
        }
    }

    // ─── Menu levels ──────────────────────────────────────────────────────────

    _mainMenu() {
        return `CON Welcome to SafariMove (Tanzania)
1. Book a Ride
2. Check Balance
3. Buy Transit Ticket`;
    }

    async _handleLevel1(choice, user, phoneNumber) {
        switch (choice) {
            case '1':
                return `CON Select vehicle type:
1. SafariSaver (Car) - TZS 5,000 base
2. SafariMoto (Boda) - TZS 2,500 base`;

            case '2':
                return `END Your wallet balance is TZS ${parseFloat(user.balance).toLocaleString()}.`;

            case '3':
                return `CON Select transit route:
1. Kariakoo - Kimara (TZS 650)
2. Mwenge - Posta (TZS 750)
3. Morocco - Kivukoni (TZS 650)`;

            default:
                return 'END Invalid choice. Please dial again.';
        }
    }

    async _handleLevel2(mainChoice, subChoice, user, phoneNumber) {
        if (mainChoice === '1') {
            return this._bookRide(subChoice, user, phoneNumber);
        }
        if (mainChoice === '3') {
            return this._buyTicket(subChoice, user, phoneNumber);
        }
        return 'END Invalid choice. Please dial again.';
    }

    // ─── Actions ──────────────────────────────────────────────────────────────

    async _bookRide(vehicleChoice, user, phoneNumber) {
        const vehicles = {
            '1': { name: 'SafariSaver', fare: 5000.00 },
            '2': { name: 'SafariMoto',  fare: 2500.00 },
        };

        const vehicle = vehicles[vehicleChoice];
        if (!vehicle) return 'END Invalid vehicle choice. Please dial again.';

        await db.execute(
            `INSERT INTO trips (rider_id, type, fare, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status)
             VALUES (?, 'ride', ?, -6.7924, 39.2083, -6.8000, 39.2150, 'pending')`,
            [user.id, vehicle.fare]
        );

        // Fire-and-forget SMS — does not block or kill USSD response
        ATService.sendSMS(
            phoneNumber,
            `SafariMove: Your ${vehicle.name} request is received. A driver will contact you shortly. Fare: TZS ${vehicle.fare.toLocaleString()}.`
        );

        return `END Trip requested! A ${vehicle.name} driver will be assigned shortly. Estimated fare: TZS ${vehicle.fare.toLocaleString()}.`;
    }

    async _buyTicket(routeChoice, user, phoneNumber) {
        const routes = {
            '1': { name: 'Kariakoo - Kimara',   fare: 650.00 },
            '2': { name: 'Mwenge - Posta',       fare: 750.00 },
            '3': { name: 'Morocco - Kivukoni',   fare: 650.00 },
        };

        const route = routes[routeChoice];
        if (!route) return 'END Invalid route. Please dial again.';

        if (parseFloat(user.balance) < route.fare) {
            return `END Insufficient balance. Current balance: TZS ${parseFloat(user.balance).toLocaleString()}. Top up and try again.`;
        }

        // Deduct balance
        await db.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [route.fare, user.id]);

        // Log transaction
        const ref = `TRANSIT_${routeChoice}_${Date.now()}`;
        await db.execute(
            `INSERT INTO transactions (user_id, amount, type, reference, status)
             VALUES (?, ?, 'payment', ?, 'completed')`,
            [user.id, route.fare, ref]
        );

        const ticketCode = `SM-TKT-${Math.floor(Math.random() * 90000) + 10000}`;
        const remaining  = parseFloat(user.balance) - route.fare;

        // Fire-and-forget SMS with ticket code
        ATService.sendSMS(
            phoneNumber,
            `SafariMove: Ticket confirmed for ${route.name}. TZS ${route.fare} deducted. Show inspector code: ${ticketCode}. Remaining balance: TZS ${remaining.toLocaleString()}.`
        );

        return `END Ticket purchased for ${route.name}! Code: ${ticketCode}. Details sent via SMS. Remaining balance: TZS ${remaining.toLocaleString()}.`;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Fetch user by phone or create one with a starter balance.
     * @param {string} phoneNumber
     * @returns {Promise<object>}
     */
    async _getOrCreateUser(phoneNumber) {
        const [users] = await db.execute('SELECT * FROM users WHERE phone = ?', [phoneNumber]);
        if (users.length > 0) return users[0];

        console.log(`[USSD] New user — registering ${phoneNumber}`);
        const [result] = await db.execute(
            'INSERT INTO users (phone, role, balance) VALUES (?, ?, ?)',
            [phoneNumber, 'rider', 10000.00]
        );
        const [newUsers] = await db.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
        return newUsers[0];
    }
}

module.exports = new UssdService();