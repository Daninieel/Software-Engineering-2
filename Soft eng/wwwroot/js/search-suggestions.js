// Search Suggestions Utility with "Do you mean..." functionality
class SearchSuggestions {
    constructor(searchInputSelector, apiEndpoint, fieldsToSearch = ['title']) {
        this.searchInput = typeof searchInputSelector === 'string'
            ? document.querySelector(searchInputSelector)
            : searchInputSelector;
        this.apiEndpoint = apiEndpoint;
        this.fieldsToSearch = Array.isArray(fieldsToSearch) ? fieldsToSearch : [fieldsToSearch];
        this.suggestions = [];
        this.selectedIndex = -1;
        this.debounceTimer = null;
        this.minChars = 2;
        this.debounceDelay = 300;
        this.maxSuggestions = 10;

        this.init();
    }

    init() {
        if (!this.searchInput) {
            console.warn('SearchSuggestions: Search input not found');
            return;
        }

        // Ensure the search input has an ID for reference
        if (!this.searchInput.id) {
            this.searchInput.id = 'searchInput_' + Math.random().toString(36).substr(2, 9);
        }

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'suggestions-container';
        this.container.id = 'suggestions_' + this.searchInput.id;
        this.container.setAttribute('role', 'listbox');
        this.searchInput.parentNode.insertBefore(this.container, this.searchInput.nextSibling);

        // Make search filter position relative for absolute positioning of suggestions
        const searchFilter = this.searchInput.closest('.search-filter');
        if (searchFilter) {
            searchFilter.style.position = 'relative';
        }

        // Add ARIA attributes
        this.searchInput.setAttribute('role', 'combobox');
        this.searchInput.setAttribute('aria-autocomplete', 'list');
        this.searchInput.setAttribute('aria-controls', this.container.id);
        this.searchInput.setAttribute('aria-expanded', 'false');

        // Event listeners
        this.searchInput.addEventListener('input', (e) => this.handleInput(e));
        this.searchInput.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.searchInput.addEventListener('focus', (e) => this.handleFocus(e));
        document.addEventListener('click', (e) => this.handleDocumentClick(e));
    }

    handleInput(e) {
        clearTimeout(this.debounceTimer);
        const query = e.target.value.trim();

        if (query.length < this.minChars) {
            this.hideSuggestions();
            return;
        }

        this.debounceTimer = setTimeout(() => {
            this.fetchSuggestions(query);
        }, this.debounceDelay);
    }

