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

    async function processImageAndGetIsbn(imageSource) {
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

                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                for (let i = 0; i < data.length; i += 4) {
                    let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    avg = Math.max(0, Math.min(255, (avg - 128) * 1.4 + 128));
                    data[i] = data[i + 1] = data[i + 2] = avg;
                }
                ctx.putImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);

                try {
                    const { data: { text } } = await Tesseract.recognize(
                        canvas.toDataURL('image/jpeg', 0.92),
                        'eng',
                        { tessedit_char_whitelist: '0123456789X' }
                    );
                    const cleaned = text.replace(/[^0-9X]/g, '');
                    const match = cleaned.match(/(978|979)\d{10}|\d{9}[0-9X]/);
                    resolve(match ? match[0] : null);
                } catch {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
        });
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

        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);

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
    });

    function showTempMessage(msg, color, ms) {
        const div = document.createElement('div');
        div.textContent = msg;
        div.style.cssText = `padding:10px; color:white; background:${color}; border-radius:6px; margin:10px 0; text-align:center;`;
        detectedTextList.appendChild(div);
        setTimeout(() => div.remove(), ms);
    }

    function populateDetectedTextList() {
        const items = allDetections.filter(d => d.side === currentSide);
        detectedTextList.innerHTML = '';

        if (items.length === 0) {
            detectedTextList.innerHTML = `
                <div style="text-align:center; padding:20px; color:#3498db;">
                    <b>${currentSide.toUpperCase()} COVER</b><br>
                    Draw rectangles around text areas
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

                detectedTextList.innerHTML = `
                    <div style="text-align:center; padding:15px; color:#3498db; background:#e3f2fd; border-radius:8px;">
                        <b>${side.toUpperCase()} COVER LOADED</b><br>
                        <small>Draw boxes around text • Scroll = zoom • Shift+drag = pan</small>
                    </div>`;
                coverScanModal.style.display = 'flex';
                updateToggleButton();
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

                btn.innerText = "Scanning...";
                btn.disabled = true;

                const isbn = await processImageAndGetIsbn(file);

                if (isbn) {
                    isbnInput.value = isbn;
                    const success = await fetchBookData(isbn);
                    alert(
                        success
                            ? "Book details loaded!"
                            : "ISBN found but no match in database."
                    );
                } else {
                    alert("No valid ISBN detected.");
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
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const isbn = await processImageAndGetIsbn(canvas.toDataURL('image/jpeg'));
        if (isbn) {
            isbnInput.value = isbn;
            const success = await fetchBookData(isbn);
            if (success) stopCamera();
        }
        if (isScanning) scanTimeout = setTimeout(startAutoScan, 1500);
    }

    captureBtn.addEventListener('click', async () => {
        if (!isScanning) return;
        captureBtn.innerText = "Scanning...";
        captureBtn.disabled = true;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const isbn = await processImageAndGetIsbn(canvas.toDataURL('image/jpeg'));
        if (isbn) {
            isbnInput.value = isbn;
            const success = await fetchBookData(isbn);
            if (success) stopCamera();
            else {
                captureBtn.innerText = "Capture";
                captureBtn.disabled = false;
            }
        } else {
            alert("No ISBN detected.");
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

        let constraints;
        if (deviceId) {
            constraints = { video: { deviceId: { exact: deviceId } } };
        } else if (isMobile) {
            constraints = {
                video: {
                    facingMode: { ideal: 'environment' }
                }
            };
        } else {
            constraints = { video: true };
        }

        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;

            if (!isMobile) {
                video.style.transform = "scaleX(-1)";
            } else {
                video.style.transform = "scaleX(1)";
            }

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
});