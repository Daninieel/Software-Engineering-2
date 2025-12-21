document.addEventListener('DOMContentLoaded', () => {
    const addBookForm = document.getElementById('addBookForm');
    const fileUpload = document.getElementById('fileUpload');
    const uploadBtn = document.getElementById('uploadBtn');
    const pagesInput = document.getElementById('pagesInput');
    const mobileActions = document.getElementById('mobile-only-actions');
    const startScanBtn = document.getElementById('startScanBtn');
    const cameraModal = document.getElementById('cameraModal');
    const video = document.getElementById('video');

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) { mobileActions.style.display = 'block'; }

    uploadBtn.addEventListener('click', () => fileUpload.click());

    addBookForm.addEventListener('submit', (e) => {
        if (parseInt(pagesInput.value) <= 0) {
            e.preventDefault();
            alert('Pages cannot be zero or negative!');
            return;
        }
        alert('Book successfully added!');
    });

    let stream = null;
    startScanBtn.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = stream;
            cameraModal.style.display = 'flex';
        } catch (err) { alert("Camera not accessible."); }
    });

    document.getElementById('closeCameraBtn').addEventListener('click', () => {
        if (stream) { stream.getTracks().forEach(t => t.stop()); }
        cameraModal.style.display = 'none';
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Logout?')) { window.location.href = "/Home/Login"; }
    });
});