    handleKeydown(e) {
        if (!this.container.classList.contains('show') || this.suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
                this.updateSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0) {
                    this.selectSuggestion(this.suggestions[this.selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.hideSuggestions();
                this.searchInput.blur();
                break;
            case 'Tab':
                this.hideSuggestions();
                break;
        }
    }

    handleFocus(e) {
        const query = e.target.value.trim();
        if (query.length >= this.minChars && this.suggestions.length > 0) {
            this.showSuggestions();
        }
    }

    handleDocumentClick(e) {
        if (!e.target.closest('.search-filter') && !e.target.closest('.suggestions-container')) {
            this.hideSuggestions();
        }
    }

    async fetchSuggestions(query) {
        try {
            const allSuggestions = new Map(); // Use Map to store suggestions with metadata

            // Fetch from all fields
            for (const field of this.fieldsToSearch) {
                try {
                    const url = `${this.apiEndpoint}?query=${encodeURIComponent(query)}&field=${encodeURIComponent(field)}`;
                    const response = await fetch(url);

                    if (response.ok) {
                        const data = await response.json();
                        if (Array.isArray(data)) {
                            data.forEach(item => {
                                if (item && typeof item === 'string' && item.trim()) {
                                    if (!allSuggestions.has(item)) {
                                        allSuggestions.set(item, {
                                            text: item,
                                            fields: [field],
                                            isExactMatch: item.toLowerCase() === query.toLowerCase()
                                        });
                                    } else {
                                        allSuggestions.get(item).fields.push(field);
                                    }
                                }
                            });
                        }
                    } else if (response.status === 404) {
                        console.warn(`Suggestions endpoint not found: ${url}`);
                    }
                } catch (err) {
                    console.warn(`Error fetching suggestions for field "${field}":`, err);
                }
            }

            this.suggestions = Array.from(allSuggestions.values())
                .slice(0, this.maxSuggestions)
                .map(item => item.text);

            this.selectedIndex = -1;

            if (this.suggestions.length > 0) {
                // Check if there's an exact match
                const hasExactMatch = this.suggestions.some(s => s.toLowerCase() === query.toLowerCase());

                if (!hasExactMatch && this.suggestions.length > 0) {
                    // Show "Do you mean..." for close matches
                    this.renderWithDoYouMean(query);
                } else {
                    // Show regular suggestions
                    this.renderSuggestions(query);
                }
                this.showSuggestions();
            } else {
                this.showNoSuggestions(query);
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            this.hideSuggestions();
        }
    }

    renderWithDoYouMean(query) {
        this.container.innerHTML = '';

        // Add "Do you mean..." header
        const header = document.createElement('div');
        header.className = 'suggestions-header';
        header.textContent = `No exact match for "${this.escapeHtml(query)}"`;
        this.container.appendChild(header);

        // Add top suggestion with special styling
        if (this.suggestions.length > 0) {
            const doYouMeanItem = document.createElement('div');
            doYouMeanItem.className = 'suggestion-item do-you-mean';
            doYouMeanItem.dataset.index = 0;
            doYouMeanItem.setAttribute('role', 'option');
            doYouMeanItem.setAttribute('id', `suggestion-${this.searchInput.id}-dym`);

            const label = document.createElement('span');
            label.className = 'suggestion-label';
            label.textContent = 'Do you mean:';

            const text = document.createElement('span');
            text.className = 'suggestion-text';
            text.innerHTML = this.highlightMatch(this.suggestions[0], query);

            doYouMeanItem.appendChild(label);
            doYouMeanItem.appendChild(text);

            doYouMeanItem.addEventListener('click', () => this.selectSuggestion(this.suggestions[0]));
            doYouMeanItem.addEventListener('mouseenter', () => {
                this.selectedIndex = 0;
                this.updateSelection();
            });

            this.container.appendChild(doYouMeanItem);

            // Add divider if there are more suggestions
            if (this.suggestions.length > 1) {
                const divider = document.createElement('div');
                divider.className = 'suggestion-divider';
                this.container.appendChild(divider);

                // Add remaining suggestions
                this.renderRemainingItems(query, 1);
            }
        }
    }

    renderRemainingItems(query, startIndex = 0) {
        for (let i = startIndex; i < this.suggestions.length; i++) {
            const suggestion = this.suggestions[i];
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.dataset.index = i;
            item.setAttribute('role', 'option');
            item.setAttribute('id', `suggestion-${this.searchInput.id}-${i}`);

            const text = document.createElement('span');
            text.className = 'suggestion-text';
            text.innerHTML = this.highlightMatch(suggestion, query);

            item.appendChild(text);
            item.addEventListener('click', () => this.selectSuggestion(suggestion));
            item.addEventListener('mouseenter', () => {
                this.selectedIndex = i;
                this.updateSelection();
            });

            this.container.appendChild(item);
        }
    }

    renderSuggestions(query) {
        this.container.innerHTML = '';

        // Add header
        const header = document.createElement('div');
        header.className = 'suggestions-header';
        header.textContent = 'Suggestions';
        this.container.appendChild(header);

        this.suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.dataset.index = index;
            item.setAttribute('role', 'option');
            item.setAttribute('id', `suggestion-${this.searchInput.id}-${index}`);

            const text = document.createElement('span');
            text.className = 'suggestion-text';
            text.innerHTML = this.highlightMatch(suggestion, query);

            item.appendChild(text);
            item.addEventListener('click', () => this.selectSuggestion(suggestion));
            item.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            this.container.appendChild(item);
        });
    }

    highlightMatch(text, query) {
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return this.escapeHtml(text).replace(regex, '<span class="suggestion-match">$1</span>');
    }

    showNoSuggestions(query) {
        this.container.innerHTML = `
            <div class="suggestions-header">No matches found</div>
            <div class="no-suggestions">No results for "${this.escapeHtml(query)}"</div>
        `;
        this.showSuggestions();
    }

    updateSelection() {
        const items = this.container.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                item.setAttribute('aria-selected', 'true');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                this.searchInput.setAttribute('aria-activedescendant', item.id);
            } else {
                item.classList.remove('selected');
                item.setAttribute('aria-selected', 'false');
            }
        });
    }

    selectSuggestion(suggestion) {
        this.searchInput.value = suggestion;
        this.hideSuggestions();

        // Trigger input event to update search results
        this.searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Optionally trigger a custom event for additional handling
        this.searchInput.dispatchEvent(new CustomEvent('suggestionSelected', {
            detail: { suggestion },
            bubbles: true
        }));
    }

    showSuggestions() {
        this.container.classList.add('show');
        this.searchInput.setAttribute('aria-expanded', 'true');
    }

    hideSuggestions() {
        this.container.classList.remove('show');
        this.selectedIndex = -1;
        this.searchInput.setAttribute('aria-expanded', 'false');
        this.searchInput.removeAttribute('aria-activedescendant');
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    configure(options) {
        if (options.minChars !== undefined) this.minChars = options.minChars;
        if (options.debounceDelay !== undefined) this.debounceDelay = options.debounceDelay;
        if (options.maxSuggestions !== undefined) this.maxSuggestions = options.maxSuggestions;
    }

    search(query) {
        if (query && query.length >= this.minChars) {
            this.fetchSuggestions(query);
        }
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        clearTimeout(this.debounceTimer);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const url = window.location.pathname.toLowerCase();
    const searchInput = document.querySelector('.search-filter input');

    if (!searchInput) {
        console.warn('Search input not found on page');
        return;
    }

    let suggestionInstance = null;

    // Determine page type and initialize appropriate suggestions
    if (url.includes('dashboard')) {
        // Dashboard: Use global suggestions endpoint with all fields
        suggestionInstance = new SearchSuggestions(
            searchInput,
            '/Home/GetDashboardSuggestions',
            ['title', 'author', 'isbn', 'shelf', 'borrower']
        );
    } else if (url.includes('inventory') || url.includes('logbook')) {
        // Inventory & Logbook pages: Book Title, Author, ISBN, Shelf Location
        suggestionInstance = new SearchSuggestions(
            searchInput,
            '/Home/GetInventorySuggestions',
            ['title', 'author', 'isbn', 'shelf']
        );
    } else if (url.includes('borrowedbooks')) {
        // Borrowed Books page: Title and Borrower
        suggestionInstance = new SearchSuggestions(
            searchInput,
            '/Home/GetBorrowedBooksSuggestions',
            ['title', 'borrower']
        );
    } else if (url.includes('requestedbooks')) {
        // Requested Books page: Title and Borrower
        suggestionInstance = new SearchSuggestions(
            searchInput,
            '/Home/GetRequestedBooksSuggestions',
            ['title', 'borrower']
        );
    } else if (url.includes('fine')) {
        // Fine page: Title only
        suggestionInstance = new SearchSuggestions(
            searchInput,
            '/Home/GetFineSuggestions',
            ['title']
        );
    }

    // Store instance globally if needed for debugging or manual control
    if (suggestionInstance) {
        window.searchSuggestionsInstance = suggestionInstance;
    }
});