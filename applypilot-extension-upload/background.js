const AUTOPILOT_ALARM = "applypilot-autopilot-tick";

chrome.runtime.onInstalled.addListener(async () => {
  await ensureAutoPilotAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAutoPilotAlarm();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.autopilotEnabled) return;
  const enabled = Boolean(changes.autopilotEnabled.newValue);
  if (enabled) chrome.alarms.create(AUTOPILOT_ALARM, { periodInMinutes: 1 });
  else chrome.alarms.clear(AUTOPILOT_ALARM);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== AUTOPILOT_ALARM) return;
  try {
    await runAutoPilotTick();
  } catch (error) {
    console.error("AutoPilot tick failed:", error);
  }
});

async function ensureAutoPilotAlarm() {
  const cfg = await chrome.storage.sync.get(["autopilotEnabled"]);
  if (cfg.autopilotEnabled) {
    chrome.alarms.create(AUTOPILOT_ALARM, { periodInMinutes: 1 });
  } else {
    chrome.alarms.clear(AUTOPILOT_ALARM);
  }
}

async function runAutoPilotTick() {
  const cfg = await chrome.storage.sync.get([
    "appBaseUrl",
    "applyPilotApiKey",
    "applyPilotUserToken",
    "autopilotEnabled",
    "autopilotSubmit",
  ]);
  if (!cfg.autopilotEnabled) return;

  const appBaseUrl = (cfg.appBaseUrl || "http://localhost:3000").replace(/\/+$/, "");
  const apiKey = cfg.applyPilotApiKey || "";
  const userToken = cfg.applyPilotUserToken || "";
  if (!userToken) return;

  const nextRes = await fetch(`${appBaseUrl}/api/extension/automation/next`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-ApplyPilot-Key": apiKey } : {}),
      "X-ApplyPilot-User-Token": userToken,
    },
    body: JSON.stringify({ tick: true }),
  });
  const nextJson = await nextRes.json().catch(() => ({}));
  if (!nextRes.ok || !nextJson?.task?.id) return;

  const task = nextJson.task;
  const autoSubmit = Boolean(nextJson.autoSubmit) && Boolean(cfg.autopilotSubmit);
  if (!task.url || !/^https?:\/\//i.test(String(task.url))) {
    await reportTaskResult({
      appBaseUrl,
      apiKey,
      userToken,
      taskId: task.id,
      applicationId: task.applicationId,
      status: "failed",
      error: "Invalid or missing job URL.",
    });
    return;
  }

  let tabId = null;

  try {
    const tab = await chrome.tabs.create({ url: task.url, active: false });
    if (!tab.id) throw new Error("Failed to open target tab");
    tabId = tab.id;
    await waitForTabComplete(tabId, 45000);

    const execRes = await chrome.scripting.executeScript({
      target: { tabId },
      func: runSiteAdapter,
      args: [task.profile || {}, task.resume || {}, autoSubmit],
    });
    const payload = (execRes && execRes[0] && execRes[0].result) || {};

    await reportTaskResult({
      appBaseUrl,
      apiKey,
      userToken,
      taskId: task.id,
      applicationId: task.applicationId,
      status: "completed",
      details: {
        ...payload,
        autoSubmitEnabled: autoSubmit,
      },
    });
  } catch (error) {
    await reportTaskResult({
      appBaseUrl,
      apiKey,
      userToken,
      taskId: task.id,
      applicationId: task.applicationId,
      status: "failed",
      error: String(error?.message || error || "Autopilot failure"),
    });
  } finally {
    if (tabId) {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
      }
    }
  }
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok, message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      if (ok) resolve(true);
      else reject(new Error(message || "Failed waiting for tab"));
    };

    const timeout = setTimeout(() => {
      finish(false, "Timeout waiting for job page load");
    }, timeoutMs);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish(true);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        finish(false, chrome.runtime.lastError.message || "Unable to read tab status");
        return;
      }
      if (tab?.status === "complete") finish(true);
    });
  });
}

