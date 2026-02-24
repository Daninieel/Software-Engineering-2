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
    let scanTimeout = null;
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

    // Mobile-specific variables
    let isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let mobileMode = 'draw';
    let lastTouchDistance = 0;
    let mobileToggleBtn = null;

    // Initialize ZXing barcode reader
    let codeReader = null;

    async function initializeZXing() {
        if (!codeReader) {
            try {
                const { BrowserMultiFormatReader } = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@latest/umd/index.min.js');
                codeReader = new BrowserMultiFormatReader();
                console.log('✓ ZXing barcode reader initialized');
            } catch (err) {
                console.error('✗ Failed to load ZXing:', err);
                console.log('→ Will use OCR fallback only');
            }
        }
    }

    // Initialize on page load
    initializeZXing();

    // ═══════════════════════════════════════════════════════════════════
    // STAGE 1: ZXING BARCODE READER (Primary Method)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Try to read barcode using ZXing library
     * This is MUCH faster and more accurate than OCR
     */
    async function tryBarcodeReader(imageSource) {
        if (!codeReader) {
            console.log('→ ZXing not available, skipping barcode detection');
            return null;
        }

        try {
            console.log('🔍 Stage 1: Trying ZXing barcode reader...');

            let imageUrl;
            if (typeof imageSource === 'string') {
                imageUrl = imageSource;
            } else {
                // Convert File/Blob to data URL
                imageUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(imageSource);
                });
            }

            // Try multiple preprocessing for barcode reading
            const strategies = [
                { name: 'original', transform: null },
                { name: 'high-contrast', transform: applyHighContrast },
                { name: 'inverted', transform: invertColors },
                { name: 'sharpened', transform: sharpenImage }
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

                        // Extract ISBN from barcode text
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

    /**
     * Extract clean ISBN from barcode text
     */
    function extractIsbnFromBarcode(barcode) {
        const cleaned = barcode.replace(/[^0-9X]/gi, '');

        // Try ISBN-13 (978 or 979 prefix)
        const isbn13Match = cleaned.match(/^(978|979)\d{10}$/);
        if (isbn13Match) return isbn13Match[0];

        // Try ISBN-10
        const isbn10Match = cleaned.match(/^\d{9}[0-9X]$/i);
        if (isbn10Match) return isbn10Match[0];

        return null;
    }

    /**
     * Image transformations to help barcode reading
     */
    async function applyHighContrast(imageUrl) {
        return transformImage(imageUrl, (ctx, canvas) => {
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

    async function invertColors(imageUrl) {
        return transformImage(imageUrl, (ctx, canvas) => {
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

    async function sharpenImage(imageUrl) {
        return transformImage(imageUrl, (ctx, canvas) => {
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

    async function transformImage(imageUrl, transformFn) {
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

    // ═══════════════════════════════════════════════════════════════════
    // STAGE 2: OCR FALLBACK (When Barcode Reader Fails)
    // ═══════════════════════════════════════════════════════════════════

    function calculateOtsuThreshold(data) {
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) {
            histogram[data[i]]++;
        }
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
            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = i;
            }
        }
        return threshold;
    }

    function preprocessRaw(canvas) {
        return canvas;
    }

    function preprocessGrayscale(sourceCanvas) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        ctx.drawImage(sourceCanvas, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = gray;
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    function preprocessGaussian(sourceCanvas) {
        const canvas = preprocessGrayscale(sourceCanvas);
        const ctx = canvas.getContext('2d');

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.filter = 'blur(2px)';
        tempCtx.drawImage(canvas, 0, 0);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);

        return canvas;
    }

    function preprocessCLAHE(sourceCanvas) {
        const canvas = preprocessGrayscale(sourceCanvas);
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        const tileSize = 8;
        const clipLimit = 2.0;
        const width = canvas.width;
        const height = canvas.height;

        for (let ty = 0; ty < height; ty += tileSize) {
            for (let tx = 0; tx < width; tx += tileSize) {
                const histogram = new Array(256).fill(0);
                const tileW = Math.min(tileSize, width - tx);
                const tileH = Math.min(tileSize, height - ty);

                for (let y = ty; y < ty + tileH; y++) {
                    for (let x = tx; x < tx + tileW; x++) {
                        const idx = (y * width + x) * 4;
                        histogram[data[idx]]++;
                    }
                }

                const totalPixels = tileW * tileH;
                const clipValue = (clipLimit * totalPixels) / 256;
                let clipped = 0;
                for (let i = 0; i < 256; i++) {
                    if (histogram[i] > clipValue) {
                        clipped += histogram[i] - clipValue;
                        histogram[i] = clipValue;
                    }
                }
                const redistribute = clipped / 256;
                for (let i = 0; i < 256; i++) {
                    histogram[i] += redistribute;
                }

                const lut = new Array(256);
                let sum = 0;
                for (let i = 0; i < 256; i++) {
                    sum += histogram[i];
                    lut[i] = Math.round((sum / totalPixels) * 255);
                }

                for (let y = ty; y < ty + tileH; y++) {
                    for (let x = tx; x < tx + tileW; x++) {
                        const idx = (y * width + x) * 4;
                        const val = lut[data[idx]];
                        data[idx] = data[idx + 1] = data[idx + 2] = val;
                    }
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    function preprocessEdgeEnhance(sourceCanvas) {
        const canvas = preprocessGrayscale(sourceCanvas);
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const width = canvas.width;
        const height = canvas.height;

        const output = new Uint8ClampedArray(data);
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let sumX = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const kernelIdx = (ky + 1) * 3 + (kx + 1);
                        sumX += data[idx] * sobelX[kernelIdx];
                    }
                }

                const magnitude = Math.abs(sumX);
                const idx = (y * width + x) * 4;

                const enhanced = Math.min(255, data[idx] * 0.7 + magnitude * 0.3);
                output[idx] = output[idx + 1] = output[idx + 2] = enhanced;
            }
        }

        const newImgData = ctx.createImageData(width, height);
        newImgData.data.set(output);
        ctx.putImageData(newImgData, 0, 0);
        return canvas;
    }

    function preprocessOtsu(sourceCanvas) {
        const canvas = preprocessGaussian(sourceCanvas);
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        const threshold = calculateOtsuThreshold(data);

        for (let i = 0; i < data.length; i += 4) {
            const val = data[i] < threshold ? 0 : 255;
            data[i] = data[i + 1] = data[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    function preprocessMorphClose(sourceCanvas) {
        const canvas = preprocessGrayscale(sourceCanvas);
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const width = canvas.width;
        const height = canvas.height;

        const output = new Uint8ClampedArray(data);

        for (let y = 0; y < height; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                const left = (y * width + (x - 1)) * 4;
                const right = (y * width + (x + 1)) * 4;
                const maxVal = Math.max(data[idx], data[left], data[right]);
                output[idx] = output[idx + 1] = output[idx + 2] = maxVal;
            }
        }

        const data2 = new Uint8ClampedArray(output);
        for (let y = 0; y < height; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                const left = (y * width + (x - 1)) * 4;
                const right = (y * width + (x + 1)) * 4;
                const minVal = Math.min(data2[idx], data2[left], data2[right]);
                output[idx] = output[idx + 1] = output[idx + 2] = minVal;
            }
        }

        const newImgData = ctx.createImageData(width, height);
        newImgData.data.set(output);
        ctx.putImageData(newImgData, 0, 0);
        return canvas;
    }

    function preprocessUpscale2x(sourceCanvas) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = sourceCanvas.width * 2;
        canvas.height = sourceCanvas.height * 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    function preprocessUpscaleCLAHE(sourceCanvas) {
        const upscaled = preprocessUpscale2x(sourceCanvas);
        return preprocessCLAHE(upscaled);
    }

    function preprocessAdaptiveThreshold(sourceCanvas) {
        const canvas = preprocessGrayscale(sourceCanvas);
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const width = canvas.width;
        const height = canvas.height;

        const blockSize = 15;
        const C = 10;

        const output = new Uint8ClampedArray(data);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;

                for (let ky = -blockSize; ky <= blockSize; ky++) {
                    for (let kx = -blockSize; kx <= blockSize; kx++) {
                        const ny = y + ky;
                        const nx = x + kx;
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                            const idx = (ny * width + nx) * 4;
                            sum += data[idx];
                            count++;
                        }
                    }
                }

                const mean = sum / count;
                const idx = (y * width + x) * 4;
                const val = data[idx] > (mean - C) ? 255 : 0;
                output[idx] = output[idx + 1] = output[idx + 2] = val;
            }
        }

        const newImgData = ctx.createImageData(width, height);
        newImgData.data.set(output);
        ctx.putImageData(newImgData, 0, 0);
        return canvas;
    }

    /**
     * OCR fallback with multiple strategies
     */
    async function tryOCRFallback(imageSource) {
        console.log('🔍 Stage 2: Trying OCR fallback (slower)...');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);

        return new Promise(resolve => {
            img.onload = async () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const strategies = [
                    { name: 'raw', fn: preprocessRaw },
                    { name: 'grayscale', fn: preprocessGrayscale },
                    { name: 'gaussian', fn: preprocessGaussian },
                    { name: 'clahe', fn: preprocessCLAHE },
                    { name: 'edge', fn: preprocessEdgeEnhance },
                    { name: 'otsu', fn: preprocessOtsu },
                    { name: 'morph', fn: preprocessMorphClose },
                    { name: 'upscale2x', fn: preprocessUpscale2x },
                    { name: 'upscale-clahe', fn: preprocessUpscaleCLAHE },
                    { name: 'adaptive', fn: preprocessAdaptiveThreshold }
                ];

                for (const strategy of strategies) {
                    try {
                        console.log(`  → Trying OCR: ${strategy.name}`);
                        const processed = strategy.fn(canvas);

                        const { data: { text } } = await Tesseract.recognize(
                            processed.toDataURL('image/jpeg', 0.92),
                            'eng',
                            {
                                tessedit_char_whitelist: '0123456789X-',
                                tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT
                            }
                        );

                        const cleaned = text.replace(/[^0-9X]/g, '');

                        const isbn13Match = cleaned.match(/(978|979)\d{10}/);
                        const isbn10Match = cleaned.match(/\d{9}[0-9X]/);

                        const match = isbn13Match || isbn10Match;

                        if (match) {
                            console.log(`  ✓ SUCCESS with OCR ${strategy.name}: ${match[0]}`);
                            resolve(match[0]);
                            return;
                        }
                    } catch (err) {
                        console.log(`  ✗ OCR ${strategy.name} failed:`, err.message);
                    }
                }

                console.log('  ✗ All OCR strategies failed');
                resolve(null);
            };
            img.onerror = () => {
                console.log('  ✗ Image load error');
                resolve(null);
            };
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // HYBRID ISBN EXTRACTION (Barcode First, OCR Fallback)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Main ISBN extraction with two-stage approach:
     * 1. Try ZXing barcode reader (fast, accurate)
     * 2. Fallback to OCR with 10 strategies (slow, thorough)
     */
    async function processImageAndGetIsbn(imageSource) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('Starting ISBN extraction with hybrid approach');
        console.log('═══════════════════════════════════════════════════════');

        // Stage 1: Try barcode reader first
        let isbn = await tryBarcodeReader(imageSource);
        if (isbn) {
            console.log('✓ ISBN FOUND via barcode reader:', isbn);
            console.log('═══════════════════════════════════════════════════════');
            return isbn;
        }

        // Stage 2: Fallback to OCR
        isbn = await tryOCRFallback(imageSource);
        if (isbn) {
            console.log('✓ ISBN FOUND via OCR fallback:', isbn);
            console.log('═══════════════════════════════════════════════════════');
            return isbn;
        }

        console.log('✗ NO ISBN FOUND - Both methods exhausted');
        console.log('═══════════════════════════════════════════════════════');
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // BOOK COVER OCR (Unchanged - for text extraction)
    // ═══════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════
    // REST OF THE CODE (All existing functionality unchanged)
    // ═══════════════════════════════════════════════════════════════════

    function captureVideoFrame() {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (isDesktopCamera) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0);
        return canvas.toDataURL('image/jpeg');
    }

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

                btn.innerText = "Scanning ISBN...";
                btn.disabled = true;

                const isbn = await processImageAndGetIsbn(file);

                if (isbn) {
                    isbnInput.value = isbn;
                    const success = await fetchBookData(isbn);
                    alert(
                        success
                            ? "✓ Book details loaded successfully!"
                            : "ISBN found but no match in database. Try entering details manually."
                    );
                } else {
                    alert("✗ No valid ISBN detected.\n\nTips:\n• Ensure barcode is visible and in focus\n• Try better lighting\n• Hold camera steady\n• Or enter ISBN manually");
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

    async function startAutoScan() {
        if (!isScanning) return;
        const isbn = await processImageAndGetIsbn(captureVideoFrame());
        if (isbn) {
            isbnInput.value = isbn;
            const success = await fetchBookData(isbn);
            if (success) stopCamera();
        }
        if (isScanning) scanTimeout = setTimeout(startAutoScan, 2000);
    }

    captureBtn.addEventListener('click', async () => {
        if (!isScanning) return;
        captureBtn.innerText = "Scanning...";
        captureBtn.disabled = true;

        const isbn = await processImageAndGetIsbn(captureVideoFrame());
        if (isbn) {
            isbnInput.value = isbn;
            const success = await fetchBookData(isbn);
            if (success) stopCamera();
            else {
                captureBtn.innerText = "Capture";
                captureBtn.disabled = false;
            }
        } else {
            alert("No ISBN detected.\n\nTips:\n• Adjust angle and distance\n• Improve lighting\n• Hold camera steady");
            captureBtn.innerText = "Capture";
            captureBtn.disabled = false;
        }
    });

    async function fetchBookData(isbn) {
        const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${GOOGLE_API_KEY}`;
        const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=details&format=json`;

        try {
            let res = await fetch(googleUrl);
            let data = await res.json();
            if (data.totalItems > 0) {
                const info = data.items[0].volumeInfo;
                fillForm(
                    info.title,
                    info.authors?.join(', ') || '',
                    info.publisher || '',
                    info.pageCount || '',
                    info.publishedDate || '',
                    info.description || ''
                );
                return true;
            }

            res = await fetch(olUrl);
            data = await res.json();
            const key = `ISBN:${isbn}`;
            if (data[key]) {
                const d = data[key].details;
                fillForm(
                    d.title || '',
                    d.authors?.map(a => a.name).join(', ') || '',
                    d.publishers?.[0] || '',
                    d.number_of_pages || '',
                    d.publish_date || '',
                    ''
                );
                return true;
            }
            return false;
        } catch {
            return false;
        }
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
        if (stream) stream.getTracks().forEach(t => t.stop());

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        isDesktopCamera = !isMobile;

        let constraints;
        if (deviceId) {
            constraints = {
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
        } else if (isMobile) {
            constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };
        } else {
            constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
        }

        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;

            video.style.transform = isDesktopCamera ? "scaleX(-1)" : "scaleX(1)";

            if (videoSourceSelect.options.length === 0) await getCameras();
            video.onloadedmetadata = () => {
                isScanning = true;
                startAutoScan();
            };
        } catch (err) {
            console.error("Camera error:", err);
            alert("Camera access denied or unavailable.");
        }
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

    function isValidIsbn(val) {
        const clean = val.replace(/[^0-9X]/gi, '');
        return (/^\d{9}[0-9X]$/i.test(clean) || /^(978|979)\d{10}$/.test(clean));
    }

    function showValidation(msg, type = 'info') {
        isbnValidation.textContent = msg;
        isbnValidation.className = `validation-message ${type}`;
        if (type !== 'error') {
            setTimeout(() => {
                isbnValidation.textContent = '';
                isbnValidation.className = 'validation-message';
            }, 5000);
        }
    }

    searchIsbnBtn.addEventListener('click', async () => {
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
            [titleInput, authorInput, publisherInput].forEach(el => {
                if (el?.value) {
                    el.style.borderColor = '#27ae60';
                    setTimeout(() => el.style.borderColor = '', 2200);
                }
            });
        } else {
            showValidation('No book found for this ISBN', 'error');
        }

        searchIsbnBtn.disabled = false;
        searchIsbnBtn.classList.remove('loading');
    });

    isbnInput.addEventListener('input', e => {
        const v = e.target.value.trim();
        if (v && !isValidIsbn(v)) {
            isbnValidation.textContent = 'Invalid ISBN format';
            isbnValidation.className = 'validation-message error';
        } else {
            isbnValidation.textContent = '';
            isbnValidation.className = 'validation-message';
        }
    });

    isbnInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') searchIsbnBtn.click();
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
