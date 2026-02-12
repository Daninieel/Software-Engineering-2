(function () {
    console.log('Dashboard dropdown init');

    function initDropdown() {
        const btn = document.getElementById('bookManagementBtnLib');
        const menu = document.getElementById('bookManagementSubmenuLib');

        console.log('Init - Button:', btn);
        console.log('Init - Menu:', menu);

        if (btn && menu) {
            // Remove any existing listeners by cloning
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const m = document.getElementById('bookManagementSubmenuLib');
                console.log('Clicked! Toggling...');
                m.classList.toggle('show');
                newBtn.classList.toggle('active');
            });
            console.log('Dropdown initialized successfully');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDropdown);
    } else {
        initDropdown();
    }
})();


