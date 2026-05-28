// at-sandbox.js - Africa's Talking Sandbox UI handlers
async function handleUSSDSimulation(phone, text) {
    showToast(`Simulating USSD input: "${text}"`, 'info');
    try {
        const response = await fetch('/api/at/ussd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: "sim_" + Date.now(),
                phoneNumber: phone,
                text: text
            })
        });
        const data = await response.text();
        // Display response in UI
        const outputDiv = document.getElementById('ussdOutput');
        if (outputDiv) {
            outputDiv.innerText = data.replace('CON ', '').replace('END ', '');
        }
        return data;
    } catch (err) {
        console.error('USSD Simulation error:', err);
        showToast('Error connecting to USSD webhook', 'error');
    }
}

window.handleUSSDSimulation = handleUSSDSimulation;
