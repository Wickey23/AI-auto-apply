document.addEventListener("DOMContentLoaded", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const settingsToggle = document.getElementById("settingsToggle");
    const settingsPanel = document.getElementById("settingsPanel");
    const saveSettingsBtn = document.getElementById("saveSettingsBtn");
    const testSettingsBtn = document.getElementById("testSettingsBtn");
    const resetSettingsBtn = document.getElementById("resetSettingsBtn");
    const appBaseUrlInput = document.getElementById("appBaseUrlInput");
    const apiKeyInput = document.getElementById("apiKeyInput");
    const userTokenInput = document.getElementById("userTokenInput");
    const autopilotEnabledInput = document.getElementById("autopilotEnabledInput");
    const autopilotSubmitInput = document.getElementById("autopilotSubmitInput");

    const modeHint = document.getElementById("modeHint");
    const companyLabel = document.getElementById("companyLabel");
    const titleLabel = document.getElementById("titleLabel");
    const linkLabel = document.getElementById("linkLabel");
    const saveBtn = document.getElementById("saveBtn");
    const loading = document.getElementById("loading");
    const jobForm = document.getElementById("jobForm");
    const status = document.getElementById("status");

    const cfg = await chrome.storage.sync.get(["appBaseUrl", "applyPilotApiKey", "applyPilotUserToken", "autopilotEnabled", "autopilotSubmit"]);
    appBaseUrlInput.value = cfg.appBaseUrl || "http://localhost:3000";
    apiKeyInput.value = cfg.applyPilotApiKey || "";
    userTokenInput.value = cfg.applyPilotUserToken || "";
    autopilotEnabledInput.checked = Boolean(cfg.autopilotEnabled);
    autopilotSubmitInput.checked = Boolean(cfg.autopilotSubmit);

    settingsToggle.addEventListener("click", () => {
        const isOpen = settingsPanel.style.display === "block";
        settingsPanel.style.display = isOpen ? "none" : "block";
    });

    saveSettingsBtn.addEventListener("click", async () => {
        const cleanedUrl = (appBaseUrlInput.value || "").trim().replace(/\/+$/, "");
        const cleanedKey = (apiKeyInput.value || "").trim();
        await chrome.storage.sync.set({
            appBaseUrl: cleanedUrl || "http://localhost:3000",
            applyPilotApiKey: cleanedKey,
            applyPilotUserToken: (userTokenInput.value || "").trim(),
            autopilotEnabled: Boolean(autopilotEnabledInput.checked),
            autopilotSubmit: Boolean(autopilotSubmitInput.checked),
        });
        showStatus("Settings saved.", "success");
    });

    testSettingsBtn.addEventListener("click", async () => {
        const cleanedUrl = (appBaseUrlInput.value || "").trim().replace(/\/+$/, "");
        const cleanedKey = (apiKeyInput.value || "").trim();
        const userToken = (userTokenInput.value || "").trim();
        if (!cleanedUrl) {
            showStatus("Set a valid ApplyPilot base URL first.", "error");
            return;
        }
        if (!userToken) {
            showStatus("Missing User Token. Generate one in ApplyPilot Settings.", "error");
            return;
        }

        try {
            const res = await fetch(`${cleanedUrl}/api/extension/ping`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(cleanedKey ? { "X-ApplyPilot-Key": cleanedKey } : {}),
                    "X-ApplyPilot-User-Token": userToken,
                },
                body: JSON.stringify({ ping: true }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || "Connection failed.");
            showStatus(`Connected to ApplyPilot as ${json?.userId || "user"}.`, "success");
        } catch (error) {
            showStatus(`Error: ${(error && error.message) ? error.message : "Connection failed."}`, "error");
        }
    });

    resetSettingsBtn.addEventListener("click", async () => {
        appBaseUrlInput.value = "http://localhost:3000";
        apiKeyInput.value = "";
        userTokenInput.value = "";
        autopilotEnabledInput.checked = false;
        autopilotSubmitInput.checked = false;
        await chrome.storage.sync.set({ appBaseUrl: "http://localhost:3000", applyPilotApiKey: "", applyPilotUserToken: "", autopilotEnabled: false, autopilotSubmit: false });
        showStatus("Settings reset.", "success");
    });

    let parsedData = null;
    let mode = "job";
    chrome.scripting.executeScript(
        {
            target: { tabId: tab.id },
            function: parsePage,
        },
        (results) => {
            if (!results || !results[0] || !results[0].result) {
                showStatus("Could not parse page details.", "error");
                return;
            }
            const data = results[0].result;
            parsedData = data;
            mode = data.pageType === "linkedin_profile" ? "linkedin_profile" : "job";

            document.getElementById("company").value = data.company || data.name || "";
            document.getElementById("title").value = data.title || data.headline || "";
            document.getElementById("link").value = tab.url || "";
            document.getElementById("description").value = data.description || data.rawText || "";

            if (mode === "linkedin_profile") {
                companyLabel.textContent = "Name";
                titleLabel.textContent = "Headline";
                linkLabel.textContent = "Profile URL";
                saveBtn.textContent = "Save LinkedIn Profile";
                modeHint.textContent = "LinkedIn profile detected. Save this to improve profile sync quality.";
            } else {
                companyLabel.textContent = "Company";
                titleLabel.textContent = "Job Title";
                linkLabel.textContent = "Job URL";
                saveBtn.textContent = "Save to ApplyPilot";
                modeHint.textContent = "Job page detected. Save this posting to your pipeline.";
            }
            modeHint.style.display = "block";
            loading.style.display = "none";
            jobForm.style.display = "block";
        }
    );

    jobForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const currentCfg = await chrome.storage.sync.get(["appBaseUrl", "applyPilotApiKey", "applyPilotUserToken"]);
        const appBaseUrl = (currentCfg.appBaseUrl || "http://localhost:3000").replace(/\/+$/, "");
        const apiKey = currentCfg.applyPilotApiKey || "";
        const userToken = currentCfg.applyPilotUserToken || "";

        if (!userToken) {
            showStatus("Missing User Token. Open Settings and paste your token from ApplyPilot Settings.", "error");
            saveBtn.disabled = false;
            saveBtn.textContent = mode === "linkedin_profile" ? "Save LinkedIn Profile" : "Save to ApplyPilot";
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        const payload =
            mode === "linkedin_profile"
                ? {
                      profileUrl: document.getElementById("link").value,
                      name: document.getElementById("company").value,
                      headline: document.getElementById("title").value,
                      location: parsedData?.location || "",
                      about: parsedData?.about || "",
                      rawText: parsedData?.rawText || document.getElementById("description").value || "",
                  }
                : {
                      company: document.getElementById("company").value,
                      title: document.getElementById("title").value,
                      link: document.getElementById("link").value,
                      description: document.getElementById("description").value,
                      source: "Extension",
                  };

        try {
            const endpoint =
                mode === "linkedin_profile"
                    ? `${appBaseUrl}/api/extension/save-linkedin-profile`
                    : `${appBaseUrl}/api/extension/save-job`;

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(apiKey ? { "X-ApplyPilot-Key": apiKey } : {}),
                    "X-ApplyPilot-User-Token": userToken,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err?.error || "Failed to save");
            }

            showStatus(
                mode === "linkedin_profile"
                    ? "LinkedIn profile saved and synced."
                    : "Job saved successfully.",
                "success"
            );
            window.setTimeout(() => window.close(), 1200);
        } catch (error) {
            const message = error && error.message ? error.message : "Save failed";
            showStatus(`Error: ${message}`, "error");
            saveBtn.disabled = false;
            saveBtn.textContent = mode === "linkedin_profile" ? "Save LinkedIn Profile" : "Save to ApplyPilot";
        }
    });

    function showStatus(message, tone) {
        status.textContent = message;
        status.className = tone;
        status.style.display = "block";
    }
});

