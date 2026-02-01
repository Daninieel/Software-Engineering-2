// Logout Confirmation Modal
(function () {
    'use strict';

    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function () {
        console.log('Logout confirmation script loaded');

        // Initialize logout functionality
        initializeLogoutConfirmation();
    });

    function initializeLogoutConfirmation() {
        // Get all logout links
        const logoutLinks = document.querySelectorAll('.logout-link');
        console.log('Found logout links:', logoutLinks.length);

        // Add event listener to each logout link
        logoutLinks.forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Logout link clicked - showing confirmation modal');
                showLogoutConfirmation();
            });
        });
    }

    // Show logout confirmation modal
    function showLogoutConfirmation() {
        // Remove any existing modal first
        const existingModal = document.getElementById('logoutModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'logout-modal-overlay';
        modal.id = 'logoutModal';

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'logout-modal-content';

        // Create header
        const header = document.createElement('div');
        header.className = 'logout-modal-header';
        header.innerHTML = '<i class="fas fa-sign-out-alt"></i> Confirm Logout';

        // Create message
        const message = document.createElement('p');
        message.className = 'logout-modal-message';
        message.textContent = 'Are you sure you want to log out?';

        // Create subtext
        const subtext = document.createElement('p');
        subtext.className = 'logout-modal-subtext';
        subtext.textContent = 'You will need to log in again to access the library system.';

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'logout-modal-buttons';

        // Create cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'logout-btn logout-btn-cancel';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        cancelBtn.onclick = closeLogoutModal;

        // Create logout button
        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.className = 'logout-btn logout-btn-confirm';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Log Out';
        logoutBtn.onclick = proceedWithLogout;

        // Assemble modal
        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(logoutBtn);

        modalContent.appendChild(header);
        modalContent.appendChild(message);
        modalContent.appendChild(subtext);
        modalContent.appendChild(buttonContainer);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Trigger animation after a small delay
        setTimeout(function () {
            modal.classList.add('show');
        }, 10);

        // Close modal on outside click
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeLogoutModal();
            }
        });

        // Close modal on ESC key
        const escapeHandler = function (e) {
            if (e.key === 'Escape') {
                closeLogoutModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    // Close the logout modal
    function closeLogoutModal() {
        const modal = document.getElementById('logoutModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(function () {
                modal.remove();
            }, 300);
        }
    }

    // Proceed with logout
    function proceedWithLogout() {
        const logoutForm = document.getElementById('logoutForm');
        if (logoutForm) {
            console.log('Submitting logout form');
            logoutForm.submit();
        } else {
            console.error('Logout form not found!');
        }
    }

    // Make functions globally available (in case they're called from elsewhere)
    window.showLogoutConfirmation = showLogoutConfirmation;
    window.closeLogoutModal = closeLogoutModal;
    window.proceedWithLogout = proceedWithLogout;

})();