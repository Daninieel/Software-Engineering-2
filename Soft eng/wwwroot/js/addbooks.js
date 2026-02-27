document.addEventListener('DOMContentLoaded', () => {
    const GOOGLE_API_KEY = 'AIzaSyCKBTEr-lRyt7BokJofqH-L18tjHbOpWLk';

    const videoSourceSelect = document.getElementById('videoSource');
    const scanIsbnBtn = document.getElementById('scanIsbnBtn');
    const cameraModal = document.getElementById('cameraModal');
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('captureBtn');
    const closeCameraBtn = document.getElementById('closeCameraBtn');
    const fileUpload = document.getElementById('fileUpload');
    const searchIsbnBtn = document.getElementById('searchIsbnBtn');
    const isbnValidation = document.getElementById('isbnValidation');
    const coverScanModal = document.getElementById('coverScanModal');
    const coverCanvas = document.getElementById('coverCanvas');
    const coverCanvasContainer = document.getElementById('coverImageContainer');
    const detectedTextList = document.getElementById('detectedTextList');
    const applyFieldsBtn = document.getElementById('applyFieldsBtn');
    const cancelCoverScanBtn = document.getElementById('cancelCoverScanBtn');
    const toggleSideBtn = document.getElementById('toggleSideBtn');

    const isbnInput = document.querySelector('input[name="ISBN"]');
    const titleInput = document.querySelector('input[name="BookTitle"]');
    const authorInput = document.querySelector('input[name="Author"]');
    const pagesInput = document.querySelector('input[name="Pages"]');
    const yearInput = document.querySelector('input[name="Year"]');
    const publisherInput = document.querySelector('input[name="Publisher"]');
    const remarksInput = document.querySelector('textarea[name="Remarks"]');

    let stream = null;
    let isScanning = false;
    let selectedFields = { title: '', author: '', publisher: '', edition: '', year: '' };
    let allDetections = [];
    let currentSide = 'front';
    let frontImage = null;
    let backImage = null;
    let isDesktopCamera = false;

    let zoomLevel = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let lastPanX = 0;
    let lastPanY = 0;
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let tempCanvasRef = null;

    let isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let mobileMode = 'draw';
    let lastTouchDistance = 0;
    let mobileToggleBtn = null;

    let codeReader = null;
    let scanningInterval = null;
    let detectionHistory = [];
    const CONFIRMATION_THRESHOLD = 1;
    const SCAN_INTERVAL = 600;

    let preprocessCanvas = null;
    let preprocessCtx = null;

    // ── ZXing ────────────────────────────────────────────────────────

    async function initializeZXing() {
        if (codeReader) return true;
        try {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@zxing/library@latest';
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            await new Promise(resolve => setTimeout(resolve, 100));
            if (window.ZXing) {
                codeReader = new ZXing.BrowserMultiFormatReader();
                console.log('✓ ZXing initialized successfully');
                return true;
            } else {
                throw new Error('ZXing not loaded');
            }
        } catch (err) {
            console.error('✗ Failed to initialize ZXing:', err);
            showValidation('Scanner initialization failed. Please refresh the page.', 'error');
            return false;
        }
    }

    initializeZXing();

    // ── Preprocessing helpers ────────────────────────────────────────

    function initializePreprocessCanvas() {
        if (!preprocessCanvas) {
            preprocessCanvas = document.createElement('canvas');
            preprocessCtx = preprocessCanvas.getContext('2d', { willReadFrequently: true });
        }
    }

    function captureVideoFrame() {
        initializePreprocessCanvas();
        preprocessCanvas.width = video.videoWidth;
        preprocessCanvas.height = video.videoHeight;
        preprocessCtx.save();
        if (isDesktopCamera) {
            preprocessCtx.translate(preprocessCanvas.width, 0);
            preprocessCtx.scale(-1, 1);
        }
        preprocessCtx.drawImage(video, 0, 0);
        preprocessCtx.restore();
        return preprocessCanvas;
    }

    function cloneCanvas(original) {
        const clone = document.createElement('canvas');
        clone.width = original.width;
        clone.height = original.height;
        clone.getContext('2d').drawImage(original, 0, 0);
        return clone;
    }

    function toGrayscale(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function enhanceContrast(canvas, factor = 1.5) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
            data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
            data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function adaptiveThreshold(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) histogram[data[i]]++;
        const total = data.length / 4;
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * histogram[i];
        let sumB = 0, wB = 0, maxVariance = 0, threshold = 128;
        for (let i = 0; i < 256; i++) {
            wB += histogram[i];
            if (wB === 0) continue;
            const wF = total - wB;
            if (wF === 0) break;
            sumB += i * histogram[i];
            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;
            const variance = wB * wF * (mB - mF) ** 2;
            if (variance > maxVariance) { maxVariance = variance; threshold = i; }
        }
        for (let i = 0; i < data.length; i += 4) {
            const val = data[i] < threshold ? 0 : 255;
            data[i] = data[i + 1] = data[i + 2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function sharpen(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
        const output = new Uint8ClampedArray(data);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            const kernelIdx = (ky + 1) * 3 + (kx + 1);
                            sum += data[idx] * kernel[kernelIdx];
                        }
                    }
                    const idx = (y * width + x) * 4 + c;
                    output[idx] = Math.max(0, Math.min(255, sum));
                }
            }
        }
        const newImageData = ctx.createImageData(width, height);
        newImageData.data.set(output);
        ctx.putImageData(newImageData, 0, 0);
        return canvas;
    }

    function gaussianBlur(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.filter = 'blur(1px)';
        tempCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
        return canvas;
    }

    function invertColors(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function cropToCenter(canvas, widthPercent = 0.8, heightPercent = 0.5) {
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        const cropWidth = canvas.width * widthPercent;
        const cropHeight = canvas.height * heightPercent;
        const x = (canvas.width - cropWidth) / 2;
        const y = (canvas.height - cropHeight) / 2;
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;
        cropCtx.drawImage(canvas, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        return cropCanvas;
    }

    function clahe(canvas, tileSize = 32, clipLimit = 3.0) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const { width, height } = canvas;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const gray = new Float32Array(width * height);
        for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4];

        const tilesX = Math.ceil(width / tileSize);
        const tilesY = Math.ceil(height / tileSize);
        const luts = [];

        for (let ty = 0; ty < tilesY; ty++) {
            luts[ty] = [];
            for (let tx = 0; tx < tilesX; tx++) {
                const x0 = tx * tileSize, x1 = Math.min(x0 + tileSize, width);
                const y0 = ty * tileSize, y1 = Math.min(y0 + tileSize, height);
                const n = (x1 - x0) * (y1 - y0);

                const hist = new Float32Array(256);
                for (let py = y0; py < y1; py++)
                    for (let px = x0; px < x1; px++)
                        hist[Math.round(gray[py * width + px])]++;

                const excess = clipLimit * (n / 256);
                let redistribute = 0;
                for (let i = 0; i < 256; i++) {
                    if (hist[i] > excess) { redistribute += hist[i] - excess; hist[i] = excess; }
                }
                const perBin = redistribute / 256;
                for (let i = 0; i < 256; i++) hist[i] += perBin;

                const lut = new Uint8Array(256);
                let cdf = 0, cdfMin = -1;
                for (let i = 0; i < 256; i++) {
                    cdf += hist[i];
                    if (cdfMin < 0 && cdf > 0) cdfMin = cdf;
                    lut[i] = Math.round(((cdf - cdfMin) / (n - cdfMin)) * 255);
                }
                luts[ty][tx] = lut;
            }
        }

        const result = new Uint8ClampedArray(data.length);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const v = Math.round(gray[y * width + x]);
                const txf = (x / tileSize) - 0.5;
                const tyf = (y / tileSize) - 0.5;
                const tx0 = Math.max(0, Math.floor(txf));
                const ty0 = Math.max(0, Math.floor(tyf));
                const tx1 = Math.min(tilesX - 1, tx0 + 1);
                const ty1 = Math.min(tilesY - 1, ty0 + 1);
                const wx = Math.max(0, Math.min(1, txf - tx0));
                const wy = Math.max(0, Math.min(1, tyf - ty0));
                const mapped = Math.round(
                    luts[ty0][tx0][v] * (1 - wx) * (1 - wy) +
                    luts[ty0][tx1][v] * wx * (1 - wy) +
                    luts[ty1][tx0][v] * (1 - wx) * wy +
                    luts[ty1][tx1][v] * wx * wy
                );
                const idx = (y * width + x) * 4;
                result[idx] = result[idx + 1] = result[idx + 2] = mapped;
                result[idx + 3] = 255;
            }
        }
        imageData.data.set(result);
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function sobel(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const { width, height } = canvas;
        const src = ctx.getImageData(0, 0, width, height).data;
        const out = new Uint8ClampedArray(src.length);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const tl = src[((y - 1) * width + (x - 1)) * 4], tc = src[((y - 1) * width + x) * 4], tr = src[((y - 1) * width + (x + 1)) * 4];
                const ml = src[(y * width + (x - 1)) * 4], mr = src[(y * width + (x + 1)) * 4];
                const bl = src[((y + 1) * width + (x - 1)) * 4], bc = src[((y + 1) * width + x) * 4], br = src[((y + 1) * width + (x + 1)) * 4];
                const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
                const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
                const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy));
                const i = (y * width + x) * 4;
                out[i] = out[i + 1] = out[i + 2] = mag;
                out[i + 3] = 255;
            }
        }
        const imageData = ctx.createImageData(width, height);
        imageData.data.set(out);
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    function _morphOp(canvas, op, kernelSize) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const { width, height } = canvas;
        const src = ctx.getImageData(0, 0, width, height).data;
        const out = new Uint8ClampedArray(src.length);
        const half = Math.floor(kernelSize / 2);
        const pick = op === 'dilate' ? Math.max : Math.min;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let val = op === 'dilate' ? 0 : 255;
                for (let ky = -half; ky <= half; ky++) {
                    for (let kx = -half; kx <= half; kx++) {
                        const ny = Math.max(0, Math.min(height - 1, y + ky));
                        const nx = Math.max(0, Math.min(width - 1, x + kx));
                        val = pick(val, src[(ny * width + nx) * 4]);
                    }
                }
                const i = (y * width + x) * 4;
                out[i] = out[i + 1] = out[i + 2] = val;
                out[i + 3] = 255;
            }
        }
        const imageData = ctx.createImageData(width, height);
        imageData.data.set(out);
        ctx.putImageData(imageData, 0, 0);
    }

    function morphClose(canvas, kernelSize = 3) {
        _morphOp(canvas, 'dilate', kernelSize);
        _morphOp(canvas, 'erode', kernelSize);
        return canvas;
    }

    function upscale(canvas, factor = 2) {
        const out = document.createElement('canvas');
        out.width = canvas.width * factor;
        out.height = canvas.height * factor;
        const ctx = out.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, out.width, out.height);
        return out;
    }

    // Convert canvas to HTMLImageElement then decode — the most reliable ZXing path
    function decodeCanvas(canvas) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                codeReader.decodeFromImageElement(img).then(resolve).catch(reject);
            };
            img.onerror = reject;
            img.src = canvas.toDataURL('image/png');
        });
    }

    async function scanWithPreprocessing() {
        if (!isScanning || !video.videoWidth || !video.videoHeight) return null;

        const rawFrame = captureVideoFrame();

        // Build all processed canvases
        const variants = [
            { name: 'raw', get: () => cloneCanvas(rawFrame) },
            { name: 'grayscale', get: () => { const c = cloneCanvas(rawFrame); return toGrayscale(c); } },
            { name: 'otsu', get: () => { const c = cloneCanvas(rawFrame); toGrayscale(c); return adaptiveThreshold(c); } },
            { name: 'clahe', get: () => { const c = cloneCanvas(rawFrame); toGrayscale(c); return clahe(c, 32, 3.0); } },
            { name: 'contrast', get: () => { const c = cloneCanvas(rawFrame); toGrayscale(c); return enhanceContrast(c, 1.8); } },
            { name: 'morph', get: () => { const c = cloneCanvas(rawFrame); toGrayscale(c); adaptiveThreshold(c); return morphClose(c, 3); } },
            { name: 'inverted', get: () => { const c = cloneCanvas(rawFrame); toGrayscale(c); adaptiveThreshold(c); return invertColors(c); } },
            { name: 'sharpen', get: () => { const c = cloneCanvas(rawFrame); toGrayscale(c); sharpen(c); return enhanceContrast(c, 1.5); } },
            { name: 'blur+otsu', get: () => { const c = cloneCanvas(rawFrame); toGrayscale(c); gaussianBlur(c); return adaptiveThreshold(c); } },
            { name: 'cropped', get: () => { const c = cloneCanvas(rawFrame); const cr = cropToCenter(c, 0.8, 0.4); toGrayscale(cr); return enhanceContrast(cr, 2.0); } },
            { name: 'aggressive', get: () => { const c = cloneCanvas(rawFrame); toGrayscale(c); gaussianBlur(c); sharpen(c); enhanceContrast(c, 2.2); return adaptiveThreshold(c); } },
            { name: 'upscale2x', get: () => upscale(cloneCanvas(rawFrame), 2) },
            { name: 'upscale2x+clahe', get: () => { const up = upscale(cloneCanvas(rawFrame), 2); toGrayscale(up); return clahe(up, 32, 3.0); } },
            { name: 'sobel', get: () => { const c = cloneCanvas(rawFrame); toGrayscale(c); return sobel(c); } },
            { name: 'gaussian', get: () => { const c = cloneCanvas(rawFrame); toGrayscale(c); return gaussianBlur(c); } },
        ];

        // Race all strategies in parallel — first valid ISBN wins
        const racePromises = variants.map(v =>
            new Promise((resolve, reject) => {
                let canvas;
                try { canvas = v.get(); } catch { return reject(); }
                decodeCanvas(canvas)
                    .then(result => {
                        const isbn = extractIsbnFromBarcode(result.getText());
                        if (isbn) { console.log(`✓ ISBN via strategy: ${v.name}`); resolve(isbn); }
                        else reject();
                    })
                    .catch(reject);
            })
        );

        try {
            return await Promise.any(racePromises);
        } catch {
            return null;
        }
    }

    function extractIsbnFromBarcode(barcode) {
        const cleaned = barcode.replace(/[^0-9X]/gi, '');
        const isbn13Match = cleaned.match(/^(978|979)\d{10}$/);
        if (isbn13Match) return isbn13Match[0];
        const isbn10Match = cleaned.match(/^\d{9}[0-9X]$/i);
        if (isbn10Match) return isbn10Match[0];
        return null;
    }

    // ── Continuous scanning ──────────────────────────────────────────

    let scanHandled = false;

    function startContinuousScanning() {
        if (!codeReader || !isScanning) return;
        scanHandled = false;
        createScanningIndicator();

        let attemptCount = 0;

        scanningInterval = setInterval(async () => {
            if (!isScanning || scanHandled) {
                clearInterval(scanningInterval);
                return;
            }

            attemptCount++;
            updateScanningIndicator(`🔍 Scanning... (attempt ${attemptCount})`);

            const isbn = await scanWithPreprocessing();

            if (isbn) {
                addToDetectionHistory(isbn);

                const confirmedIsbn = getConfirmedIsbn();
                if (confirmedIsbn && !scanHandled) {
                    scanHandled = true;
                    console.log('✓ ISBN CONFIRMED:', confirmedIsbn);
                    await handleSuccessfulScan(confirmedIsbn);
                } else if (!scanHandled) {
                    updateScanningIndicator(`📖 Detected: ${isbn} (confirming...)`);
                }
            }
        }, SCAN_INTERVAL);
    }

    function addToDetectionHistory(isbn) {
        const now = Date.now();
        detectionHistory = detectionHistory.filter(d => now - d.time < 2000);
        detectionHistory.push({ isbn, time: now });
        console.log(`Detection history: ${detectionHistory.map(d => d.isbn).join(', ')}`);
    }

    function getConfirmedIsbn() {
        if (detectionHistory.length < CONFIRMATION_THRESHOLD) return null;
        const counts = {};
        detectionHistory.forEach(d => { counts[d.isbn] = (counts[d.isbn] || 0) + 1; });
        for (const [isbn, count] of Object.entries(counts)) {
            if (count >= CONFIRMATION_THRESHOLD) return isbn;
        }
        return null;
    }

    async function handleSuccessfulScan(isbn) {
        stopCamera();
        isbnInput.value = isbn;
        showValidation('📖 ISBN detected! Loading book details...', 'success');
        const success = await fetchBookData(isbn);
        if (success) {
            showValidation('✓ Book details loaded successfully!', 'success');
            highlightFilledFields();
        } else {
            showValidation('ISBN found but no book data available. Enter details manually.', 'info');
        }
    }

    // ── UI feedback ──────────────────────────────────────────────────

    function createScanningIndicator() {
        const old = document.getElementById('scanningIndicator');
        if (old) old.remove();

        const indicator = document.createElement('div');
        indicator.id = 'scanningIndicator';
        indicator.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(46, 204, 113, 0.95);
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            font-weight: bold;
            font-size: 16px;
            z-index: 1000;
            box-shadow: 0 4px 15px rgba(46, 204, 113, 0.4);
            animation: pulse 1.5s ease-in-out infinite;
        `;
        indicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="scanner-beam"></div>
                <span>🔍 Scanning for ISBN...</span>
            </div>
        `;
        cameraModal.appendChild(indicator);

        if (!document.getElementById('scannerStyles')) {
            const style = document.createElement('style');
            style.id = 'scannerStyles';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                .scanner-beam {
                    width: 20px;
                    height: 20px;
                    border: 3px solid white;
                    border-radius: 4px;
                    border-left-color: transparent;
                    border-right-color: transparent;
                    animation: rotate 1s linear infinite;
                }
                @keyframes rotate {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    function updateScanningIndicator(message) {
        const indicator = document.getElementById('scanningIndicator');
        if (indicator) {
            const span = indicator.querySelector('span');
            if (span) span.textContent = message;
        }
    }

    function removeScanningIndicator() {
        const indicator = document.getElementById('scanningIndicator');
        if (indicator) indicator.remove();
    }

    function highlightFilledFields() {
        [titleInput, authorInput, publisherInput, pagesInput].forEach(el => {
            if (el?.value) {
                const originalBorder = el.style.borderColor;
                el.style.borderColor = '#27ae60';
                el.style.transition = 'border-color 0.3s ease';
                setTimeout(() => {
                    el.style.borderColor = originalBorder || '';
                }, 2000);
            }
        });
    }

    // ── Camera ───────────────────────────────────────────────────────

    async function getCameras() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoSourceSelect.innerHTML = '';
        devices.filter(d => d.kind === 'videoinput').forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.text = d.label || `Camera ${videoSourceSelect.length + 1}`;
            videoSourceSelect.appendChild(opt);
        });
    }

    async function startCamera(deviceId = null) {
        const initialized = await initializeZXing();
        if (!initialized) return;

        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
        }

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        isDesktopCamera = !isMobile;

        // Check if any camera device exists first
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(d => d.kind === 'videoinput');
            if (cameras.length === 0) {
                showNoCameraFallback();
                return;
            }
        } catch (_) { }

        // Fallback chain: try best quality first, relax on each failure
        const constraintOptions = [];

        if (deviceId) {
            constraintOptions.push(
                { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } },
                { video: { deviceId: { exact: deviceId } } }
            );
        } else if (isMobile) {
            constraintOptions.push(
                { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
                { video: { facingMode: { ideal: 'environment' } } },
                { video: true }
            );
        } else {
            constraintOptions.push(
                { video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
                { video: true }
            );
        }

        let lastErr = null;
        for (const constraints of constraintOptions) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                break;
            } catch (err) {
                lastErr = err;
                console.warn('Camera constraint failed, trying fallback:', err.message);
                stream = null;
            }
        }

        if (!stream) {
            console.error('Camera error:', lastErr);
            const name = lastErr?.name || '';
            if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
                showNoCameraFallback();
            } else if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
                showValidation('Camera permission denied. Allow camera access in your browser settings.', 'error');
                cameraModal.style.display = 'none';
            } else {
                showValidation(`Camera unavailable (${name || lastErr?.message || 'unknown error'}).`, 'error');
                cameraModal.style.display = 'none';
            }
            return;
        }

        video.srcObject = stream;
        video.style.transform = isDesktopCamera ? 'scaleX(-1)' : 'scaleX(1)';

        if (videoSourceSelect.options.length === 0) {
            await getCameras();
        }

        video.onloadedmetadata = () => {
            video.play().then(() => {
                isScanning = true;
                detectionHistory = [];
                startContinuousScanning();
            }).catch(err => {
                console.error('video.play() failed:', err);
                showValidation('Could not start video preview.', 'error');
            });
        };
    }

    function showNoCameraFallback() {
        // Keep modal open but replace video with a helpful message + manual ISBN entry
        const videoWrapper = video.parentElement || cameraModal;
        video.style.display = 'none';

        const existing = document.getElementById('noCameraMsg');
        if (existing) existing.remove();

        const msg = document.createElement('div');
        msg.id = 'noCameraMsg';
        msg.style.cssText = `
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 16px; padding: 40px 30px; color: #fff; text-align: center;
        `;
        msg.innerHTML = `
            <div style="font-size:56px;">📷</div>
            <div style="font-size:18px; font-weight:bold;">No camera detected</div>
            <div style="font-size:14px; opacity:0.85; max-width:320px;">
                Connect a webcam or use one of the options below to look up a book by ISBN.
            </div>
            <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-width:320px;">
                <div style="display:flex; gap:8px;">
                    <input id="noCameraIsbn" type="text" placeholder="Enter ISBN manually"
                        style="flex:1; padding:10px 14px; border-radius:8px; border:none; font-size:15px; outline:none;" />
                    <button id="noCameraSearch"
                        style="padding:10px 18px; background:#27ae60; color:#fff; border:none; border-radius:8px; font-size:15px; cursor:pointer; font-weight:bold;">
                        Search
                    </button>
                </div>
                <button id="noCameraUpload"
                    style="padding:10px; background:#3498db; color:#fff; border:none; border-radius:8px; font-size:14px; cursor:pointer;">
                    📁 Upload barcode image
                </button>
            </div>
        `;
        videoWrapper.appendChild(msg);

        document.getElementById('noCameraSearch').addEventListener('click', async () => {
            const val = document.getElementById('noCameraIsbn').value.trim();
            if (!val) return;
            if (!isValidIsbn(val)) {
                alert('Invalid ISBN format. Enter a 10 or 13 digit ISBN.');
                return;
            }
            document.getElementById('noCameraSearch').textContent = '...';
            document.getElementById('noCameraSearch').disabled = true;
            const cleaned = val.replace(/[^0-9X]/gi, '');
            isbnInput.value = cleaned;
            const success = await fetchBookData(cleaned);
            stopCamera();
            video.style.display = '';
            if (success) {
                showValidation('✓ Book details loaded successfully!', 'success');
                highlightFilledFields();
            } else {
                showValidation('No book found for this ISBN.', 'error');
            }
        });

        document.getElementById('noCameraIsbn').addEventListener('keypress', e => {
            if (e.key === 'Enter') document.getElementById('noCameraSearch').click();
        });

        document.getElementById('noCameraUpload').addEventListener('click', () => {
            stopCamera();
            video.style.display = '';
            fileUpload.click();
        });

        console.warn('No camera found — showing manual fallback UI');
    }

    function stopCamera() {
        isScanning = false;
        detectionHistory = [];

        if (scanningInterval) {
            clearInterval(scanningInterval);
            scanningInterval = null;
        }

        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
        }

        removeScanningIndicator();
        cameraModal.style.display = 'none';
    }

    // ── Book data ────────────────────────────────────────────────────

    async function fetchBookData(isbn) {
        const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${GOOGLE_API_KEY}`;
        const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=details&format=json`;

        // Fire both requests simultaneously
        const [googleResult, olResult] = await Promise.allSettled([
            fetch(googleUrl).then(r => r.json()),
            fetch(olUrl).then(r => r.json())
        ]);

        let title = '', author = '', publisher = '', pages = '', date = '', desc = '';

        // Parse Google Books
        if (googleResult.status === 'fulfilled') {
            const data = googleResult.value;
            if (data.totalItems > 0) {
                const info = data.items[0].volumeInfo;
                title = info.title || '';
                author = info.authors?.join(', ') || '';
                publisher = info.publisher || '';
                pages = info.pageCount || '';
                date = info.publishedDate || '';
                desc = info.description || '';
                console.log('✓ Google Books hit');
            }
        }

        // Parse OpenLibrary — fill any gaps left by Google
        if (olResult.status === 'fulfilled') {
            const data = olResult.value;
            const key = `ISBN:${isbn}`;
            if (data[key]) {
                const d = data[key].details;
                if (!title) title = d.title || '';
                if (!author) author = d.authors?.map(a => a.name).join(', ') || '';
                if (!publisher) publisher = d.publishers?.[0] || '';
                if (!pages) pages = d.number_of_pages || '';
                if (!date) date = d.publish_date || '';
                console.log('✓ OpenLibrary hit');
            }
        }

        if (!title && !author && !publisher) {
            console.warn('✗ No book data found in either API for ISBN:', isbn);
            return false;
        }

        fillForm(title, author, publisher, pages, date, desc);
        return true;
    }

    function fillForm(title, author, publisher, pages, date, desc) {
        if (title) titleInput.value = title;
        if (author) authorInput.value = author;
        if (publisher) publisherInput.value = publisher;
        if (pages) pagesInput.value = pages;
        if (date) {
            const y = date.match(/\d{4}/);
            if (y) yearInput.value = `${y[0]}-01-01`;
        }
        if (desc) remarksInput.value = desc.substring(0, 600);
    }

    // ── Validation ───────────────────────────────────────────────────

    function isValidIsbn(val) {
        const clean = val.replace(/[^0-9X]/gi, '');
        return (/^\d{9}[0-9X]$/i.test(clean) || /^(978|979)\d{10}$/.test(clean));
    }

    function showValidation(msg, type = 'info') {
        if (!isbnValidation) return;
        isbnValidation.textContent = msg;
        isbnValidation.className = `validation-message ${type}`;
        if (type !== 'error') {
            setTimeout(() => {
                isbnValidation.textContent = '';
                isbnValidation.className = 'validation-message';
            }, 5000);
        }
    }

    // ── Book cover OCR preprocessing ─────────────────────────────────

    function calculateOtsuThreshold(data) {
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) histogram[data[i]]++;
        const total = data.length / 4;
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * histogram[i];
        let sumB = 0, wB = 0, maxVariance = 0, threshold = 128;
        for (let i = 0; i < 256; i++) {
            wB += histogram[i];
            if (wB === 0) continue;
            const wF = total - wB;
            if (wF === 0) break;
            sumB += i * histogram[i];
            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;
            const variance = wB * wF * (mB - mF) ** 2;
            if (variance > maxVariance) { maxVariance = variance; threshold = i; }
        }
        return threshold;
    }

    function preprocessForBookCoverOCR(sourceCanvas) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 3;
        canvas.width = sourceCanvas.width * scale;
        canvas.height = sourceCanvas.height * scale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

        let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            let gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            if (sat > 0.35) gray *= 1.12;
            gray = Math.max(0, Math.min(255, Math.round(gray)));
            data[i] = data[i + 1] = data[i + 2] = gray;
        }

        const threshold = calculateOtsuThreshold(data);
        for (let i = 0; i < data.length; i += 4) {
            const val = data[i] < threshold ? 0 : 255;
            data[i] = data[i + 1] = data[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    // ── Cover canvas interactions ────────────────────────────────────

    function applyTransform() {
        const ctx = coverCanvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, coverCanvas.width, coverCanvas.height);

        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(zoomLevel, zoomLevel);

        const img = currentSide === 'front' ? frontImage : backImage;
        if (img) ctx.drawImage(img, 0, 0);

        allDetections.filter(d => d.side === currentSide).forEach((d, i) => {
            const { x0, y0, x1, y1 } = d.bbox;
            ctx.strokeStyle = '#27ae60';
            ctx.lineWidth = 3 / zoomLevel;
            ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
            ctx.fillStyle = 'rgba(39,174,96,0.18)';
            ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

            const radius = 16 / zoomLevel;
            ctx.fillStyle = '#27ae60';
            ctx.beginPath();
            ctx.arc(x0 + 20 / zoomLevel, y0 + 20 / zoomLevel, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = `${16 / zoomLevel}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i + 1, x0 + 20 / zoomLevel, y0 + 20 / zoomLevel);
        });

        ctx.restore();
    }

    function redrawCanvas() {
        applyTransform();
    }

    function getTouchPos(touch) {
        const rect = coverCanvas.getBoundingClientRect();
        const scaleX = coverCanvas.width / rect.width;
        const scaleY = coverCanvas.height / rect.height;
        return {
            x: (touch.clientX - rect.left) * scaleX,
            y: (touch.clientY - rect.top) * scaleY,
            clientX: touch.clientX,
            clientY: touch.clientY
        };
    }

    function getTouchDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    coverCanvas.addEventListener('wheel', e => {
        e.preventDefault();
        if (!coverCanvasContainer) return;

        const rect = coverCanvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / zoomLevel + panX;
        const mouseY = (e.clientY - rect.top) / zoomLevel + panY;

        const oldZoom = zoomLevel;
        zoomLevel = Math.max(0.5, Math.min(5, zoomLevel * (e.deltaY > 0 ? 0.88 : 1.13)));

        panX = mouseX - (mouseX - panX) * (zoomLevel / oldZoom);
        panY = mouseY - (mouseY - panY) * (zoomLevel / oldZoom);

        applyTransform();
    }, { passive: false });

    coverCanvas.addEventListener('mousedown', e => {
        if (e.button !== 0) return;

        if (e.shiftKey) {
            isPanning = true;
            lastPanX = e.clientX;
            lastPanY = e.clientY;
            coverCanvas.style.cursor = 'grabbing';
            return;
        }

        const rect = coverCanvas.getBoundingClientRect();
        const scaleX = coverCanvas.width / rect.width;
        const scaleY = coverCanvas.height / rect.height;

        startX = (e.clientX - rect.left) * scaleX;
        startY = (e.clientY - rect.top) * scaleY;
        isDrawing = true;

        tempCanvasRef = document.createElement('canvas');
        tempCanvasRef.width = coverCanvas.width;
        tempCanvasRef.height = coverCanvas.height;
        tempCanvasRef.getContext('2d').drawImage(coverCanvas, 0, 0);
    });

    coverCanvas.addEventListener('mousemove', e => {
        if (isPanning) {
            const dx = e.clientX - lastPanX;
            const dy = e.clientY - lastPanY;
            panX += dx / zoomLevel;
            panY += dy / zoomLevel;
            lastPanX = e.clientX;
            lastPanY = e.clientY;
            applyTransform();
            return;
        }

        if (!isDrawing) {
            coverCanvas.style.cursor = e.shiftKey ? 'grab' : 'crosshair';
            return;
        }

        const rect = coverCanvas.getBoundingClientRect();
        const scaleX = coverCanvas.width / rect.width;
        const scaleY = coverCanvas.height / rect.height;

        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;

        const ctx = coverCanvas.getContext('2d');
        ctx.drawImage(tempCanvasRef, 0, 0);
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        ctx.fillStyle = 'rgba(52,152,219,0.12)';
        ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
        ctx.setLineDash([]);
    });

    coverCanvas.addEventListener('mouseup', async e => {
        if (isPanning) {
            isPanning = false;
            coverCanvas.style.cursor = 'crosshair';
            return;
        }
        if (!isDrawing) return;
        isDrawing = false;

        const rect = coverCanvas.getBoundingClientRect();
        const scaleX = coverCanvas.width / rect.width;
        const scaleY = coverCanvas.height / rect.height;

        const endX = (e.clientX - rect.left) * scaleX;
        const endY = (e.clientY - rect.top) * scaleY;

        await processSelection(startX, startY, endX, endY);
    });

    coverCanvas.addEventListener('touchstart', e => {
        e.preventDefault();
        const touches = e.touches;

        if (touches.length === 2) {
            lastTouchDistance = getTouchDistance(touches[0], touches[1]);
            isPanning = false;
            isDrawing = false;
            return;
        }

        if (touches.length === 1) {
            const pos = getTouchPos(touches[0]);
            if (mobileMode === 'pan') {
                isPanning = true;
                lastPanX = pos.clientX;
                lastPanY = pos.clientY;
                updateMobileCursor();
            } else {
                startX = pos.x;
                startY = pos.y;
                isDrawing = true;
                tempCanvasRef = document.createElement('canvas');
                tempCanvasRef.width = coverCanvas.width;
                tempCanvasRef.height = coverCanvas.height;
                tempCanvasRef.getContext('2d').drawImage(coverCanvas, 0, 0);
            }
        }
    }, { passive: false });

    coverCanvas.addEventListener('touchmove', e => {
        e.preventDefault();
        const touches = e.touches;

        if (touches.length === 2 && lastTouchDistance > 0) {
            const currentDistance = getTouchDistance(touches[0], touches[1]);
            const scaleFactor = currentDistance / lastTouchDistance;
            const rect = coverCanvas.getBoundingClientRect();
            const centerX = (touches[0].clientX + touches[1].clientX) / 2;
            const centerY = (touches[0].clientY + touches[1].clientY) / 2;
            const mouseX = (centerX - rect.left) / zoomLevel + panX;
            const mouseY = (centerY - rect.top) / zoomLevel + panY;
            const oldZoom = zoomLevel;
            zoomLevel = Math.max(0.5, Math.min(5, zoomLevel * scaleFactor));
            panX = mouseX - (mouseX - panX) * (zoomLevel / oldZoom);
            panY = mouseY - (mouseY - panY) * (zoomLevel / oldZoom);
            lastTouchDistance = currentDistance;
            applyTransform();
            return;
        }

        if (touches.length === 1) {
            const pos = getTouchPos(touches[0]);

            if (isPanning) {
                const dx = pos.clientX - lastPanX;
                const dy = pos.clientY - lastPanY;
                panX += dx / zoomLevel;
                panY += dy / zoomLevel;
                lastPanX = pos.clientX;
                lastPanY = pos.clientY;
                applyTransform();
                return;
            }

            if (isDrawing) {
                const currentX = pos.x;
                const currentY = pos.y;
                const ctx = coverCanvas.getContext('2d');
                ctx.drawImage(tempCanvasRef, 0, 0);
                ctx.strokeStyle = '#3498db';
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
                ctx.fillStyle = 'rgba(52,152,219,0.12)';
                ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
                ctx.setLineDash([]);
            }
        }
    }, { passive: false });

    coverCanvas.addEventListener('touchend', async e => {
        e.preventDefault();

        if (e.touches.length < 2) {
            lastTouchDistance = 0;
        }

        if (isPanning) {
            isPanning = false;
            updateMobileCursor();
            return;
        }

        if (isDrawing) {
            isDrawing = false;
            const touch = e.changedTouches[0];
            const pos = getTouchPos(touch);
            const endX = pos.x;
            const endY = pos.y;
            await processSelection(startX, startY, endX, endY);
        }
    }, { passive: false });

    coverCanvas.addEventListener('contextmenu', e => {
        e.preventDefault();
    });

    async function processSelection(x1, y1, x2, y2) {
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);

        if (w < 20 || h < 12) {
            redrawCanvas();
            return;
        }

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = w;
        cropCanvas.height = h;
        cropCanvas.getContext('2d').drawImage(coverCanvas, x, y, w, h, 0, 0, w, h);

        const loading = document.createElement('div');
        loading.textContent = `Extracting text ${allDetections.filter(d => d.side === currentSide).length + 1}...`;
        loading.style.cssText = 'padding:12px; background:#e3f2fd; color:#3498db; border-radius:6px; text-align:center; margin:10px 0;';
        detectedTextList.appendChild(loading);

        try {
            const optimized = preprocessForBookCoverOCR(cropCanvas);
            const { data: { text } } = await Tesseract.recognize(
                optimized.toDataURL('image/png'),
                'eng',
                {
                    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
                    preserve_interword_spaces: '1',
                    user_defined_dpi: '300',
                    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;?!'\"-–()& "
                }
            );

            const cleaned = text
                .replace(/\n+/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();

            loading.remove();

            if (cleaned) {
                allDetections.push({
                    text: cleaned,
                    bbox: { x0: x, y0: y, x1: x + w, y1: y + h },
                    side: currentSide
                });
                redrawCanvas();
                populateDetectedTextList();
            } else {
                showTempMessage('No text detected', '#e74c3c', 3000);
                redrawCanvas();
            }
        } catch (err) {
            loading.remove();
            showTempMessage('OCR failed', '#e74c3c', 4000);
            redrawCanvas();
        }
    }

    function showTempMessage(msg, color, ms) {
        const div = document.createElement('div');
        div.textContent = msg;
        div.style.cssText = `padding:10px; color:white; background:${color}; border-radius:6px; margin:10px 0; text-align:center;`;
        detectedTextList.appendChild(div);
        setTimeout(() => div.remove(), ms);
    }

    function createMobileToggleButton() {
        if (!isMobileDevice || mobileToggleBtn) return;

        mobileToggleBtn = document.createElement('button');
        mobileToggleBtn.id = 'mobileToggleBtn';
        mobileToggleBtn.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 28px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            border-radius: 50px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            z-index: 10000;
            transition: all 0.3s ease;
            display: none;
            white-space: nowrap;
        `;
        mobileToggleBtn.innerHTML = '✏️ DRAW';

        mobileToggleBtn.addEventListener('click', () => {
            mobileMode = mobileMode === 'draw' ? 'pan' : 'draw';
            updateMobileCursor();
            if (mobileMode === 'draw') {
                mobileToggleBtn.innerHTML = '✏️ DRAW';
                mobileToggleBtn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
                mobileToggleBtn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            } else {
                mobileToggleBtn.innerHTML = '👆 PAN';
                mobileToggleBtn.style.background = 'linear-gradient(135deg, #f093fb, #f5576c)';
                mobileToggleBtn.style.boxShadow = '0 4px 15px rgba(240, 147, 251, 0.4)';
            }
        });

        document.body.appendChild(mobileToggleBtn);
    }

    function updateMobileCursor() {
        if (!isMobileDevice) return;
        if (mobileMode === 'draw') {
            coverCanvas.style.cursor = 'crosshair';
        } else {
            coverCanvas.style.cursor = isPanning ? 'grabbing' : 'grab';
        }
    }

    function populateDetectedTextList() {
        const items = allDetections.filter(d => d.side === currentSide);
        detectedTextList.innerHTML = '';

        if (items.length === 0) {
            const instructions = isMobileDevice
                ? 'Tap the button below to switch modes<br>DRAW mode: Drag to select text<br>PAN mode: Drag to move image<br>Pinch to zoom'
                : 'Draw rectangles around text areas<br>Shift+drag to pan • Scroll to zoom';
            detectedTextList.innerHTML = `
                <div style="text-align:center; padding:20px; color:#3498db;">
                    <b>${currentSide.toUpperCase()} COVER</b><br>
                    <small>${instructions}</small>
                </div>`;
            return;
        }

        const header = document.createElement('div');
        header.style.cssText = 'padding:12px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; font-weight:bold; border-radius:8px; text-align:center;';
        header.textContent = `${currentSide.toUpperCase()} COVER – ${items.length} region${items.length === 1 ? '' : 's'}`;
        detectedTextList.appendChild(header);

        items.forEach((det, idx) => {
            const div = document.createElement('div');
            div.className = 'text-item';
            div.style.cssText = 'margin:12px 0; padding:12px; border:2px solid #ddd; border-radius:8px; background:#f9f9f9;';

            const content = document.createElement('div');
            content.innerHTML = `
                <span style="background:#667eea; color:white; padding:3px 9px; border-radius:5px; margin-right:10px; font-size:13px;">${idx + 1}</span>
                <span class="editable" contenteditable="true">${det.text}</span>`;

            const editable = content.querySelector('.editable');
            editable.addEventListener('blur', () => {
                det.text = editable.textContent.trim();
            });

            const select = document.createElement('select');
            select.style.cssText = 'width:100%; padding:10px; margin-top:10px; border-radius:6px; border:1px solid #ddd; font-size:14px;';
            select.innerHTML = `
                <option value="none">-- Assign to field --</option>
                <option value="title">Book Title</option>
                <option value="author">Author</option>
                <option value="publisher">Publisher</option>
                <option value="edition">Edition</option>
                <option value="year">Year</option>`;
            select.addEventListener('change', e => {
                const val = e.target.value;
                updateSelectedField(val, det.text);
                div.style.borderColor = val !== 'none' ? '#27ae60' : '#ddd';
                div.style.background = val !== 'none' ? '#e8f5e9' : '#f9f9f9';
            });

            const delBtn = document.createElement('button');
            delBtn.textContent = 'Delete';
            delBtn.style.cssText = 'margin-top:10px; padding:8px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer; width:100%;';
            delBtn.onclick = () => {
                const i = allDetections.indexOf(det);
                if (i !== -1) {
                    allDetections.splice(i, 1);
                    redrawCanvas();
                    populateDetectedTextList();
                }
            };

            div.append(content, select, delBtn);
            detectedTextList.appendChild(div);
        });
    }

    function updateSelectedField(field, text) {
        Object.keys(selectedFields).forEach(k => {
            if (selectedFields[k] === text) selectedFields[k] = '';
        });
        if (field !== 'none') selectedFields[field] = text;
    }

    applyFieldsBtn.addEventListener('click', () => {
        if (selectedFields.title) titleInput.value = selectedFields.title;
        if (selectedFields.author) authorInput.value = selectedFields.author;
        if (selectedFields.publisher) publisherInput.value = selectedFields.publisher;
        if (selectedFields.edition) {
            const el = document.querySelector('input[name="Edition"]');
            if (el) el.value = selectedFields.edition;
        }
        if (selectedFields.year) {
            const y = selectedFields.year.match(/\d{4}/);
            if (y) yearInput.value = `${y[0]}-01-01`;
        }

        [titleInput, authorInput, publisherInput].forEach(el => {
            if (el?.value) {
                const old = el.style.borderColor;
                el.style.borderColor = '#27ae60';
                setTimeout(() => el.style.borderColor = old || '', 2200);
            }
        });

        alert('Selected fields applied to form!');
        coverScanModal.style.display = 'none';
        resetCoverScan();
    });

    function resetCoverScan() {
        allDetections = [];
        selectedFields = { title: '', author: '', publisher: '', edition: '', year: '' };
        zoomLevel = 1;
        panX = panY = 0;
        frontImage = backImage = null;
        detectedTextList.innerHTML = '';
        coverCanvas.getContext('2d').clearRect(0, 0, coverCanvas.width, coverCanvas.height);
        if (toggleSideBtn) toggleSideBtn.style.display = 'none';
        if (mobileToggleBtn) mobileToggleBtn.style.display = 'none';
        mobileMode = 'draw';
    }

    cancelCoverScanBtn.addEventListener('click', () => {
        coverScanModal.style.display = 'none';
        resetCoverScan();
    });

    function updateToggleButton() {
        if (!toggleSideBtn) return;
        if (frontImage && backImage) {
            toggleSideBtn.style.display = 'inline-block';
            toggleSideBtn.innerText = currentSide === 'front' ? 'Switch to Back Cover' : 'Switch to Front Cover';
        } else if (frontImage || backImage) {
            toggleSideBtn.style.display = 'inline-block';
            toggleSideBtn.innerText = frontImage ? 'Add Back Cover' : 'Add Front Cover';
        } else {
            toggleSideBtn.style.display = 'none';
        }
    }

    toggleSideBtn?.addEventListener('click', () => {
        if (frontImage && backImage) {
            currentSide = currentSide === 'front' ? 'back' : 'front';
            const img = currentSide === 'front' ? frontImage : backImage;
            coverCanvas.width = img.width;
            coverCanvas.height = img.height;
            zoomLevel = 1; panX = panY = 0;
            redrawCanvas();
            populateDetectedTextList();
            updateToggleButton();
        } else {
            fileUpload.click();
        }
    });

    async function processCoverImage(file, side) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                if (side === 'front') {
                    frontImage = img;
                    currentSide = 'front';
                } else {
                    backImage = img;
                    currentSide = 'back';
                }
                coverCanvas.width = img.width;
                coverCanvas.height = img.height;
                zoomLevel = 1;
                panX = panY = 0;
                redrawCanvas();

                const instructions = isMobileDevice
                    ? 'Tap button below to switch between DRAW and PAN modes'
                    : 'Draw boxes around text • Scroll = zoom • Shift+drag = pan';

                detectedTextList.innerHTML = `
                    <div style="text-align:center; padding:15px; color:#3498db; background:#e3f2fd; border-radius:8px;">
                        <b>${side.toUpperCase()} COVER LOADED</b><br>
                        <small>${instructions}</small>
                    </div>`;

                coverScanModal.style.display = 'flex';
                updateToggleButton();

                if (isMobileDevice && mobileToggleBtn) {
                    mobileToggleBtn.style.display = 'block';
                    updateMobileCursor();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // ── File upload ──────────────────────────────────────────────────

    async function tryBarcodeReaderFromImage(imageSource) {
        if (!codeReader) {
            console.log('→ ZXing not available, skipping barcode detection');
            return null;
        }

        try {
            console.log('🔍 Trying ZXing barcode reader on uploaded image...');

            let imageUrl;
            if (typeof imageSource === 'string') {
                imageUrl = imageSource;
            } else {
                imageUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(imageSource);
                });
            }

            const strategies = [
                { name: 'original', transform: null },
                { name: 'high-contrast', transform: applyHighContrastImage },
                { name: 'inverted', transform: invertColorsImage },
                { name: 'sharpened', transform: sharpenImageFile }
            ];

            for (const strategy of strategies) {
                try {
                    console.log(`  → Trying barcode read: ${strategy.name}`);
                    let processedUrl = imageUrl;
                    if (strategy.transform) {
                        processedUrl = await strategy.transform(imageUrl);
                    }
                    const result = await codeReader.decodeFromImageUrl(processedUrl);
                    if (result) {
                        const barcode = result.getText();
                        console.log(`  → Raw barcode: ${barcode}`);
                        const isbn = extractIsbnFromBarcode(barcode);
                        if (isbn) {
                            console.log(`  ✓ SUCCESS with ${strategy.name}: ${isbn}`);
                            return isbn;
                        }
                    }
                } catch (err) {
                    // Continue to next strategy
                }
            }

            console.log('  ✗ ZXing barcode reader found no ISBN');
            return null;
        } catch (err) {
            console.log('  ✗ ZXing error:', err.message);
            return null;
        }
    }

    async function applyHighContrastImage(imageUrl) {
        return transformImageFile(imageUrl, (ctx, canvas) => {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                const val = avg > 127 ? 255 : 0;
                data[i] = data[i + 1] = data[i + 2] = val;
            }
            ctx.putImageData(imgData, 0, 0);
        });
    }

    async function invertColorsImage(imageUrl) {
        return transformImageFile(imageUrl, (ctx, canvas) => {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];
                data[i + 1] = 255 - data[i + 1];
                data[i + 2] = 255 - data[i + 2];
            }
            ctx.putImageData(imgData, 0, 0);
        });
    }

    async function sharpenImageFile(imageUrl) {
        return transformImageFile(imageUrl, (ctx, canvas) => {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            const width = canvas.width;
            const height = canvas.height;
            const output = new Uint8ClampedArray(data);
            const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    for (let c = 0; c < 3; c++) {
                        let sum = 0;
                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                                const kernelIdx = (ky + 1) * 3 + (kx + 1);
                                sum += data[idx] * kernel[kernelIdx];
                            }
                        }
                        const idx = (y * width + x) * 4 + c;
                        output[idx] = Math.max(0, Math.min(255, sum));
                    }
                }
            }
            const newImgData = ctx.createImageData(width, height);
            newImgData.data.set(output);
            ctx.putImageData(newImgData, 0, 0);
        });
    }

    async function transformImageFile(imageUrl, transformFn) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                transformFn(ctx, canvas);
                resolve(canvas.toDataURL('image/jpeg', 0.92));
            };
            img.src = imageUrl;
        });
    }

    fileUpload.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;

        while (true) {
            const isBarcode = confirm(
                'Is this an ISBN barcode scan?\nOK = Barcode/ISBN\nCancel = Book cover photo'
            );

            if (isBarcode) {
                const btn = document.querySelector('.btn-blue') || searchIsbnBtn;
                const orig = btn.innerText;
                btn.innerText = 'Scanning ISBN...';
                btn.disabled = true;

                const isbn = await tryBarcodeReaderFromImage(file);

                if (isbn) {
                    isbnInput.value = isbn;
                    const success = await fetchBookData(isbn);
                    alert(
                        success
                            ? '✓ Book details loaded successfully!'
                            : 'ISBN found but no match in database. Try entering details manually.'
                    );
                } else {
                    alert('✗ No valid ISBN detected.\n\nTips:\n• Ensure barcode is visible and in focus\n• Try better lighting\n• Hold camera steady\n• Or enter ISBN manually');
                }

                btn.innerText = orig;
                btn.disabled = false;
                break;
            } else {
                const isFront = confirm('OK = Front Cover\nCancel = Exit');
                if (isFront) {
                    await processCoverImage(file, 'front');
                    break;
                } else {
                    break;
                }
            }
        }

        fileUpload.value = '';
    });

    // ── Event listeners ──────────────────────────────────────────────

    scanIsbnBtn?.addEventListener('click', () => {
        cameraModal.style.display = 'flex';
        startCamera();
    });

    videoSourceSelect?.addEventListener('change', () => {
        if (isScanning) {
            startCamera(videoSourceSelect.value);
        }
    });

    closeCameraBtn?.addEventListener('click', stopCamera);

    if (captureBtn) {
        captureBtn.style.display = 'none';
    }

    searchIsbnBtn?.addEventListener('click', async () => {
        const val = isbnInput.value.trim();
        if (!val) return showValidation('Enter an ISBN', 'error');
        if (!isValidIsbn(val)) return showValidation('Invalid ISBN format', 'error');

        searchIsbnBtn.disabled = true;
        searchIsbnBtn.classList.add('loading');
        showValidation('Searching...', 'info');

        const cleaned = val.replace(/[^0-9X]/gi, '');
        const success = await fetchBookData(cleaned);

        if (success) {
            showValidation('Book found ✓', 'success');
            highlightFilledFields();
        } else {
            showValidation('No book found for this ISBN', 'error');
        }

        searchIsbnBtn.disabled = false;
        searchIsbnBtn.classList.remove('loading');
    });

    isbnInput?.addEventListener('input', e => {
        const v = e.target.value.trim();
        if (v && !isValidIsbn(v)) {
            showValidation('Invalid ISBN format', 'error');
        } else {
            isbnValidation.textContent = '';
            isbnValidation.className = 'validation-message';
        }
    });

    isbnInput?.addEventListener('keypress', e => {
        if (e.key === 'Enter') searchIsbnBtn?.click();
    });

    document.addEventListener('keydown', e => {
        if (coverScanModal.style.display === 'flex' && e.key === 'Shift') {
            coverCanvas.style.cursor = 'grab';
        }
    });

    document.addEventListener('keyup', e => {
        if (coverScanModal.style.display === 'flex' && e.key === 'Shift' && !isPanning) {
            coverCanvas.style.cursor = 'crosshair';
        }
    });

    if (isMobileDevice) {
        createMobileToggleButton();
    }
});
