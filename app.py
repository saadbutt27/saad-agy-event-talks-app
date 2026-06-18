import re
import xml.etree.ElementTree as ET
import requests
import urllib3
from bs4 import BeautifulSoup, NavigableString
from flask import Flask, jsonify, render_template

# Disable SSL verification warnings for corporate proxy environments/strict policies
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)

# Fallback mocked data in case network is down or feeds are completely unavailable
MOCK_NOTES = [
    {
        "id": "mock-1",
        "date": "June 17, 2026",
        "type": "Feature",
        "content_html": "<p>You can enable <a href=\"https://docs.cloud.google.com/bigquery/docs/autonomous-embedding-generation\">autonomous embedding generation</a> on new or existing tables that you make with the <code>CREATE TABLE</code> or <code>ALTER TABLE</code> statements. When you do this, BigQuery maintains a column of embeddings on the table based on a source column.</p><p>This feature is <a href=\"https://cloud.google.com/products#product-launch-stages\">generally available</a> (GA).</p>",
        "tweet_text": "BigQuery Update (June 17, 2026) [Feature]: You can now enable autonomous embedding generation on tables using CREATE/ALTER TABLE statements! #BigQuery #GoogleCloud",
        "original_link": "https://cloud.google.com/bigquery/docs/release-notes#June_17_2026"
    },
    {
        "id": "mock-2",
        "date": "June 16, 2026",
        "type": "Announcement",
        "content_html": "<p>Table Explorer behavior is moving to the <strong>Reference</strong> panel. This transition will occur in July 2026 or later. For more information, see <a href=\"https://docs.cloud.google.com/bigquery/docs/table-explorer\">Table Explorer</a>.</p>",
        "tweet_text": "BigQuery Update (June 16, 2026) [Announcement]: Table Explorer behavior is moving to the Reference panel starting July 2026. #BigQuery #GoogleCloud",
        "original_link": "https://cloud.google.com/bigquery/docs/release-notes#June_16_2026"
    },
    {
        "id": "mock-3",
        "date": "June 10, 2026",
        "type": "Feature",
        "content_html": "<p>BigQuery search index support for <code>ARRAY</code> columns is now in Preview. You can create search indexes on columns of type <code>ARRAY&lt;STRING&gt;</code> to speed up searches of array elements.</p>",
        "tweet_text": "BigQuery Update (June 10, 2026) [Feature]: Support for indexing ARRAY<STRING> columns is now in Preview, speeding up array element queries. #BigQuery #GoogleCloud",
        "original_link": "https://cloud.google.com/bigquery/docs/release-notes#June_10_2026"
    },
    {
        "id": "mock-4",
        "date": "June 03, 2026",
        "type": "Fixed",
        "content_html": "<p>Fixed an issue where querying partition-filtered tables with complex subqueries occasionally resulted in a <code>Table partition filter not applied</code> error.</p>",
        "tweet_text": "BigQuery Update (June 03, 2026) [Fixed]: Resolved partition filter errors occurring with complex subqueries on partitioned tables. #BigQuery #GoogleCloud",
        "original_link": "https://cloud.google.com/bigquery/docs/release-notes#June_03_2026"
    }
]