function parsePage() {
    function getMeta(name) {
        const meta = document.querySelector(`meta[property="${name}"]`) || document.querySelector(`meta[name="${name}"]`);
        return meta ? meta.content : null;
    }

    let title = getMeta("og:title") || document.title;
    let company = getMeta("og:site_name") || "";
    let description = getMeta("og:description") || "";

    if (window.location.hostname.includes("linkedin.com")) {
        if (window.location.pathname.includes("/in/")) {
            const firstText = (selector) => {
                const el = document.querySelector(selector);
                return el ? el.textContent.trim() : "";
            };

            const name = firstText("h1");
            const headline = firstText(".text-body-medium.break-words") || firstText(".text-body-medium");
            const location = firstText(".text-body-small.inline") || firstText(".pv-text-details__left-panel div:nth-child(2)");
            const aboutSection = Array.from(document.querySelectorAll("section")).find((s) => s.textContent?.toLowerCase().includes("about"));
            const about = aboutSection?.textContent?.replace(/\s+/g, " ").trim().slice(0, 500) || "";
            const experienceSection = Array.from(document.querySelectorAll("section")).find((s) => s.textContent?.toLowerCase().includes("experience"));
            const skillsSection = Array.from(document.querySelectorAll("section")).find((s) => s.textContent?.toLowerCase().includes("skills"));
            const rawText = [document.body?.innerText || "", experienceSection?.textContent || "", skillsSection?.textContent || ""]
                .join(" ")
                .replace(/\r/g, "\n")
                .replace(/[ \t]+/g, " ")
                .replace(/\n{3,}/g, "\n\n")
                .trim()
                .slice(0, 20000);
            return { pageType: "linkedin_profile", name, headline, location, about, rawText };
        }

        const h1 = document.querySelector(".job-details-jobs-unified-top-card__job-title h1");
        if (h1) title = h1.textContent.trim();

        const companyLink = document.querySelector(".job-details-jobs-unified-top-card__company-name a");
        if (companyLink) company = companyLink.textContent.trim();

        const descDiv = document.querySelector("#job-details");
        if (descDiv) description = descDiv.innerText;
    }

    if (window.location.hostname.includes("indeed.com")) {
        const h1 = document.querySelector(".jobsearch-JobInfoHeader-title");
        if (h1) title = h1.textContent.trim();
        const comp = document.querySelector("[data-company-name='true']");
        if (comp) company = comp.textContent.trim();
    }

    if (window.location.hostname.includes("ycombinator.com")) {
        const h1 = document.querySelector(".company-name");
        if (h1) company = h1.textContent.trim();
        const role = document.querySelector(".job-title");
        if (role) title = role.textContent.trim();
    }

    return { pageType: "job", title, company, description };
}
