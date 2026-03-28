const STORAGE_KEY = "rat-watch-sg-reports";
const SINGAPORE_CENTER = [1.3521, 103.8198];
const DEFAULT_ZOOM = 12;
const REPORTS_TABLE = "reports";

const form = document.getElementById("reportForm");
const jumpToFormButton = document.getElementById("jumpToForm");
const reportList = document.getElementById("reportList");
const reportTypeInput = document.getElementById("reportType");
const timeFilterInput = document.getElementById("timeFilter");
const latitudeInput = document.getElementById("latitude");
const longitudeInput = document.getElementById("longitude");
const sightedDateInput = document.getElementById("sightedDate");
const sightedTimeInput = document.getElementById("sightedTime");
const locationNameInput = document.getElementById("locationName");
const dogNameInput = document.getElementById("dogName");
const dogOutcomeInput = document.getElementById("dogOutcome");
const notesInput = document.getElementById("notes");
const caseFields = document.getElementById("caseFields");
const duplicateWarning = document.getElementById("duplicateWarning");
const submitStatus = document.getElementById("submitStatus");
const appStatus = document.getElementById("appStatus");
const totalReportsEl = document.getElementById("totalReports");
const leptoReportsEl = document.getElementById("leptoReports");
const selectedCoordsEl = document.getElementById("selectedCoords");

const map = L.map("map", {
  zoomControl: true,
  minZoom: 11,
  maxZoom: 19,
}).setView(SINGAPORE_CENTER, DEFAULT_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const config = window.RATWATCH_CONFIG || {};
const hasSupabaseConfig = Boolean(
  config.supabaseUrl &&
    config.supabaseKey &&
    !String(config.supabaseUrl).includes("YOUR_") &&
    !String(config.supabaseKey).includes("YOUR_")
);
const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

let selectedMarker = null;
let reports = [];
let possibleDuplicates = [];
let activeDataMode = "local";
let activeTimeFilter = "all_time";
let hasSelectedCoordinates = false;

function loadReportsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Unable to read saved reports", error);
    return [];
  }
}

function saveReportsToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function mapDbReport(row) {
  return {
    id: row.id,
    reportType: row.report_type,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    sightedAt: row.sighted_at,
    locationName: row.location_name || "",
    dogName: row.dog_name || "",
    dogOutcome: row.dog_outcome || "",
    notes: row.notes || "",
    moderationStatus: row.moderation_status || "approved",
    createdAt: row.created_at || null,
  };
}

async function loadReports() {
  if (!supabaseClient) {
    activeDataMode = "local";
    reports = loadReportsFromLocalStorage();
    setAppStatus(
      "Reports are being shown from this device only right now.",
      "info"
    );
    renderAll();
    return;
  }

  setAppStatus("Connected to Supabase. Loading shared community reports...", "info");

  const { data, error } = await supabaseClient
    .from(REPORTS_TABLE)
    .select(
      "id, report_type, latitude, longitude, sighted_at, location_name, dog_name, dog_outcome, notes, moderation_status, created_at"
    )
    .eq("moderation_status", "approved")
    .order("sighted_at", { ascending: false });

  if (error) {
    console.error("Unable to load shared reports", error);
    activeDataMode = "local";
    reports = loadReportsFromLocalStorage();
    setAppStatus(
      "Live reports are temporarily unavailable, so only reports saved on this device are being shown right now.",
      "warning"
    );
    renderAll();
    return;
  }

  activeDataMode = "supabase";
  reports = data.map(mapDbReport);
  setAppStatus("Live community database connected. Approved reports are shared across all visitors.", "success");
  renderAll();
}

async function saveReport(report) {
  if (!supabaseClient) {
    activeDataMode = "local";
    reports.push(report);
    saveReportsToLocalStorage();
    return { ok: true, mode: "local" };
  }

  const payload = {
    report_type: report.reportType,
    latitude: report.latitude,
    longitude: report.longitude,
    sighted_at: report.sightedAt,
    location_name: report.locationName || null,
    dog_name: report.dogName || null,
    dog_outcome: report.dogOutcome || null,
    notes: report.notes || null,
    moderation_status: report.moderationStatus || "approved",
  };

  const { data, error } = await supabaseClient
    .from(REPORTS_TABLE)
    .insert(payload)
    .select(
      "id, report_type, latitude, longitude, sighted_at, location_name, dog_name, dog_outcome, notes, moderation_status, created_at"
    )
    .single();

  if (error) {
    console.error("Unable to save shared report", error);
    return { ok: false, error };
  }

  activeDataMode = "supabase";
  reports.unshift(mapDbReport(data));
  return { ok: true, mode: "supabase" };
}

