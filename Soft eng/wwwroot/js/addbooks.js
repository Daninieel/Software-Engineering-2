document.addEventListener('DOMContentLoaded', () => {
    const GOOGLE_API_KEY = 'AIzaSyCKBTEr-lRyt7BokJofqH-L18tjHbOpWLk';

    // Elements
    const videoSourceSelect = document.getElementById('videoSource');
    const scanIsbnBtn = document.getElementById('scanIsbnBtn');
    const cameraModal = document.getElementById('cameraModal');
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('captureBtn');
    const closeCameraBtn = document.getElementById('closeCameraBtn');
    const fileUpload = document.getElementById('fileUpload');
    const searchIsbnBtn = document.getElementById('searchIsbnBtn');
    const isbnValidation = document.getElementById('isbnValidation');

    // Cover Scan Elements
    const coverScanModal = document.getElementById('coverScanModal');
    const coverCanvas = document.getElementById('coverCanvas');
    const detectedTextList = document.getElementById('detectedTextList');
    const applyFieldsBtn = document.getElementById('applyFieldsBtn');
    const cancelCoverScanBtn = document.getElementById('cancelCoverScanBtn');

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

    // Cover scan state
    let detectedWords = [];
    let selectedFields = {
        title: '',
        author: '',
        publisher: '',
        edition: '',
        year: ''
    };

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

    // --- 2. IMAGE UPLOAD HANDLER (MODIFIED FOR BOTH ISBN AND COVER) ---
    fileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Ask user what type of scan
        const scanType = confirm('Is this an ISBN barcode?\n\nClick OK for ISBN scan\nClick Cancel for Cover Page scan');

        if (scanType) {
            // ISBN SCAN (existing functionality)
            const originalBtn = document.querySelector('.btn-blue');
            const originalText = originalBtn.innerText;
            originalBtn.innerText = "Scanning ISBN...";

            const foundIsbn = await processImageAndGetIsbn(file);

            if (foundIsbn) {
                isbnInput.value = foundIsbn;
                const success = await fetchBookData(foundIsbn);
                if (success) {
                    alert("✓ Book details auto-filled from ISBN!");
                } else {
                    alert("✗ ISBN found but not in library database.");
                }
            } else {
                alert("✗ No ISBN detected. Try a clearer barcode image.");
            }

            originalBtn.innerText = originalText;
        } else {
            // COVER PAGE SCAN (new functionality)
            await processCoverImage(file);
        }

        // Reset file input
        fileUpload.value = '';
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
        } catch (err) {
            console.error('API fetch error:', err);
            return false;
        }
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
        } catch (err) {
            alert("Camera access failed.");
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

    // --- 7. MANUAL ISBN SEARCH FUNCTIONALITY ---

    // Validate ISBN format
    function isValidIsbn(isbn) {
        // Remove any spaces, hyphens, or special characters
        const cleaned = isbn.replace(/[^0-9X]/gi, '');

        // Check for valid ISBN-10 or ISBN-13
        const isbn10Pattern = /^\d{9}[0-9X]$/i;
        const isbn13Pattern = /^(978|979)\d{10}$/;

        return isbn10Pattern.test(cleaned) || isbn13Pattern.test(cleaned);
    }

    // Show validation message
    function showValidation(message, type) {
        isbnValidation.textContent = message;
        isbnValidation.className = `validation-message ${type}`;

        // Clear message after 5 seconds for success/info messages
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                isbnValidation.textContent = '';
                isbnValidation.className = 'validation-message';
            }, 5000);
        }
    }

    // Search ISBN button click handler
    searchIsbnBtn.addEventListener('click', async () => {
        const isbn = isbnInput.value.trim();

        // Clear previous validation
        isbnValidation.textContent = '';
        isbnValidation.className = 'validation-message';

        // Validate input
        if (!isbn) {
            showValidation('Please enter an ISBN number', 'error');
            isbnInput.focus();
            return;
        }

        if (!isValidIsbn(isbn)) {
            showValidation('Invalid ISBN format. Please enter a valid 10 or 13 digit ISBN', 'error');
            isbnInput.focus();
            return;
        }

        // Show loading state
        searchIsbnBtn.disabled = true;
        searchIsbnBtn.classList.add('loading');
        showValidation('Searching for book...', 'info');

        try {
            const cleanedIsbn = isbn.replace(/[^0-9X]/gi, '');
            const success = await fetchBookData(cleanedIsbn);

            if (success) {
                showValidation('✓ Book found! Fields auto-populated successfully.', 'success');

                // Optional: Visual feedback on populated fields
                [titleInput, authorInput, publisherInput, pagesInput, yearInput].forEach(input => {
                    if (input && input.value) {
                        input.style.borderColor = '#27ae60';
                        setTimeout(() => {
                            input.style.borderColor = '';
                        }, 2000);
                    }
                });
            } else {
                showValidation('✗ ISBN not found in library databases. Please enter book details manually.', 'error');
            }
        } catch (error) {
            console.error('Search error:', error);
            showValidation('✗ Search failed. Please check your connection and try again.', 'error');
        } finally {
            // Remove loading state
            searchIsbnBtn.disabled = false;
            searchIsbnBtn.classList.remove('loading');
        }
    });

    // Allow Enter key to trigger search
    isbnInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchIsbnBtn.click();
        }
    });

    // Real-time validation as user types
    isbnInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();

        if (value && !isValidIsbn(value)) {
            isbnValidation.textContent = 'Invalid ISBN format';
            isbnValidation.className = 'validation-message error';
        } else {
            isbnValidation.textContent = '';
            isbnValidation.className = 'validation-message';
        }
    });

    // --- 8. COVER PAGE SCAN WITH MANUAL FIELD SELECTION ---

    // Group words that are close together on the same line
    function groupNearbyWords(words) {
        if (words.length === 0) return [];

        const grouped = [];
        let currentGroup = [words[0]];

        for (let i = 1; i < words.length; i++) {
            const prevWord = words[i - 1];
            const currWord = words[i];

            // Calculate vertical and horizontal distance
            const verticalDistance = Math.abs(currWord.bbox.y0 - prevWord.bbox.y0);
            const horizontalGap = currWord.bbox.x0 - prevWord.bbox.x1;
            const avgHeight = (prevWord.bbox.y1 - prevWord.bbox.y0 + currWord.bbox.y1 - currWord.bbox.y0) / 2;

            // Words are on the same line if:
            // 1. Vertical distance is less than half the average height
            // 2. Horizontal gap is reasonable (less than 3x average character width)
            const avgCharWidth = (prevWord.bbox.x1 - prevWord.bbox.x0) / prevWord.text.length;
            const maxGap = avgCharWidth * 3;

            if (verticalDistance < avgHeight * 0.5 && horizontalGap < maxGap && horizontalGap >= 0) {
                // Same line - add to current group
                currentGroup.push(currWord);
            } else {
                // Different line or too far - start new group
                grouped.push(mergeWordGroup(currentGroup));
                currentGroup = [currWord];
            }
        }

        // Don't forget the last group
        if (currentGroup.length > 0) {
            grouped.push(mergeWordGroup(currentGroup));
        }

        // Add suggestions to each group
        return grouped.map((group, index) => ({
            ...group,
            suggestion: suggestFieldType(group.text, group.bbox, index, grouped.length)
        }));
    }

    // Merge a group of words into one text item
    function mergeWordGroup(wordGroup) {
        if (wordGroup.length === 1) {
            return {
                text: wordGroup[0].text.trim(),
                bbox: wordGroup[0].bbox,
                confidence: wordGroup[0].confidence
            };
        }

        // Combine text with spaces
        const text = wordGroup.map(w => w.text).join(' ').trim();

        // Calculate merged bounding box
        const x0 = Math.min(...wordGroup.map(w => w.bbox.x0));
        const y0 = Math.min(...wordGroup.map(w => w.bbox.y0));
        const x1 = Math.max(...wordGroup.map(w => w.bbox.x1));
        const y1 = Math.max(...wordGroup.map(w => w.bbox.y1));

        // Average confidence
        const confidence = wordGroup.reduce((sum, w) => sum + w.confidence, 0) / wordGroup.length;

        return {
            text,
            bbox: { x0, y0, x1, y1 },
            confidence
        };
    }

    // Smart suggestion based on text content and position
    function suggestFieldType(text, bbox, index, totalWords) {
        text = text.trim();

        // Year detection (4 digits)
        if (/^\d{4}$/.test(text)) {
            return 'year';
        }

        // Edition detection
        if (/edition|ed\.|ed$/i.test(text)) {
            return 'edition';
        }

        // Author detection (contains "by" or "By")
        if (/^by$/i.test(text)) {
            return 'author';
        }

        // Title is usually at the top (first few items)
        if (index < 3 && text.length > 3) {
            return 'title';
        }

        // Publisher usually at bottom
        if (index > totalWords - 3 && text.length > 3) {
            return 'publisher';
        }

        return 'none';
    }

    // Process uploaded image for cover scan
    async function processCoverImage(file) {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
            img.onload = async () => {
                // Set canvas size to image size
                coverCanvas.width = img.width;
                coverCanvas.height = img.height;
                const ctx = coverCanvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // Show loading state
                detectedTextList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Scanning cover page...</div>';
                coverScanModal.style.display = 'flex';

                try {
                    // Use Tesseract to get text with bounding boxes
                    const result = await Tesseract.recognize(
                        coverCanvas.toDataURL(),
                        'eng',
                        {
                            logger: m => {
                                if (m.status === 'recognizing text') {
                                    const percent = Math.round(m.progress * 100);
                                    detectedTextList.innerHTML = `<div style="text-align: center; padding: 20px; color: #666;">Analyzing... ${percent}%</div>`;
                                }
                            }
                        }
                    );

                    // Filter and process detected words
                    detectedWords = result.data.words
                        .filter(word => word.text.trim().length > 0 && word.confidence > 60)
                        .map((word, index) => ({
                            text: word.text.trim(),
                            bbox: word.bbox,
                            confidence: word.confidence,
                            suggestion: suggestFieldType(word.text.trim(), word.bbox, index, result.data.words.length)
                        }));

                    if (detectedWords.length === 0) {
                        detectedTextList.innerHTML = '<div style="text-align: center; padding: 20px; color: #e74c3c;">No text detected. Please try a clearer image.</div>';
                        return;
                    }

                    // Draw highlights on canvas
                    drawTextHighlights();

                    // Populate text list
                    populateDetectedTextList();

                } catch (error) {
                    console.error('OCR Error:', error);
                    detectedTextList.innerHTML = '<div style="text-align: center; padding: 20px; color: #e74c3c;">Error scanning image. Please try again.</div>';
                }
            };
        };

        reader.readAsDataURL(file);
    }

    // Draw highlights on canvas (like Snipping Tool)
    function drawTextHighlights() {
        const ctx = coverCanvas.getContext('2d');
        const img = new Image();
        img.src = coverCanvas.toDataURL();

        img.onload = () => {
            ctx.clearRect(0, 0, coverCanvas.width, coverCanvas.height);
            ctx.drawImage(img, 0, 0);

            detectedWords.forEach((word, index) => {
                const { x0, y0, x1, y1 } = word.bbox;

                // Draw highlight box
                ctx.strokeStyle = '#3498db';
                ctx.lineWidth = 2;
                ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

                // Semi-transparent fill
                ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
                ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

                // Add index number
                ctx.fillStyle = '#3498db';
                ctx.font = 'bold 14px Arial';
                ctx.fillText(index + 1, x0 + 5, y0 + 15);
            });
        };
    }

    // Populate detected text list with selectors
    function populateDetectedTextList() {
        detectedTextList.innerHTML = '';

        detectedWords.forEach((word, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'text-item';
            itemDiv.dataset.index = index;

            const textContent = document.createElement('div');
            textContent.className = 'text-content';
            textContent.textContent = `${index + 1}. ${word.text}`;

            const suggestion = document.createElement('div');
            suggestion.className = 'text-suggestion';
            suggestion.textContent = word.suggestion !== 'none'
                ? `Suggested: ${word.suggestion.charAt(0).toUpperCase() + word.suggestion.slice(1)}`
                : 'Select field type below';

            const select = document.createElement('select');
            select.className = 'field-selector';
            select.innerHTML = `
                <option value="none">-- Select Field --</option>
                <option value="title" ${word.suggestion === 'title' ? 'selected' : ''}>Book Title</option>
                <option value="author" ${word.suggestion === 'author' ? 'selected' : ''}>Author</option>
                <option value="publisher" ${word.suggestion === 'publisher' ? 'selected' : ''}>Publisher</option>
                <option value="edition" ${word.suggestion === 'edition' ? 'selected' : ''}>Edition</option>
                <option value="year" ${word.suggestion === 'year' ? 'selected' : ''}>Year</option>
            `;

            // Auto-select suggestion if available
            if (word.suggestion !== 'none') {
                updateSelectedField(word.suggestion, word.text, index);
            }

            select.addEventListener('change', (e) => {
                const fieldType = e.target.value;
                updateSelectedField(fieldType, word.text, index);

                // Visual feedback
                if (fieldType !== 'none') {
                    itemDiv.classList.add('selected');
                } else {
                    itemDiv.classList.remove('selected');
                }
            });

            itemDiv.appendChild(textContent);
            itemDiv.appendChild(suggestion);
            itemDiv.appendChild(select);
            detectedTextList.appendChild(itemDiv);
        });
    }

    // Update selected fields object
    function updateSelectedField(fieldType, text, index) {
        // Remove this text from other fields
        Object.keys(selectedFields).forEach(key => {
            if (selectedFields[key] === text) {
                selectedFields[key] = '';
            }
        });

        // Set new field
        if (fieldType !== 'none') {
            selectedFields[fieldType] = text;
        }
    }

    // Apply selected fields to form
    applyFieldsBtn.addEventListener('click', () => {
        if (selectedFields.title) titleInput.value = selectedFields.title;
        if (selectedFields.author) authorInput.value = selectedFields.author;
        if (selectedFields.publisher) publisherInput.value = selectedFields.publisher;
        if (selectedFields.edition) {
            const editionInput = document.querySelector('input[name="Edition"]');
            if (editionInput) editionInput.value = selectedFields.edition;
        }
        if (selectedFields.year) {
            // Format year to date input format (YYYY-01-01)
            const year = selectedFields.year.match(/\d{4}/);
            if (year) {
                yearInput.value = `${year[0]}-01-01`;
            }
        }

        // Visual feedback
        [titleInput, authorInput, publisherInput].forEach(input => {
            if (input && input.value) {
                input.style.borderColor = '#27ae60';
                setTimeout(() => {
                    input.style.borderColor = '';
                }, 2000);
            }
        });

        alert('✓ Book information applied to form!');
        coverScanModal.style.display = 'none';
        resetCoverScan();
    });

    // Cancel cover scan
    cancelCoverScanBtn.addEventListener('click', () => {
        coverScanModal.style.display = 'none';
        resetCoverScan();
    });

    // Reset cover scan state
    function resetCoverScan() {
        detectedWords = [];
        selectedFields = {
            title: '',
            author: '',
            publisher: '',
            edition: '',
            year: ''
        };
        detectedTextList.innerHTML = '';
        const ctx = coverCanvas.getContext('2d');
        ctx.clearRect(0, 0, coverCanvas.width, coverCanvas.height);
    }
});