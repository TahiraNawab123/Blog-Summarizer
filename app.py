from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import requests

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests for local development

# Helper function to check if input is a URL
URL_REGEX = re.compile(r'^https?://')

def is_url(text):
    return bool(URL_REGEX.match(text.strip()))

# Function to fetch text content from a URL
# For demo: fetches raw HTML, but you can improve to extract main content
# For real use, use BeautifulSoup or newspaper3k for better extraction
def fetch_url_content(url):
    try:
        response = requests.get(url, timeout=8)
        response.raise_for_status()
        # Just return first 2000 chars of HTML for demo
        return response.text[:2000]
    except Exception as e:
        return None

# Placeholder summarization function
# Replace this with OpenAI API call if you have an API key
def summarize_text(text, length='short'):
    """
    Summarize the input text. This is a placeholder.
    Replace with OpenAI GPT or other summarization logic as needed.
    """
    if length == 'short':
        return text[:120] + ('...' if len(text) > 120 else '')
    else:
        return text[:250] + ('...' if len(text) > 250 else '')

@app.route('/summarise', methods=['POST'])
def summarise():
    data = request.get_json()
    input_text = data.get('input', '')
    length = data.get('length', 'short')
    if not input_text:
        return jsonify({'error': 'No input provided.'}), 400
    # If input is a URL, fetch its content
    if is_url(input_text):
        fetched = fetch_url_content(input_text)
        if not fetched:
            return jsonify({'error': 'Could not fetch content from the URL.'}), 400
        input_text = fetched
    # Call the summarization function
    summary = summarize_text(input_text, length)
    return jsonify({'summary': summary})

if __name__ == '__main__':
    app.run(debug=True) 