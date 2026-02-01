class InactivityMonitor {
    constructor(timeoutMinutes = 5, warningMinutes = 4) {
        this.timeoutMinutes = timeoutMinutes;
        this.warningMinutes = warningMinutes;
        this.lastActivityTime = Date.now();
        this.hasLoggedOut = false;
        this.modalShown = false;
        
        console.log('InactivityMonitor initialized: ' + warningMinutes + ' min warning, ' + timeoutMinutes + ' min logout');
        this.init();
    }

    init() {
        this.setupActivityListeners();
        this.startInactivityCheck();
    }

    setupActivityListeners() {
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach(event => {
            document.addEventListener(event, () => this.resetInactivityTimer(), true);
        });
    }

    startInactivityCheck() {
        setInterval(() => {
            this.checkInactivity();
        }, 1000);
    }

    resetInactivityTimer() {
        this.lastActivityTime = Date.now();
        this.modalShown = false;
        this.hideModal();
    }

    checkInactivity() {
        if (this.hasLoggedOut) return;
        
        const now = Date.now();
        const inactiveMs = now - this.lastActivityTime;
        const inactiveMinutes = inactiveMs / 1000 / 60;

        if (inactiveMinutes >= this.warningMinutes && !this.modalShown) {
            console.log('Showing inactivity warning at ' + inactiveMinutes.toFixed(2) + ' minutes');
            this.showModal();
            this.modalShown = true;
        }

        if (inactiveMinutes >= this.timeoutMinutes && this.hasLoggedOut === false) {
            console.log('Auto-logout triggered at ' + inactiveMinutes.toFixed(2) + ' minutes');
            this.logout();
        }
    }

    showModal() {
        const existing = document.getElementById('inactivityModal');
        if (existing) {
            existing.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'inactivityModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const self = this;
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                max-width: 450px;
                text-align: center;
                animation: slideIn 0.4s ease-out;
            ">
                <h2 style="color: #e74c3c; margin-bottom: 15px; font-size: 24px;">⏱️ Still There?</h2>
                <p style="color: #666; margin-bottom: 10px; font-size: 14px; line-height: 1.6;">
                    You've been inactive for 4 minutes. Your session will expire in 1 minute.
                </p>
                <p style="color: #999; margin-bottom: 25px; font-size: 12px;">
                    Click "Continue Working" to stay logged in.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="logoutBtn" style="
                        padding: 12px 28px;
                        background: #e74c3c;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                    ">
                        Logout
                    </button>
                    <button id="continueBtn" style="
                        padding: 12px 28px;
                        background: #27ae60;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                    ">
                        Continue Working
                    </button>
                </div>
            </div>
            <style>
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-40px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            </style>
        `;

        document.body.appendChild(modal);

        setTimeout(() => {
            const logoutBtn = document.getElementById('logoutBtn');
            const continueBtn = document.getElementById('continueBtn');
            
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => self.logout());
                logoutBtn.addEventListener('mouseover', () => logoutBtn.style.background = '#c0392b');
                logoutBtn.addEventListener('mouseout', () => logoutBtn.style.background = '#e74c3c');
            }
            
            if (continueBtn) {
                continueBtn.addEventListener('click', () => self.resetInactivityTimer());
                continueBtn.addEventListener('mouseover', () => continueBtn.style.background = '#229954');
                continueBtn.addEventListener('mouseout', () => continueBtn.style.background = '#27ae60');
            }
        }, 0);
    }

    hideModal() {
        const modal = document.getElementById('inactivityModal');
        if (modal) {
            modal.remove();
        }
    }

    logout() {
        this.hasLoggedOut = true;
        this.hideModal();
        
        fetch('/Home/Logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            credentials: 'include'
        })
        .then(() => {
            window.location.href = '/Home/Login';
        })
        .catch(() => {
            window.location.href = '/Home/Login';
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.inactivityMonitorInstance = new InactivityMonitor(5, 4);
});