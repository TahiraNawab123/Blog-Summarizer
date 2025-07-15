// Get references to DOM elements
const summariseBtn = document.getElementById('summarise-btn');
const blogInput = document.getElementById('blog-input');
const summarySection = document.getElementById('summary-section');
const summaryOutput = document.getElementById('summary-output');
const copyBtn = document.getElementById('copy-btn');

// Function to get selected summary length
function getSummaryLength() {
    const radios = document.getElementsByName('length');
    for (let radio of radios) {
        if (radio.checked) return radio.value;
    }
    return 'short'; // default
}

// Handle Summarise button click
summariseBtn.addEventListener('click', async () => {
    const input = blogInput.value.trim();
    const length = getSummaryLength();
    if (!input) {
        alert('Please paste blog content or a URL.');
        return;
    }
    // Show loading state
    summariseBtn.disabled = true;
    summariseBtn.textContent = 'Summarising...';
    summarySection.classList.add('hidden');
    try {
        // Send input and length to backend
        const response = await fetch('/summarise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input, length })
        });
        const data = await response.json();
        if (data.summary) {
            summaryOutput.textContent = data.summary;
            summarySection.classList.remove('hidden');
        } else {
            summaryOutput.textContent = 'No summary returned.';
            summarySection.classList.remove('hidden');
        }
    } catch (err) {
        summaryOutput.textContent = 'Error: ' + err.message;
        summarySection.classList.remove('hidden');
    } finally {
        summariseBtn.disabled = false;
        summariseBtn.textContent = 'Summarise';
    }
});

// Handle Copy button click
copyBtn.addEventListener('click', () => {
    const summary = summaryOutput.textContent;
    if (summary) {
        navigator.clipboard.writeText(summary);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Copy Summary';
        }, 1200);
    }
}); 