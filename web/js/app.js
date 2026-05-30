// Basic App Logic for SafariMove Frontend

document.addEventListener('DOMContentLoaded', () => {
    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // Initialize Toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }
});

// Toast Notification System
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    // Set colors based on type
    let bgColor = 'var(--color-bg-card)';
    let borderLeft = '4px solid var(--color-primary)';
    let icon = '<i class="fa-solid fa-circle-info text-primary"></i>';
    
    if (type === 'success') {
        borderLeft = '4px solid var(--color-success)';
        icon = '<i class="fa-solid fa-circle-check text-success"></i>';
    } else if (type === 'error') {
        borderLeft = '4px solid #ef4444'; // Red
        icon = '<i class="fa-solid fa-circle-exclamation" style="color: #ef4444"></i>';
    }

    toast.className = 'glass-panel toast-notification';
    toast.style.cssText = `
        padding: 16px 24px;
        border-left: ${borderLeft};
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        animation: slideInRight 0.3s ease forwards;
        color: var(--color-text-main);
    `;
    
    toast.innerHTML = `
        ${icon}
        <div>${message}</div>
        <button onclick="this.parentElement.remove()" style="margin-left: auto; background: none; border: none; color: var(--color-text-muted); cursor: pointer;">
            <i class="fa-solid fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
};

// Auth client — guards pages, stores/reads user, attaches x-user-id header
window.Auth = {
    getUser() { try { return JSON.parse(localStorage.getItem('safarimove_user')); } catch { return null; } },
    setUser(u) { localStorage.setItem('safarimove_user', JSON.stringify(u)); },
    logout() { localStorage.removeItem('safarimove_user'); window.location.href = 'login.html'; },
    requireAuth() { const u = this.getUser(); if (!u) { window.location.href = 'login.html'; return null; } return u; },
    async apiFetch(url, options = {}) {
        const u = this.getUser();
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (u) headers['x-user-id'] = u.id;
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401) this.logout();
        return res;
    }
};

// Add keyframes for toast animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);
