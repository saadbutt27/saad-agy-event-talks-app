# 🚀 BigQuery Release Explorer

BigQuery Release Explorer is a responsive, modern web application built using **Python Flask** and **Vanilla HTML5, CSS3, and JavaScript**. It fetches GCP release feeds in real-time, extracts BigQuery specific updates, structures them by category, and provides search, filtering, and social sharing capability to X/Twitter.

---

## 🌟 Key Features

* **Resilient Dual-Feed Parser**: Tries to connect to the dedicated BigQuery XML feed. If it returns a 404, the parser automatically redirects to the unified GCP release notes feed and filters out everything except BigQuery notes.
* **Granular Extraction**: Segregates daily release lists into individual, selectable cards categorized by types like **Feature**, **Fixed**, **Change**, and **Announcement**.
* **Glassmorphic Space Aesthetics**: Responsive layout styled with a dark-cyber theme, interactive hover states, pulse indicators, and transition animations.
* **Instant Filtering & Searching**: Front-end search matches dates, keywords, or HTML contents, combined with category pills for rapid discovery.
* **Interactive X/Twitter Composer**: Renders a mockup social card mimicking an X/Twitter post. It pre-fills details from the selected card, supports real-time edits, validates character boundaries (280 characters), and hooks into the official Twitter Web Intent API.
* **Mobile Adaptability**: Single-column view on mobile screens featuring a smooth, sliding bottom sheet drawer for note inspection and tweeting.
* **Connection Health Check**: Indicates whether the browser displays live parsed updates, offline cached configurations, or mock fallbacks.

---

## 🛠️ Technology Stack

* **Backend**: Python 3.10+, Flask, BeautifulSoup4, ElementTree, Requests, Urllib3
* **Frontend**: HTML5, Vanilla CSS3 (custom variables, keyframes, transitions), Vanilla JavaScript (async fetch, event delegates, DOM replication)

---

## 📁 Repository Structure

```
├── app.py                  # Flask main entrypoint, routing, and feed parser
├── requirements.txt        # Python package dependencies
├── .gitignore              # Files excluded from git tracking
├── templates/
│   └── index.html          # Semantic HTML layout
└── static/
    ├── style.css           # Styling sheet (glassmorphic dark design)
    └── app.js              # State manager, search filter, and composer actions
```

---

## 🚀 Quick Start

### 1. Prerequisites
Make sure you have Python 3.10+ installed on your system.

### 2. Clone and Setup
Open your terminal in the project directory:

```bash
# Initialize virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.\.venv\bin\Activate.ps1
# On Windows (CMD):
.\.venv\bin\activate.bat
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Run the Server
Launch the Flask development server:

```bash
python app.py
```

Open your browser and navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

---

## 🔄 How the XML Feed is Parsed

1. The client sends a request to `/api/notes`.
2. The server attempts to query `https://docs.cloud.google.com/feeds/bigquery-notes.xml`.
3. If it fails, the server requests the main GCP feed: `https://cloud.google.com/feeds/gcp-release-notes.xml`.
4. The server parses the Atom XML using namespaces and isolates the HTML content under the `<h2 class="release-note-product-title">BigQuery</h2>` tag.
5. The HTML elements are grouped by `<h3>` tags to split the feed into separate updates (e.g. distinct card blocks for Features vs Fixed logs).
6. An optimized Tweet compose string is generated for each item and returned as a JSON array.
