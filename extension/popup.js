// popup.js

document.addEventListener('DOMContentLoaded', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const cfg = await chrome.storage.sync.get(['appBaseUrl', 'applyPilotApiKey']);
    const appBaseUrl = (cfg.appBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
    const apiKey = cfg.applyPilotApiKey || '';

    if (!tab) return;
    let parsedData = null;
    let mode = 'job';
    const modeHint = document.getElementById('modeHint');
    const companyLabel = document.getElementById('companyLabel');
    const titleLabel = document.getElementById('titleLabel');
    const linkLabel = document.getElementById('linkLabel');
    const saveBtn = document.getElementById('saveBtn');

    // Execute script to parse page
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: parsePage
    }, (results) => {
        if (results && results[0] && results[0].result) {
            const data = results[0].result;
            parsedData = data;
            mode = data.pageType === 'linkedin_profile' ? 'linkedin_profile' : 'job';

            document.getElementById('company').value = data.company || data.name || '';
            document.getElementById('title').value = data.title || data.headline || '';
            document.getElementById('link').value = tab.url || '';
            document.getElementById('description').value = data.description || data.rawText || ''; // Hidden field for payload

            if (mode === 'linkedin_profile') {
                companyLabel.textContent = 'Name';
                titleLabel.textContent = 'Headline';
                linkLabel.textContent = 'Profile URL';
                saveBtn.textContent = 'Save LinkedIn Profile';
                modeHint.textContent = 'LinkedIn profile detected. Save this to improve profile sync quality.';
                modeHint.style.display = 'block';
            } else {
                companyLabel.textContent = 'Company';
                titleLabel.textContent = 'Job Title';
                linkLabel.textContent = 'Job URL';
                saveBtn.textContent = 'Save to ApplyPilot';
                modeHint.textContent = 'Job page detected. Save this posting to your pipeline.';
                modeHint.style.display = 'block';
            }

            document.getElementById('loading').style.display = 'none';
            document.getElementById('jobForm').style.display = 'block';
        }
    });

    // Handle Submit
    document.getElementById('jobForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = saveBtn;
        const status = document.getElementById('status');

        btn.disabled = true;
        btn.textContent = 'Saving...';

        const payload = mode === 'linkedin_profile'
            ? {
                profileUrl: document.getElementById('link').value,
                name: document.getElementById('company').value,
                headline: document.getElementById('title').value,
                location: parsedData?.location || "",
                about: parsedData?.about || "",
                rawText: parsedData?.rawText || document.getElementById('description').value || "",
            }
            : {
                company: document.getElementById('company').value,
                title: document.getElementById('title').value,
                link: document.getElementById('link').value,
                description: document.getElementById('description').value,
                source: "Extension"
            };

        try {
            const endpoint = mode === 'linkedin_profile'
                ? `${appBaseUrl}/api/extension/save-linkedin-profile`
                : `${appBaseUrl}/api/extension/save-job`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey ? { 'X-ApplyPilot-Key': apiKey } : {})
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json().catch(() => ({}));
                status.textContent = mode === 'linkedin_profile'
                    ? 'LinkedIn profile saved and synced to Profile!'
                    : 'Job saved successfully!';
                status.className = 'success';
                status.style.display = 'block';
                if (mode === 'linkedin_profile' && result?.updated) {
                    console.log('LinkedIn sync details:', result.updated);
                }
                setTimeout(() => window.close(), 1500);
            } else {
                const err = await response.json().catch(() => ({}));
                throw new Error(err?.error || 'Failed to save');
            }
        } catch (error) {
            console.error(error);
            status.textContent = `Error: ${(error && error.message) ? error.message : 'Make sure ApplyPilot is running at localhost:3000'}`;
            status.className = 'error';
            status.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Save to ApplyPilot';
        }
    });
});

// This function runs in the context of the page
function parsePage() {
    function getMeta(name) {
        const meta = document.querySelector(`meta[property="${name}"]`) || document.querySelector(`meta[name="${name}"]`);
        return meta ? meta.content : null;
    }

    // Universal Heuristics
    let title = getMeta('og:title') || document.title;
    let company = getMeta('og:site_name') || "";
    let description = getMeta('og:description') || "";

    // LinkedIn Specific
    if (window.location.hostname.includes('linkedin.com')) {
        if (window.location.pathname.includes('/in/')) {
            const firstText = (selector) => {
                const el = document.querySelector(selector);
                return el ? el.textContent.trim() : '';
            };

            const name = firstText('h1');
            const headline = firstText('.text-body-medium.break-words') || firstText('.text-body-medium');
            const location = firstText('.text-body-small.inline') || firstText('.pv-text-details__left-panel div:nth-child(2)');
            const aboutSection = Array.from(document.querySelectorAll('section'))
                .find((s) => s.textContent?.toLowerCase().includes('about'));
            const about = aboutSection?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 500) || '';
            const experienceSection = Array.from(document.querySelectorAll('section'))
                .find((s) => s.textContent?.toLowerCase().includes('experience'));
            const skillsSection = Array.from(document.querySelectorAll('section'))
                .find((s) => s.textContent?.toLowerCase().includes('skills'));
            const rawText = [
                document.body?.innerText || '',
                experienceSection?.textContent || '',
                skillsSection?.textContent || ''
            ]
                .join(' ')
                .replace(/\r/g, '\n')
                .replace(/[ \t]+/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim()
                .slice(0, 20000);
            return { pageType: 'linkedin_profile', name, headline, location, about, rawText };
        }

        const h1 = document.querySelector('.job-details-jobs-unified-top-card__job-title h1');
        if (h1) title = h1.textContent.trim();

        const companyLink = document.querySelector('.job-details-jobs-unified-top-card__company-name a');
        if (companyLink) company = companyLink.textContent.trim();

        const descDiv = document.querySelector('#job-details');
        if (descDiv) description = descDiv.innerText;
    }

    // Indeed Specific
    if (window.location.hostname.includes('indeed.com')) {
        const h1 = document.querySelector('.jobsearch-JobInfoHeader-title');
        if (h1) title = h1.textContent.trim();

        const comp = document.querySelector('[data-company-name="true"]');
        if (comp) company = comp.textContent.trim();
    }

    // Y Combinator 
    if (window.location.hostname.includes('ycombinator.com')) {
        const h1 = document.querySelector('.company-name');
        if (h1) company = h1.textContent.trim();

        const role = document.querySelector('.job-title');
        if (role) title = role.textContent.trim();
    }

    return { pageType: 'job', title, company, description };
}
