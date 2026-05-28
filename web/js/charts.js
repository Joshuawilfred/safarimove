// charts.js - Chart.js integration for SafariMove Analytics

document.addEventListener('DOMContentLoaded', () => {
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = initCharts;
        document.head.appendChild(script);
    } else {
        initCharts();
    }
});

function initCharts() {
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx) {
        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Revenue (TZS)',
                    data: [12000, 19000, 15000, 22000, 28000, 35000],
                    borderColor: '#3b82f6',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const tripCtx = document.getElementById('tripDistributionChart');
    if (tripCtx) {
        new Chart(tripCtx, {
            type: 'doughnut',
            data: {
                labels: ['Ride-Hailing', 'Delivery', 'Transit'],
                datasets: [{
                    data: [55, 30, 15],
                    backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}