function formatCoordinates(latitude, longitude) {
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}

function parseLocalDateTime(value) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value}:00+08:00`);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value}+08:00`);
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeDateTimeForStorage(value) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00+08:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
    return `${value}+08:00`;
  }

  const date = parseLocalDateTime(value);
  return date ? date.toISOString() : value;
}

function buildSightedAtValue() {
  if (!sightedDateInput.value || !sightedTimeInput.value) {
    return "";
  }

  return `${sightedDateInput.value}T${sightedTimeInput.value}`;
}

function getReportSortTime(report) {
  return (
    parseLocalDateTime(report.sightedAt)?.getTime() ??
    parseLocalDateTime(report.createdAt)?.getTime() ??
    0
  );
}

function formatDateTime(value) {
  const date = parseLocalDateTime(value);
  if (!date) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  }).format(date);
}

function reportsInLastSevenDays() {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return reports.filter((report) => parseLocalDateTime(report.sightedAt)?.getTime() >= sevenDaysAgo).length;
}

function getFilteredReports() {
  const now = Date.now();

  return reports.filter((report) => {
    const reportTime = parseLocalDateTime(report.sightedAt)?.getTime();
    if (!Number.isFinite(reportTime)) {
      return false;
    }

    if (activeTimeFilter === "this_week") {
      return reportTime >= now - 7 * 24 * 60 * 60 * 1000;
    }

    if (activeTimeFilter === "this_month") {
      const startOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      ).getTime();
      return reportTime >= startOfMonth;
    }

    if (activeTimeFilter === "this_year") {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
      return reportTime >= startOfYear;
    }

    return true;
  });
}

function buildPopup(report) {
  const area = report.locationName ? escapeHtml(report.locationName) : "Unnamed area";
  const typeLabel =
    report.reportType === "leptospirosis_case" ? "Leptospirosis case" : "Rat sighting";
  const dogLine =
    report.reportType === "leptospirosis_case" && report.dogName
      ? `<div>Dog: ${escapeHtml(report.dogName)}</div>`
      : "";
  const outcomeLine =
    report.reportType === "leptospirosis_case" && report.dogOutcome
      ? `<div>Outcome: ${formatOutcome(report.dogOutcome)}</div>`
      : "";
  const notes = report.notes ? `<p>${escapeHtml(report.notes)}</p>` : "";

  return `
    <div class="popup-body">
      <strong>${typeLabel}</strong>
      <div>${area}</div>
      ${dogLine}
      ${outcomeLine}
      <div>${formatDateTime(report.sightedAt)}</div>
      <div>${formatCoordinates(report.latitude, report.longitude)}</div>
      ${notes}
    </div>
  `;
}

function renderMapMarkers() {
  markerLayer.clearLayers();

  getFilteredReports().forEach((report) => {
    const isCase = report.reportType === "leptospirosis_case";
    const icon = L.divIcon({
      className: "",
      html: `<span class="map-marker ${
        isCase ? "map-marker-lepto" : "map-marker-rat"
      }"></span>`,
      iconSize: isCase ? [22, 22] : [20, 20],
      iconAnchor: isCase ? [11, 11] : [10, 10],
      popupAnchor: [0, -10],
    });

    L.marker([report.latitude, report.longitude], {
      icon,
    })
      .bindPopup(buildPopup(report))
      .addTo(markerLayer);
  });
}

