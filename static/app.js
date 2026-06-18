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

// Preview DOM Elements
const emptyPreview = document.getElementById('emptyPreview');
const detailsPanel = document.getElementById('detailsPanel');
const detailBadge = document.getElementById('detailBadge');
const detailDate = document.getElementById('detailDate');
const detailContent = document.getElementById('detailContent');
const detailOriginalLink = document.getElementById('detailOriginalLink');
const tweetTextArea = document.getElementById('tweetTextArea');
const charCounter = document.getElementById('charCounter');
const tweetBtn = document.getElementById('tweetBtn');

// Mobile Drawer Elements
const drawerOverlay = document.getElementById('drawerOverlay');
const mobileDrawer = document.getElementById('mobileDrawer');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const drawerContentContainer = document.getElementById('drawerContentContainer');

// Toast Notification
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

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
        
        // Update connection status dot
        if (data.is_mocked) {
            updateStatus('mocked', 'Mocked Data');
            showToast('Unable to connect to live feeds. Showing cached data.', true);
        } else {
            updateStatus('live', 'Live Feed Connected');
            showToast('Feed refreshed successfully!');
        }

        // Apply current filter & render notes
        filterAndRender();

    } catch (error) {
        console.error('Failed to fetch release notes:', error);
        updateStatus('error', 'Connection Error');
        showToast('Connection failed. Using fallback data.', true);
        
        // Use local mockup in case backend API crashes completely
        allNotes = getFallbackMockData();
        filterAndRender();
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

        // Clean description text for small body previews
        const badgeClass = getBadgeClass(note.type);
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta">
                    <span class="badge ${badgeClass}">${note.type}</span>
                    <span class="date-badge">${note.date}</span>
                </div>
                <div class="card-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </div>
            </div>
            <div class="card-body">
                ${note.content_html}
            </div>
        `;

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
