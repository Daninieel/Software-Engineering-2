document.addEventListener('DOMContentLoaded', () => {
    const GOOGLE_API_KEY = 'AIzaSyCKBTEr-lRyt7BokJofqH-L18tjHbOpWLk';

    // Elements
    const videoSourceSelect = document.getElementById('videoSource');
    const scanIsbnBtn = document.getElementById('scanIsbnBtn');
    const cameraModal = document.getElementById('cameraModal');
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('captureBtn');
    const closeCameraBtn = document.getElementById('closeCameraBtn');
    const fileUpload = document.getElementById('fileUpload'); // For local file upload

    // Form Inputs
    const isbnInput = document.querySelector('input[name="ISBN"]');
    const titleInput = document.querySelector('input[name="BookTitle"]');
    const authorInput = document.querySelector('input[name="Author"]');
    const pagesInput = document.querySelector('input[name="Pages"]');
    const yearInput = document.querySelector('input[name="Year"]');
    const publisherInput = document.querySelector('input[name="Publisher"]');
    const remarksInput = document.querySelector('textarea[name="Remarks"]');

    let stream = null;
    let isScanning = false;
    let scanTimeout = null;

    // --- 1. CORE OCR LOGIC (Used by both Camera and Upload) ---
    async function processImageAndGetIsbn(imageSource) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Load image to canvas
        const img = new Image();
        img.src = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);

        return new Promise((resolve) => {
            img.onload = async () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // Pre-processing for better detection (Grayscale + Contrast)
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    avg = (avg - 128) * 1.5 + 128;
                    data[i] = data[i + 1] = data[i + 2] = avg;
                }
                ctx.putImageData(imageData, 0, 0);

                try {
                    const result = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng+fil');
                    const text = result.data.text.replace(/[^0-9X]/gi, '');
                    const match = text.match(/(978|979)\d{10}|\d{9}[0-9X]/);
                    resolve(match ? match[0] : null);
                } catch (e) {
                    console.error("OCR processing error:", e);
                    resolve(null);
                }
            };
        });
    }

    // --- 2. IMAGE UPLOAD HANDLER ---
    fileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Visual feedback
        const originalBtn = document.querySelector('label[for="fileUpload"]') || document.querySelector('.btn-blue');
        const originalText = originalBtn.innerText;
        originalBtn.innerText = "Scanning Image...";

        const foundIsbn = await processImageAndGetIsbn(file);

        if (foundIsbn) {
            isbnInput.value = foundIsbn;
            const success = await fetchBookData(foundIsbn);
            if (success) {
                alert("Book details auto-filled from image!");
            }
        } else {
            alert("No ISBN detected in the uploaded image. Please ensure the barcode is clear.");
        }

        originalBtn.innerText = originalText;
    });

    // --- 3. AUTOMATIC CAMERA SCANNER ---
    async function startAutoScan() {
        if (!isScanning) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const foundIsbn = await processImageAndGetIsbn(canvas.toDataURL('image/jpeg'));

        if (foundIsbn) {
            isbnInput.value = foundIsbn;
            const success = await fetchBookData(foundIsbn);
            if (success) {
                stopCamera(); // Close camera if book found
                return;
            }
        }

        // Loop every 1.2 seconds if camera is still open
        if (isScanning) {
            scanTimeout = setTimeout(startAutoScan, 1200);
        }
    }

    // --- 4. MANUAL CAPTURE BUTTON ---
    captureBtn.addEventListener('click', async () => {
        if (!isScanning) return;

        captureBtn.innerText = "Scanning...";
        captureBtn.disabled = true;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const manualIsbn = await processImageAndGetIsbn(canvas.toDataURL('image/jpeg'));

        if (manualIsbn) {
            isbnInput.value = manualIsbn;
            const success = await fetchBookData(manualIsbn);
            if (success) {
                stopCamera();
            } else {
                captureBtn.innerText = "Capture";
                captureBtn.disabled = false;
            }
        } else {
            alert("No ISBN detected manually. Try a different angle.");
            captureBtn.innerText = "Capture";
            captureBtn.disabled = false;
        }
    });

    // --- 5. DUAL-API FETCH ---
    async function fetchBookData(isbn) {
        const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${GOOGLE_API_KEY}`;
        const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=details&format=json`;

        try {
            let response = await fetch(googleUrl);
            let data = await response.json();

            if (data.totalItems > 0 && data.items) {
                const b = data.items[0].volumeInfo;
                fillForm(b.title, b.authors?.join(', '), b.publisher, b.pageCount, b.publishedDate, b.description);
                return true;
            }

            // Fallback for Filipino titles
            response = await fetch(olUrl);
            data = await response.json();
            const key = `ISBN:${isbn}`;

            if (data[key]) {
                const d = data[key].details;
                fillForm(d.title, d.authors?.map(a => a.name).join(', '), d.publishers?.[0], d.number_of_pages, d.publish_date, "");
                return true;
            }
            return false;
        } catch (err) { return false; }
    }

    function fillForm(t, a, p, pg, d, rem) {
        if (t) titleInput.value = t;
        if (a) authorInput.value = a;
        if (p) publisherInput.value = p;
        if (pg) pagesInput.value = pg;
        if (d) {
            const y = d.match(/\d{4}/);
            if (y) yearInput.value = `${y[0]}-01-01`;
        }
        if (rem) remarksInput.value = rem.substring(0, 500);
    }

    // --- 6. CAMERA & SELECTOR LOGIC ---
    async function getCameras() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoSourceSelect.innerHTML = '';
        devices.filter(d => d.kind === 'videoinput').forEach(device => {
            const opt = document.createElement('option');
            opt.value = device.deviceId;
            opt.text = device.label || `Camera ${videoSourceSelect.length + 1}`;
            videoSourceSelect.appendChild(opt);
        });
    }

    async function startCamera(deviceId) {
        if (stream) stream.getTracks().forEach(t => t.stop());
        const constraints = { video: { deviceId: deviceId ? { exact: deviceId } : undefined } };
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;

            if (videoSourceSelect.options.length === 0) await getCameras();

            video.onloadedmetadata = () => {
                isScanning = true;
                startAutoScan();
            };
        } catch (err) { alert("Camera access failed."); }
    }

    scanIsbnBtn.addEventListener('click', () => {
        cameraModal.style.display = 'flex';
        startCamera();
    });

    videoSourceSelect.addEventListener('change', () => startCamera(videoSourceSelect.value));

    const stopCamera = () => {
        isScanning = false;
        clearTimeout(scanTimeout);
        if (stream) stream.getTracks().forEach(t => t.stop());
        cameraModal.style.display = 'none';
        captureBtn.innerText = "Capture";
        captureBtn.disabled = false;
    };

    closeCameraBtn.addEventListener('click', stopCamera);
});