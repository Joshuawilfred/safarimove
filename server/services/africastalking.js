const credentials = {
    apiKey: process.env.AT_API_KEY || 'sandbox_api_key',
    username: process.env.AT_USERNAME || 'sandbox',
};

const AfricasTalking = require('africastalking')(credentials);
const sms = AfricasTalking.SMS;
const payments = AfricasTalking.PAYMENTS;
const airtime = AfricasTalking.AIRTIME;

class ATService {
    static async sendSMS(to, message) {
        try {
            const options = {
                to: [to],
                message: message,
            };
            const response = await sms.send(options);
            return response;
        } catch (error) {
            console.error('Error sending SMS via AT:', error);
            throw error;
        }
    }

    static async sendAirtime(phoneNumber, amount) {
        try {
            const options = {
                recipients: [{
                    phoneNumber,
                    currencyCode: 'TZS',
                    amount: amount
                }]
            };
            const response = await airtime.send(options);
            return response;
        } catch (error) {
            console.error('Error sending airtime via AT:', error);
            throw error;
        }
    }

    static async initiatePayment(phoneNumber, amount, metadata = {}) {
        try {
            const options = {
                productName: 'SafariMove Transit',
                phoneNumber,
                currencyCode: 'TZS',
                amount: amount,
                metadata: metadata
            };
            // Mobile checkout logic for M-Pesa integration
            const response = await payments.mobileCheckout(options);
            return response;
        } catch (error) {
            console.error('Error initiating payment via AT:', error);
            throw error;
        }
    }
}

module.exports = ATService;