def fetch_and_parse_feed():
    primary_url = "https://docs.cloud.google.com/feeds/bigquery-notes.xml"
    fallback_url = "https://cloud.google.com/feeds/gcp-release-notes.xml"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    xml_data = None
    used_fallback = False
    
    # Try primary URL
    try:
        r = requests.get(primary_url, headers=headers, timeout=8)
        if r.status_code == 200:
            xml_data = r.text
        else:
            print(f"Primary feed returned status {r.status_code}. Trying fallback unified feed...")
            r = requests.get(fallback_url, headers=headers, timeout=8, verify=False)
            if r.status_code == 200:
                xml_data = r.text
                used_fallback = True
    except Exception as e:
        print(f"Error fetching primary feed: {e}. Trying fallback...")
        try:
            r = requests.get(fallback_url, headers=headers, timeout=8, verify=False)
            if r.status_code == 200:
                xml_data = r.text
                used_fallback = True
        except Exception as e2:
            print(f"Error fetching fallback feed: {e2}")
            
    if not xml_data:
        print("Using mocked data due to network failures.")
        return MOCK_NOTES, True
        
    try:
        # Atom feed namespace URI
        ns = "{http://www.w3.org/2005/Atom}"
        
        # Clean encoding issue if any
        root = ET.fromstring(xml_data.encode('utf-8', errors='ignore'))
        
        entries_data = []
        entries = root.findall(f'.//{ns}entry')
        
        for idx, entry in enumerate(entries):
            title_el = entry.find(f'{ns}title')
            content_el = entry.find(f'{ns}content')
            id_el = entry.find(f'{ns}id')
            
            date_str = title_el.text.strip() if title_el is not None and title_el.text else "Unknown Date"
            content_html = content_el.text if content_el is not None and content_el.text else ""
            entry_id = id_el.text.strip() if id_el is not None and id_el.text else f"entry-{idx}"
            
            if not content_html:
                continue
                
            soup = BeautifulSoup(content_html, 'html.parser')
            product_headings = soup.find_all(class_="release-note-product-title")
            
            bq_elements = []
            if product_headings or used_fallback:
                # Filter for BigQuery specific items in unified feed
                bq_heading = None
                for h2 in product_headings:
                    if "bigquery" in h2.text.strip().lower():
                        bq_heading = h2
                        break
                
                if not bq_heading:
                    continue
                    
                # Extract all siblings until the next h2 release-note-product-title
                curr = bq_heading.next_sibling
                while curr:
                    if curr.name == 'h2' and curr.get('class') and 'release-note-product-title' in curr.get('class'):
                        break
                    bq_elements.append(curr)
                    curr = curr.next_sibling
            else:
                # Treat entire entry as BigQuery
                bq_elements = list(soup.children)
                
            # Group elements by h3
            current_type = "Update"
            current_elements = []
            grouped_updates = []
            
            for el in bq_elements:
                if el is None:
                    continue
                if el.name == 'h3':
                    if current_elements:
                        grouped_updates.append((current_type, current_elements))
                        current_elements = []
                    current_type = el.text.strip()
                else:
                    current_elements.append(el)
            
            if current_elements:
                grouped_updates.append((current_type, current_elements))
                
            for sub_idx, (up_type, elements) in enumerate(grouped_updates):
                group_soup = BeautifulSoup("", "html.parser")
                for el in elements:
                    if isinstance(el, NavigableString):
                        group_soup.append(el)
                    else:
                        group_soup.append(BeautifulSoup(str(el), "html.parser"))
                        
                raw_html = str(group_soup).strip()
                text_content = group_soup.get_text().strip()
                text_content = re.sub(r'\s+', ' ', text_content)
                
                # Skip empty nodes
                if not text_content:
                    continue
                    
                item_id = f"{entry_id}-{sub_idx}"
                # Format Tweet (280 max)
                tweet_intro = f"BigQuery Update ({date_str}) [{up_type}]: "
                max_text_len = 280 - len(tweet_intro) - 30 # buffer for tags
                if len(text_content) > max_text_len:
                    short_text = text_content[:max_text_len-3] + "..."
                else:
                    short_text = text_content
                
                tweet_text = f"{tweet_intro}{short_text} #BigQuery #GCP"
                
                entries_data.append({
                    "id": item_id,
                    "date": date_str,
                    "type": up_type,
                    "content_html": raw_html,
                    "tweet_text": tweet_text,
                    "original_link": f"https://cloud.google.com/bigquery/docs/release-notes#{date_str.replace(' ', '_').replace(',', '')}"
                })
                
        if not entries_data:
            print("No BigQuery updates parsed from live feed, using mock fallback.")
            return MOCK_NOTES, True
            
        return entries_data, False
    except Exception as e:
        print(f"Error parsing feed XML: {e}, falling back to mock data.")
        return MOCK_NOTES, True

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    notes, is_mocked = fetch_and_parse_feed()
    return jsonify({
        "notes": notes,
        "is_mocked": is_mocked
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
