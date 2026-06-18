// Global State
let allNotes = [];
let filteredNotes = [];
let selectedNoteId = null;
let activeCategory = 'all';
let searchQuery = '';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const categoryPills = document.getElementById('categoryPills');
const refreshBtn = document.getElementById('refreshBtn');
const resultsCount = document.getElementById('resultsCount');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const notesList = document.getElementById('notesList');
const feedStatus = document.getElementById('feedStatus');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const mockWarningBanner = document.getElementById('mockWarningBanner');
const closeBannerBtn = document.getElementById('closeBannerBtn');

// Preview DOM Elements
const emptyPreview = document.getElementById('emptyPreview');
const detailsPanel = document.getElementById('detailsPanel');
const detailBadge = document.getElementById('detailBadge');
const detailDate = document.getElementById('detailDate');
const detailContent = document.getElementById('detailContent');
const detailOriginalLink = document.getElementById('detailOriginalLink');
const detailCopyHtmlBtn = document.getElementById('detailCopyHtmlBtn');
const detailCopyTextBtn = document.getElementById('detailCopyTextBtn');
const tweetTextArea = document.getElementById('tweetTextArea');
const charCounter = document.getElementById('charCounter');
const tweetBtn = document.getElementById('tweetBtn');
const progressRingCircle = document.getElementById('progressRingCircle');

// Mobile Drawer Elements
const drawerOverlay = document.getElementById('drawerOverlay');
const mobileDrawer = document.getElementById('mobileDrawer');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const drawerContentContainer = document.getElementById('drawerContentContainer');