async function reportTaskResult({
  appBaseUrl,
  apiKey,
  userToken,
  taskId,
  applicationId,
  status,
  error,
  details,
}) {
  await fetch(`${appBaseUrl}/api/extension/automation/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-ApplyPilot-Key": apiKey } : {}),
      "X-ApplyPilot-User-Token": userToken,
    },
    body: JSON.stringify({
      taskId,
      applicationId,
      status,
      ...(error ? { error } : {}),
      ...(details ? { details } : {}),
    }),
  });
}

function runSiteAdapter(profile, resume, autoSubmit) {
  const host = window.location.hostname.toLowerCase();
  const normalizedProfile = normalizeProfile(profile);
  const outcome = {
    host,
    adapter: "generic",
    fieldsFilled: {},
    submitted: false,
  };

  if (host.includes("greenhouse.io")) {
    outcome.adapter = "greenhouse";
    Object.assign(outcome.fieldsFilled, fillGreenhouse(normalizedProfile, resume));
  } else if (host.includes("lever.co")) {
    outcome.adapter = "lever";
    Object.assign(outcome.fieldsFilled, fillLever(normalizedProfile, resume));
  } else if (host.includes("workdayjobs.com")) {
    outcome.adapter = "workday";
    Object.assign(outcome.fieldsFilled, fillWorkday(normalizedProfile, resume));
  } else {
    Object.assign(outcome.fieldsFilled, fillGeneric(normalizedProfile, resume));
  }

  if (autoSubmit) {
    outcome.submitted = trySafeSubmit(outcome.adapter);
  }

  return outcome;
}

function normalizeProfile(profile) {
  const contact = String(profile?.contactInfo || "");
  const email = (contact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || "";
  const phone = (contact.match(/(\+?\d[\d\-\(\) ]{7,}\d)/) || [])[0] || "";
  return {
    email,
    phone,
    linkedin: String(profile?.linkedin || ""),
    portfolio: String(profile?.portfolio || ""),
    location: String(profile?.location || ""),
    summary: String(profile?.summary || ""),
  };
}

function fillGreenhouse(profile, resume) {
  const fields = {};
  fields.email = setVal(["#email", "input[name='email']", "input[id*='email']"], profile.email);
  fields.phone = setVal(["#phone", "input[name='phone']", "input[id*='phone']"], profile.phone);
  fields.linkedin = setVal(["#linkedin", "input[name*='linkedin']", "input[id*='linkedin']"], profile.linkedin);
  fields.website = setVal(["#website", "input[name*='website']", "input[name*='portfolio']"], profile.portfolio);
  fields.location = setVal(["#location", "input[name*='location']"], profile.location);
  fields.cover = setVal(["#cover_letter", "textarea[name*='cover']"], profile.summary);
  fields.resumeNote = setVal(["textarea[name*='additional']", "textarea[name*='comments']"], resume?.content ? "Resume text available in ApplyPilot profile." : "");
  return fields;
}

function fillLever(profile, resume) {
  const fields = {};
  fields.name = false;
  fields.email = setVal(["input[name='email']", "input[type='email']"], profile.email);
  fields.phone = setVal(["input[name='phone']", "input[type='tel']"], profile.phone);
  fields.linkedin = setVal(["input[name='urls[LinkedIn]']", "input[name*='linkedin']"], profile.linkedin);
  fields.website = setVal(["input[name='urls[Portfolio]']", "input[name*='portfolio']", "input[name*='website']"], profile.portfolio);
  fields.location = setVal(["input[name*='location']"], profile.location);
  fields.cover = setVal(["textarea[name='comments']", "textarea[name*='cover']"], profile.summary);
  fields.resumeNote = setVal(["textarea[name*='additional']"], resume?.content ? "Resume text available in ApplyPilot profile." : "");
  return fields;
}

function fillWorkday(profile, resume) {
  const fields = {};
  fields.email = setVal(["input[data-automation-id*='email']", "input[type='email']"], profile.email);
  fields.phone = setVal(["input[data-automation-id*='phone']", "input[type='tel']"], profile.phone);
  fields.location = setVal(["input[data-automation-id*='address']", "input[data-automation-id*='city']"], profile.location);
  fields.linkedin = setVal(["input[data-automation-id*='linkedin']", "input[name*='linkedin']"], profile.linkedin);
  fields.website = setVal(["input[data-automation-id*='website']", "input[name*='portfolio']"], profile.portfolio);
  fields.cover = setVal(["textarea[data-automation-id*='cover']", "textarea[name*='cover']"], profile.summary);
  fields.resumeNote = setVal(["textarea[data-automation-id*='additional']"], resume?.content ? "Resume text available in ApplyPilot profile." : "");
  return fields;
}

function fillGeneric(profile, resume) {
  const fields = {};
  fields.email = setVal(["input[name*=email i]", "input[type=email]"], profile.email);
  fields.phone = setVal(["input[name*=phone i]", "input[type=tel]"], profile.phone);
  fields.linkedin = setVal(["input[name*=linkedin i]", "input[id*=linkedin i]"], profile.linkedin);
  fields.website = setVal(["input[name*=website i]", "input[name*=portfolio i]"], profile.portfolio);
  fields.location = setVal(["input[name*=location i]", "input[name*=city i]"], profile.location);
  fields.cover = setVal(["textarea[name*=summary i]", "textarea[name*=cover i]"], profile.summary);
  fields.resumeNote = setVal(["textarea[name*=additional i]", "textarea[name*=notes i]"], resume?.content ? "Resume text available in ApplyPilot profile." : "");
  return fields;
}

function setVal(selectors, value) {
  if (!value) return false;
  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (!input) continue;
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  return false;
}

function trySafeSubmit(adapter) {
  const candidatesByAdapter = {
    greenhouse: ["button[type='submit']"],
    lever: ["button[type='submit']"],
    workday: ["button[data-automation-id*='submit']", "button[type='submit']"],
    generic: ["button[type='submit']", "input[type='submit']"],
  };
  const candidates = candidatesByAdapter[adapter] || candidatesByAdapter.generic;

  for (const selector of candidates) {
    const btns = Array.from(document.querySelectorAll(selector));
    for (const el of btns) {
      const text = String(el.innerText || el.value || "").toLowerCase();
      if (text.includes("submit") || text.includes("apply")) {
        el.click();
        return true;
      }
    }
  }
  return false;
}