function renderReportFeed() {
  const filteredReports = getFilteredReports();

  if (!filteredReports.length) {
    reportList.innerHTML = `
      <div class="empty-state">
        No reports match this time filter yet.
      </div>
    `;
    return;
  }

  const cards = [...filteredReports]
    .sort((left, right) => getReportSortTime(right) - getReportSortTime(left))
    .map((report) => {
      const title = report.locationName ? escapeHtml(report.locationName) : "Unnamed area";
      const typeLabel =
        report.reportType === "leptospirosis_case" ? "Leptospirosis case" : "Rat sighting";
      const notes = report.notes
        ? `<p class="report-notes">${escapeHtml(report.notes)}</p>`
        : "";
      const dogLine =
        report.reportType === "leptospirosis_case" && report.dogName
          ? `<p class="report-meta">Dog: ${escapeHtml(report.dogName)}</p>`
          : "";
      const outcomeLine =
        report.reportType === "leptospirosis_case" && report.dogOutcome
          ? `<p class="report-meta">Outcome: ${formatOutcome(report.dogOutcome)}</p>`
          : "";

      return `
        <article class="report-card">
          <div class="report-type">${typeLabel}</div>
          <h3>${title}</h3>
          <p class="report-meta">${formatDateTime(report.sightedAt)}</p>
          <p class="report-meta">${formatCoordinates(report.latitude, report.longitude)}</p>
          ${dogLine}
          ${outcomeLine}
          ${notes}
        </article>
      `;
    });

  reportList.innerHTML = cards.join("");
}

function renderStats() {
  const filteredReports = getFilteredReports();
  totalReportsEl.textContent = String(filteredReports.length);
  leptoReportsEl.textContent = String(
    filteredReports.filter((report) => report.reportType === "leptospirosis_case").length
  );
}

function formatOutcome(value) {
  switch (value) {
    case "survived":
      return "Survived";
    case "did_not_survive":
      return "Did not survive";
    case "ongoing_treatment":
      return "Ongoing treatment";
    default:
      return "Unknown";
  }
}

function syncCaseFields() {
  const isCase = reportTypeInput.value === "leptospirosis_case";
  caseFields.classList.toggle("hidden", !isCase);
  caseFields.setAttribute("aria-hidden", String(!isCase));
  dogNameInput.required = isCase;
  dogOutcomeInput.required = isCase;

  if (!isCase) {
    dogNameInput.value = "";
    dogOutcomeInput.value = "";
    possibleDuplicates = [];
    hideInlineMessage(duplicateWarning);
  }
}

function syncSelectedCoordinates(latitude, longitude) {
  latitudeInput.value = Number(latitude).toFixed(6);
  longitudeInput.value = Number(longitude).toFixed(6);
  selectedCoordsEl.textContent = formatCoordinates(latitude, longitude);
  hasSelectedCoordinates = true;

  if (selectedMarker) {
    map.removeLayer(selectedMarker);
  }

  selectedMarker = L.marker([latitude, longitude]).addTo(map);
}

function clearSelectedCoordinates() {
  latitudeInput.value = "";
  longitudeInput.value = "";
  selectedCoordsEl.textContent = "None yet";
  hasSelectedCoordinates = false;

  if (selectedMarker) {
    map.removeLayer(selectedMarker);
    selectedMarker = null;
  }
}

function seedCurrentDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDateTime = new Date(now.getTime() - offset * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const [datePart, timePart] = localDateTime.split("T");
  sightedDateInput.value = datePart;
  sightedTimeInput.value = timePart;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setAppStatus(message, tone = "info") {
  appStatus.textContent = message;
  appStatus.dataset.tone = tone;
}

function showInlineMessage(element, message, tone) {
  element.textContent = message;
  element.dataset.tone = tone;
  element.classList.remove("hidden");
}

function hideInlineMessage(element) {
  element.textContent = "";
  element.classList.add("hidden");
  delete element.dataset.tone;
}

function distanceInMeters(leftLat, leftLng, rightLat, rightLng) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(rightLat - leftLat);
  const dLng = toRadians(rightLng - leftLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(leftLat)) *
      Math.cos(toRadians(rightLat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findPossibleDuplicates(candidate) {
  if (candidate.reportType !== "leptospirosis_case" || !candidate.dogName) {
    return [];
  }

  const normalizedDogName = candidate.dogName.trim().toLowerCase();
  const candidateTime = parseLocalDateTime(candidate.sightedAt)?.getTime();

  return reports.filter((report) => {
    if (report.reportType !== "leptospirosis_case" || !report.dogName) {
      return false;
    }

    const sameDogName = report.dogName.trim().toLowerCase() === normalizedDogName;
    if (!sameDogName) {
      return false;
    }

    const reportTime = parseLocalDateTime(report.sightedAt)?.getTime();
    const withinThirtyDays = Math.abs(reportTime - candidateTime) <= 30 * 24 * 60 * 60 * 1000;
    const nearby = distanceInMeters(
      candidate.latitude,
      candidate.longitude,
      report.latitude,
      report.longitude
    ) <= 1500;

    return withinThirtyDays || nearby;
  });
}

function syncDuplicateWarning() {
  const candidate = {
    reportType: reportTypeInput.value,
    dogName: dogNameInput.value.trim(),
    sightedAt: buildSightedAtValue(),
    latitude: Number(latitudeInput.value),
    longitude: Number(longitudeInput.value),
  };

  if (
    candidate.reportType !== "leptospirosis_case" ||
    !candidate.dogName ||
    !Number.isFinite(candidate.latitude) ||
    !Number.isFinite(candidate.longitude) ||
    !candidate.sightedAt
  ) {
    possibleDuplicates = [];
    hideInlineMessage(duplicateWarning);
    return;
  }

  possibleDuplicates = findPossibleDuplicates(candidate);
  if (!possibleDuplicates.length) {
    hideInlineMessage(duplicateWarning);
    return;
  }

  const sample = possibleDuplicates[0];
  const area = sample.locationName || "the same area";
  showInlineMessage(
    duplicateWarning,
    `Possible duplicate found for ${sample.dogName} near ${area} on ${formatDateTime(
      sample.sightedAt
    )}. Please confirm this is a new case before submitting.`,
    "warning"
  );
}

map.on("click", (event) => {
  syncSelectedCoordinates(event.latlng.lat, event.latlng.lng);
  syncDuplicateWarning();
});

jumpToFormButton.addEventListener("click", () => {
  document.getElementById("reportPanel").scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  latitudeInput.focus();
});

reportTypeInput.addEventListener("change", () => {
  syncCaseFields();
  syncDuplicateWarning();
});

timeFilterInput.addEventListener("change", () => {
  activeTimeFilter = timeFilterInput.value;
  renderAll();
});

dogNameInput.addEventListener("input", syncDuplicateWarning);
sightedDateInput.addEventListener("input", syncDuplicateWarning);
sightedTimeInput.addEventListener("input", syncDuplicateWarning);
latitudeInput.addEventListener("input", syncDuplicateWarning);
longitudeInput.addEventListener("input", syncDuplicateWarning);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideInlineMessage(submitStatus);

  const latitude = Number(latitudeInput.value);
  const longitude = Number(longitudeInput.value);

  if (!hasSelectedCoordinates || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    showInlineMessage(
      submitStatus,
      "Please click on the map to drop a pin before saving your report.",
      "error"
    );
    return;
  }

  const report = {
    id: window.crypto?.randomUUID?.() || String(Date.now()),
    reportType: reportTypeInput.value,
    latitude,
    longitude,
    sightedAt: normalizeDateTimeForStorage(buildSightedAtValue()),
    locationName: locationNameInput.value.trim(),
    dogName: dogNameInput.value.trim(),
    dogOutcome: dogOutcomeInput.value,
    notes: notesInput.value.trim(),
    moderationStatus: "approved",
  };

  if (!report.sightedAt) {
    showInlineMessage(
      submitStatus,
      "Please choose both a date and time for the report.",
      "error"
    );
    return;
  }

  const duplicates = findPossibleDuplicates(report);
  if (duplicates.length) {
    const confirmed = window.confirm(
      "This may be a duplicate leptospirosis report for the same dog. Do you want to submit it anyway?"
    );

    if (!confirmed) {
      return;
    }
  }

  showInlineMessage(submitStatus, "Saving report...", "info");

  const result = await saveReport(report);
  if (!result.ok) {
    const errorMessage =
      result.error?.message ||
      result.error?.details ||
      result.error?.hint ||
      "Your report could not be saved right now. Please try again in a moment.";
    showInlineMessage(
      submitStatus,
      errorMessage,
      "error"
    );
    return;
  }

  renderAll();
  form.reset();
  seedCurrentDateTime();
  reportTypeInput.value = "rat_sighting";
  syncCaseFields();
  clearSelectedCoordinates();
  possibleDuplicates = [];
  hideInlineMessage(duplicateWarning);
  showInlineMessage(
    submitStatus,
    result.mode === "supabase"
      ? "Report saved to the shared community database."
      : "Report saved on this device.",
    "success"
  );
});

function renderAll() {
  renderMapMarkers();
  renderReportFeed();
  renderStats();
}

seedCurrentDateTime();
syncCaseFields();
loadReports();