// Toast Notification
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
const themeToggle = document.getElementById('themeToggle');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchNotes();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh feed
    refreshBtn.addEventListener('click', () => {
        fetchNotes();
    });

    // Export to CSV
    exportCsvBtn.addEventListener('click', () => {
        exportToCSV();
    });

    // Category pills filter
    categoryPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;

        // Visual update
        document.querySelectorAll('.category-pills .pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        // State update
        activeCategory = pill.dataset.category;
        filterAndRender();
    });

    // Search input typing
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterAndRender();
    });

    // Character counter for Twitter composer
    tweetTextArea.addEventListener('input', () => {
        updateCharCount();
    });

    // Post to Twitter
    tweetBtn.addEventListener('click', () => {
        const text = tweetTextArea.value;
        if (!text) return;
        
        // Encode and open Twitter web intent
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank');
        showToast('Opening Twitter composer!');
    });

    // Close Mobile Drawer
    closeDrawerBtn.addEventListener('click', closeMobileDrawer);
    drawerOverlay.addEventListener('click', closeMobileDrawer);

    // ESC key closes drawer
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileDrawer();
        }
    });

    // Close Mock/Offline warning banner
    closeBannerBtn.addEventListener('click', () => {
        mockWarningBanner.classList.add('hidden');
    });

    // Copy HTML inside details panel
    detailCopyHtmlBtn.addEventListener('click', () => {
        if (!selectedNoteId) return;
        const note = allNotes.find(n => n.id === selectedNoteId);
        if (!note) return;
        navigator.clipboard.writeText(note.content_html).then(() => {
            showToast('HTML content copied!');
            const originalText = detailCopyHtmlBtn.innerHTML;
            detailCopyHtmlBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Copied HTML!</span>
            `;
            setTimeout(() => { detailCopyHtmlBtn.innerHTML = originalText; }, 2000);
        }).catch(err => {
            console.error('Failed to copy HTML: ', err);
            showToast('Failed to copy HTML', true);
        });
    });

    // Copy Plain Text inside details panel
    detailCopyTextBtn.addEventListener('click', () => {
        if (!selectedNoteId) return;
        const note = allNotes.find(n => n.id === selectedNoteId);
        if (!note) return;
        const parser = new DOMParser();
        const doc = parser.parseFromString(note.content_html, 'text/html');
        const plainText = doc.body.textContent || doc.body.innerText || "";
        const textToCopy = `[BigQuery Update - ${note.date} - ${note.type}]\n${plainText.trim()}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('Plain text copied!');
            const originalText = detailCopyTextBtn.innerHTML;
            detailCopyTextBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Copied Text!</span>
            `;
            setTimeout(() => { detailCopyTextBtn.innerHTML = originalText; }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy text', true);
        });
    });

    // Tweet composer keyboard shortcuts (Ctrl+Enter to post)
    tweetTextArea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const text = tweetTextArea.value;
            if (text && text.length <= 280) {
                e.preventDefault();
                tweetBtn.click();
            }
        }
    });

    // Theme toggling initialization & event listener
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.checked = savedTheme === 'light';

    themeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            showToast('Light theme enabled!');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            showToast('Dark theme enabled!');
        }
    });
}

// Fetch Notes from Backend API
async function fetchNotes() {
    // Show spinner & loading state
    loadingState.classList.remove('hidden');
    notesList.classList.add('hidden');
    emptyState.classList.add('hidden');
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;

    // Reset status
    updateStatus('connecting', 'Connecting...');

    try {
        const response = await fetch('/api/notes');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        allNotes = data.notes;
        
        // Update connection status dot and show banner if offline/mocked
        if (data.is_mocked) {
            updateStatus('mocked', 'Mocked Data');
            mockWarningBanner.classList.remove('hidden');
            showToast('Unable to connect to live feeds. Showing cached data.', true);
        } else {
            updateStatus('live', 'Live Feed Connected');
            mockWarningBanner.classList.add('hidden');
            showToast('Feed refreshed successfully!');
        }

        // Apply current filter, count categories & render notes
        updatePillCounts();
        filterAndRender();

        // Auto-select first note card on fetch if any exist
        if (filteredNotes.length > 0) {
            selectNote(filteredNotes[0].id);
        }

    } catch (error) {
        console.error('Failed to fetch release notes:', error);
        updateStatus('error', 'Connection Error');
        mockWarningBanner.classList.remove('hidden');
        showToast('Connection failed. Using fallback data.', true);
        
        // Use local mockup in case backend API crashes completely
        allNotes = getFallbackMockData();
        updatePillCounts();
        filterAndRender();
        if (filteredNotes.length > 0) {
            selectNote(filteredNotes[0].id);
        }
    } finally {
        loadingState.classList.add('hidden');
        notesList.classList.remove('hidden');
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
    }
}

// Filter and Render List
function filterAndRender() {
    filteredNotes = allNotes.filter(note => {
        // Category Filter
        const matchesCategory = activeCategory === 'all' || 
            note.type.toLowerCase() === activeCategory ||
            (activeCategory === 'feature' && note.type.toLowerCase().includes('feature')) ||
            (activeCategory === 'fixed' && note.type.toLowerCase().includes('fixed')) ||
            (activeCategory === 'change' && note.type.toLowerCase().includes('change')) ||
            (activeCategory === 'announcement' && note.type.toLowerCase().includes('announcement'));
            
        // Search Filter
        const matchesSearch = searchQuery === '' ||
            note.date.toLowerCase().includes(searchQuery) ||
            note.type.toLowerCase().includes(searchQuery) ||
            note.content_html.toLowerCase().includes(searchQuery);

        return matchesCategory && matchesSearch;
    });

    // Update Results count
    const countText = filteredNotes.length === 1 ? '1 update' : `${filteredNotes.length} updates`;
    resultsCount.textContent = countText;

    // Render Cards
    notesList.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    filteredNotes.forEach(note => {
        const card = document.createElement('article');
        card.className = `note-card ${selectedNoteId === note.id ? 'selected' : ''}`;
        card.dataset.id = note.id;

        const badgeClass = getBadgeClass(note.type);
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta">
                    <span class="badge ${badgeClass}">${note.type}</span>
                    <span class="date-badge">${note.date}</span>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn copy-btn" title="Copy plain text to clipboard">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="copy-icon">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="check-icon hidden">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <div class="card-arrow">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </div>
                </div>
            </div>
            <div class="card-body">
                ${note.content_html}
            </div>
        `;

        const copyBtn = card.querySelector('.copy-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card selection click
            copyNoteToClipboard(note, copyBtn);
        });

        card.addEventListener('click', () => selectNote(note.id));
        notesList.appendChild(card);
    });

    // Check if the previously selected note is still available in the filtered list
    if (selectedNoteId) {
        const noteExists = filteredNotes.some(n => n.id === selectedNoteId);
        if (!noteExists) {
            clearSelection();
        }
    }
}

