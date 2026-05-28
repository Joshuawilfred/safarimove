const AfricasTalking = require('africastalking')({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || 'sandbox',
});

const sms = AfricasTalking.SMS;
const airtime = AfricasTalking.AIRTIME;

class ATService {
    /**
     * Send an SMS to a single recipient.
     * Never throws — logs the error and returns false so callers
     * (especially the USSD handler) are never killed by an SMS failure.
     *
     * @param {string} to      E.164 format e.g. +255712345678
     * @param {string} message Plain text
     * @returns {Promise<boolean>}
     */
    static async sendSMS(to, message) {
        try {
            console.log(`[AT] Sending SMS to ${to}`);
            const response = await sms.send({ to: [to], message });
            console.log('[AT] SMS response:', JSON.stringify(response));
            return true;
        } catch (error) {
            console.error('[AT] SMS failed:', error.message || error);
            return false;
        }
    }

    /**
     * Send airtime to a recipient.
     *
     * @param {string} phoneNumber E.164 format
     * @param {number} amount      Amount in TZS
     * @returns {Promise<boolean>}
     */
    static async sendAirtime(phoneNumber, amount) {
        try {
            console.log(`[AT] Sending airtime TZS ${amount} to ${phoneNumber}`);
            const response = await airtime.send({
                recipients: [{ phoneNumber, currencyCode: 'TZS', amount }],
            });
            console.log('[AT] Airtime response:', JSON.stringify(response));
            return true;
        } catch (error) {
            console.error('[AT] Airtime failed:', error.message || error);
            return false;
        }
    }
}

module.exports = ATService;