// Select Note & Populate Preview Area
function selectNote(id) {
    selectedNoteId = id;

    // Add selected class in notes list
    document.querySelectorAll('.note-card').forEach(card => {
        if (card.dataset.id === id) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    const note = allNotes.find(n => n.id === id);
    if (!note) return;

    // Populate Sidebar Details Panel
    detailBadge.className = `badge ${getBadgeClass(note.type)}`;
    detailBadge.textContent = note.type;
    detailDate.textContent = note.date;
    detailContent.innerHTML = note.content_html;
    detailOriginalLink.href = note.original_link;
    
    // Set up tweet composer
    tweetTextArea.value = note.tweet_text;
    updateCharCount();

    // Show panel
    emptyPreview.classList.add('hidden');
    detailsPanel.classList.remove('hidden');

    // Handle Mobile Display (Open Bottom Drawer)
    if (window.innerWidth <= 768) {
        openMobileDrawer();
    }
}

// Clear Note Selection
function clearSelection() {
    selectedNoteId = null;
    document.querySelectorAll('.note-card').forEach(card => card.classList.remove('selected'));
    
    emptyPreview.classList.remove('hidden');
    detailsPanel.classList.add('hidden');
    closeMobileDrawer();
}

// Update Character Counter for Twitter Text
function updateCharCount() {
    const text = tweetTextArea.value;
    const remaining = 280 - text.length;
    charCounter.textContent = remaining;

    // Style helper based on length
    charCounter.className = '';
    if (remaining <= 20 && remaining > 0) {
        charCounter.classList.add('warning');
    } else if (remaining <= 0) {
        charCounter.classList.add('danger');
    }
    
    // Update SVG progress ring
    const radius = 8;
    const circumference = 2 * Math.PI * radius; // ~50.26
    const filledPercent = Math.min(text.length / 280, 1.0);
    const strokeDashoffset = circumference - (filledPercent * circumference);
    
    if (progressRingCircle) {
        progressRingCircle.style.strokeDashoffset = strokeDashoffset;
        
        // Shift circle stroke colors dynamically
        if (remaining <= 0) {
            progressRingCircle.style.stroke = 'var(--badge-fixed)';
        } else if (remaining <= 20) {
            progressRingCircle.style.stroke = 'var(--badge-change)';
        } else {
            progressRingCircle.style.stroke = 'var(--color-tweet)';
        }
    }
    
    // Disable tweet button if empty or too long
    tweetBtn.disabled = text.length === 0 || remaining < 0;
}

// Mobile Bottom Sheet Handlers
function openMobileDrawer() {
    // Copy the contents of the details panel to the drawer
    drawerContentContainer.innerHTML = '';
    
    // Clone node
    const clone = detailsPanel.cloneNode(true);
    clone.classList.remove('hidden');
    
    drawerContentContainer.appendChild(clone);
    
    // Wire up events in the cloned node
    const clonedTweetTextArea = drawerContentContainer.querySelector('#tweetTextArea');
    const clonedCharCounter = drawerContentContainer.querySelector('#charCounter');
    const clonedTweetBtn = drawerContentContainer.querySelector('#tweetBtn');

    // Re-wire char counter
    clonedTweetTextArea.addEventListener('input', () => {
        const text = clonedTweetTextArea.value;
        const remaining = 280 - text.length;
        clonedCharCounter.textContent = remaining;

        clonedCharCounter.className = '';
        if (remaining <= 20 && remaining > 0) {
            clonedCharCounter.classList.add('warning');
        } else if (remaining <= 0) {
            clonedCharCounter.classList.add('danger');
        }
        clonedTweetBtn.disabled = text.length === 0 || remaining < 0;
        
        // Sync back to desktop panel
        tweetTextArea.value = text;
        updateCharCount();
    });

    // Re-wire tweet button click
    clonedTweetBtn.addEventListener('click', () => {
        const text = clonedTweetTextArea.value;
        if (!text) return;
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank');
        showToast('Opening Twitter composer!');
    });

    // Make active
    drawerOverlay.classList.add('active');
    mobileDrawer.classList.add('active');
    document.body.style.overflow = 'hidden'; // Disable background scrolling
}

function closeMobileDrawer() {
    drawerOverlay.classList.remove('active');
    mobileDrawer.classList.remove('active');
    document.body.style.overflow = ''; // Re-enable scroll
}

// Connection status controller
function updateStatus(status, text) {
    const dot = feedStatus.querySelector('.status-dot');
    const textEl = feedStatus.querySelector('.status-text');

    // Remove all classes first
    dot.className = 'status-dot';
    textEl.textContent = text;

    if (status === 'connecting') {
        dot.classList.add('pulses');
    } else if (status === 'live') {
        dot.classList.add('live', 'pulses');
    } else if (status === 'mocked') {
        dot.classList.add('mocked', 'pulses');
    } else if (status === 'error') {
        dot.classList.add('error');
    }
}

// Badge CSS Class Helper
function getBadgeClass(type) {
    const t = type.toLowerCase();
    if (t.includes('feature')) return 'feature';
    if (t.includes('fixed') || t.includes('bug')) return 'fixed';
    if (t.includes('change')) return 'change';
    if (t.includes('announcement')) return 'announcement';
    return 'update';
}

// Show Alert Toast Message
function showToast(message, isError = false) {
    toastMsg.textContent = message;
    toast.className = 'toast-notification';
    
    if (isError) {
        toast.classList.add('error');
    }
    
    toast.classList.add('show');
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

// Direct Javascript fallback in case server returns empty notes or throws error
function getFallbackMockData() {
    return [
        {
            "id": "fallback-1",
            "date": "June 17, 2026",
            "type": "Feature",
            "content_html": "<p>You can enable <a href=\"https://docs.cloud.google.com/bigquery/docs/autonomous-embedding-generation\">autonomous embedding generation</a> on new or existing tables that you make with the <code>CREATE TABLE</code> or <code>ALTER TABLE</code> statements. When you do this, BigQuery maintains a column of embeddings on the table based on a source column.</p><p>This feature is <a href=\"https://cloud.google.com/products#product-launch-stages\">generally available</a> (GA).</p>",
            "tweet_text": "BigQuery Update (June 17, 2026) [Feature]: You can now enable autonomous embedding generation on tables using CREATE/ALTER TABLE statements! #BigQuery #GoogleCloud",
            "original_link": "https://cloud.google.com/bigquery/docs/release-notes#June_17_2026"
        },
        {
            "id": "fallback-2",
            "date": "June 16, 2026",
            "type": "Announcement",
            "content_html": "<p>Table Explorer behavior is moving to the <strong>Reference</strong> panel. This transition will occur in July 2026 or later. For more information, see <a href=\"https://docs.cloud.google.com/bigquery/docs/table-explorer\">Table Explorer</a>.</p>",
            "tweet_text": "BigQuery Update (June 16, 2026) [Announcement]: Table Explorer behavior is moving to the Reference panel starting July 2026. #BigQuery #GoogleCloud",
            "original_link": "https://cloud.google.com/bigquery/docs/release-notes#June_16_2026"
        }
    ];
}

// Update counts inside category pills
function updatePillCounts() {
    const counts = {
        all: allNotes.length,
        feature: 0,
        fixed: 0,
        change: 0,
        announcement: 0
    };

    allNotes.forEach(note => {
        const type = note.type.toLowerCase();
        if (type.includes('feature')) counts.feature++;
        else if (type.includes('fixed') || type.includes('bug')) counts.fixed++;
        else if (type.includes('change')) counts.change++;
        else if (type.includes('announcement')) counts.announcement++;
    });

    document.querySelectorAll('#categoryPills .pill').forEach(pill => {
        const category = pill.dataset.category;
        const count = counts[category] !== undefined ? counts[category] : 0;
        
        let label = 'All';
        if (category === 'feature') label = 'Features';
        else if (category === 'fixed') label = 'Fixes';
        else if (category === 'change') label = 'Changes';
        else if (category === 'announcement') label = 'Announcements';
        
        pill.textContent = `${label} (${count})`;
    });
}

// Keyboard arrow navigation for release notes list
document.addEventListener('keydown', (e) => {
    // Only toggle if composer/search inputs aren't focused
    const active = document.activeElement.tagName.toLowerCase();
    if (active === 'input' || active === 'textarea') return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (filteredNotes.length === 0) return;
        e.preventDefault();

        let newIdx = 0;
        if (selectedNoteId) {
            const currentIdx = filteredNotes.findIndex(n => n.id === selectedNoteId);
            if (e.key === 'ArrowDown') {
                newIdx = (currentIdx + 1) % filteredNotes.length;
            } else {
                newIdx = (currentIdx - 1 + filteredNotes.length) % filteredNotes.length;
            }
        }
        
        selectNote(filteredNotes[newIdx].id);

        const selectedCard = document.querySelector(`.note-card[data-id="${filteredNotes[newIdx].id}"]`);
        if (selectedCard) {
            selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
});

// Copy single release note plain text to clipboard
function copyNoteToClipboard(note, btn) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(note.content_html, 'text/html');
    const plainText = doc.body.textContent || doc.body.innerText || "";
    const textToCopy = `[BigQuery Update - ${note.date} - ${note.type}]\n${plainText.trim()}`;

    navigator.clipboard.writeText(textToCopy).then(() => {
        const copyIcon = btn.querySelector('.copy-icon');
        const checkIcon = btn.querySelector('.check-icon');
        
        copyIcon.classList.add('hidden');
        checkIcon.classList.remove('hidden');
        btn.classList.add('copied');
        
        showToast('Copied to clipboard!');
        
        setTimeout(() => {
            copyIcon.classList.remove('hidden');
            checkIcon.classList.add('hidden');
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy to clipboard', true);
    });
}

// Export the currently filtered notes to a CSV file
function exportToCSV() {
    if (filteredNotes.length === 0) {
        showToast('No notes to export!', true);
        return;
    }

    const headers = ['Date', 'Type', 'Content (HTML)', 'Link'];
    const rows = filteredNotes.map(note => {
        const date = note.date.replace(/"/g, '""');
        const type = note.type.replace(/"/g, '""');
        const htmlContent = note.content_html.replace(/"/g, '""');
        const link = note.original_link.replace(/"/g, '""');
        return `"${date}","${type}","${htmlContent}","${link}"`;
    });

    // Include UTF-8 BOM (\uFEFF) to make Excel parse UTF-8 characters correctly
    const csvContent = "\uFEFF" + [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    let filename = 'bigquery_release_notes';
    if (activeCategory !== 'all') {
        filename += `_${activeCategory}`;
    }
    if (searchQuery) {
        filename += `_${searchQuery.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
    }
    filename += '.csv';

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Exported ${filteredNotes.length} updates to CSV!`);
}
