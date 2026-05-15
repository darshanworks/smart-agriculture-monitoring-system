/* AgriSense Dashboard JS – wired to Firebase RTDB, preserves your layout/look */
/* ---------------- CONFIG ---------------- */
const OWM_API_KEY = "39cc5f8c81e5f46216e708eb3f8c523a"; // optional; keep if you used it before
const FARM_LAT = 19.466624;
const FARM_LON = 72.827861;

/* Firebase config (yours) */
const firebaseConfig = {
  apiKey: "AIzaSyCVmnzXsLivk6wnQZHrpM5C5n1eCRyfIPA",
  authDomain: "fir-b8587.firebaseapp.com",
  databaseURL:
    "https://fir-b8587-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fir-b8587",
  storageBucket: "fir-b8587.firebasestorage.app",
  messagingSenderId: "369757581143",
  appId: "1:369757581143:web:996056d471ca4bee4e5812",
};

/* ---------------- DOM refs ---------------- */
const tempValueEl = document.getElementById("tempValue");
const humValueEl = document.getElementById("humValue");
const soilValueEl = document.getElementById("soilValue");

const gaugeTempCtx = document.getElementById("gaugeTemp").getContext("2d");
const gaugeHumCtx = document.getElementById("gaugeHum").getContext("2d");
const gaugeSoilCtx = document.getElementById("gaugeSoil").getContext("2d");

const historyCtx = document.getElementById("historyChart").getContext("2d");
const metricSelect = document.getElementById("metricSelect");
const rangeSelect = document.getElementById("rangeSelect");

const alertBox = document.getElementById("alertBox");
const alertEmoji = document.getElementById("alertEmoji");
const alertTitle = document.getElementById("alertTitle");
const alertDetail = document.getElementById("alertDetail");

const todayTemp = document.getElementById("todayTemp");
const todayDesc = document.getElementById("todayDesc");
const todayIcon = document.getElementById("todayIcon");

const notesPreviewEl = document.getElementById("notesPreview");
const notesListEl = document.getElementById("notesList");
const noteInput = document.getElementById("noteInput");

const openNotesBtn = document.getElementById("openNotesBtn");
const notesModal = new bootstrap.Modal(document.getElementById("notesModal"));
const calendarModal = new bootstrap.Modal(
  document.getElementById("calendarModal"),
);
const calendarInput = document.getElementById("calendarInput");

const themeToggleBtn = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

/* ---------------- Gauges ---------------- */
let gaugeTempChart, gaugeHumChart, gaugeSoilChart, historyChart;

function createGauge(ctx, color, initial) {
  return new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [initial, 100 - initial],
          backgroundColor: [color, "#e6e6e6"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: "78%",
      rotation: -90,
      circumference: 180,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });
}
function updateGauge(chart, value) {
  chart.data.datasets[0].data[0] = value;
  chart.data.datasets[0].data[1] = 100 - value;
  chart.update();
}
gaugeTempChart = createGauge(gaugeTempCtx, "#e63946", 0);
gaugeHumChart = createGauge(gaugeHumCtx, "#2b8bd6", 0);
gaugeSoilChart = createGauge(gaugeSoilCtx, "#2f8c3d", 0);

/* ---------------- History chart ---------------- */
function initHistoryChart(labels, data, metric) {
  if (historyChart) historyChart.destroy();

  let color = "#e63946";
  let ticksArray = [];
  let unit = "";

  if (metric === "temperature") {
    color = "#e63946";
    ticksArray = [0, 5, 10, 15, 20, 25, 30, 35];
    unit = "°C";
  } else if (metric === "humidity") {
    color = "#2b8bd6";
    ticksArray = [0, 20, 40, 60, 80, 100];
    unit = "%";
  } else {
    color = "#2f8c3d";
    ticksArray = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    unit = "%";
  }

  const stepSize =
    ticksArray.length > 1 ? ticksArray[1] - ticksArray[0] : undefined;
  const suggestedMin = ticksArray[0];
  const suggestedMax = ticksArray[ticksArray.length - 1];

  historyChart = new Chart(historyCtx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: metric,
          data: data,
          borderColor: color,
          backgroundColor: color + "33",
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: color,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: true } },
        y: {
          beginAtZero: true,
          suggestedMin,
          suggestedMax,
          ticks: {
            stepSize,
            callback: (v) => v + unit,
          },
        },
      },
    },
  });
}

/* ---------------- Theme toggle ---------------- */
function setTheme(isDark) {
  if (isDark) {
    document.body.classList.add("dark");
    document.body.classList.remove("light");
    themeIcon.className = "fa-solid fa-sun";
  } else {
    document.body.classList.add("light");
    document.body.classList.remove("dark");
    themeIcon.className = "fa-regular fa-moon";
  }
  if (historyChart) historyChart.update();
}
themeToggleBtn.addEventListener("click", () =>
  setTheme(!document.body.classList.contains("dark")),
);
setTheme(false);

/* ---------------- Notes (localStorage) ---------------- */
const NOTES_KEY = "agrisense_notes";
function loadNotes() {
  const raw = localStorage.getItem(NOTES_KEY) || "[]";
  const arr = JSON.parse(raw);
  notesPreviewEl.innerHTML = "";
  arr.slice(0, 2).forEach((n, idx) => {
    const li = document.createElement("li");
    li.className = "d-flex justify-content-between align-items-center";
    li.innerHTML = `<div>${escapeHtml(n).substr(
      0,
      80,
    )}</div><button class="btn btn-sm btn-outline-danger del-prev" data-idx="${idx}"><i class="fa-solid fa-trash"></i></button>`;
    notesPreviewEl.appendChild(li);
  });
  notesListEl.innerHTML = "";
  arr.forEach((n, idx) => {
    const li = document.createElement("li");
    li.className =
      "list-group-item d-flex justify-content-between align-items-start";
    li.innerHTML = `<div>${escapeHtml(
      n,
    )}</div><button class="btn btn-sm btn-outline-danger del-note" data-idx="${idx}">Delete</button>`;
    notesListEl.appendChild(li);
  });
}
function saveNote() {
  const txt = noteInput.value.trim();
  if (!txt) return alert("Note empty");
  const raw = localStorage.getItem(NOTES_KEY) || "[]";
  const arr = JSON.parse(raw);
  arr.unshift(txt);
  localStorage.setItem(NOTES_KEY, JSON.stringify(arr));
  noteInput.value = "";
  loadNotes();
  notesModal.hide();
}
function clearNotes() {
  if (confirm("Clear all notes?")) {
    localStorage.removeItem(NOTES_KEY);
    loadNotes();
  }
}
function deleteNoteAt(idx) {
  const raw = localStorage.getItem(NOTES_KEY) || "[]";
  const arr = JSON.parse(raw);
  arr.splice(idx, 1);
  localStorage.setItem(NOTES_KEY, JSON.stringify(arr));
  loadNotes();
}
function escapeHtml(unsafe) {
  return unsafe
    ? unsafe.replace(
        /[&<"'>]/g,
        (m) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
          })[m],
      )
    : "";
}
notesListEl.addEventListener("click", (e) => {
  if (e.target.closest(".del-note"))
    deleteNoteAt(parseInt(e.target.closest(".del-note").dataset.idx));
});
notesPreviewEl.addEventListener("click", (e) => {
  if (e.target.closest(".del-prev"))
    deleteNoteAt(parseInt(e.target.closest(".del-prev").dataset.idx));
});
openNotesBtn.addEventListener("click", () => {
  notesModal.show();
});
document.getElementById("saveNote").addEventListener("click", saveNote);
document.getElementById("clearNotes").addEventListener("click", clearNotes);
loadNotes();

/* ---------------- Weather (optional) ---------------- */
async function fetchWeather() {
  try {
    if (!OWM_API_KEY || OWM_API_KEY.includes("PASTE")) return;
    const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${FARM_LAT}&lon=${FARM_LON}&units=metric&appid=${OWM_API_KEY}`;
    const curRes = await fetch(curUrl);
    if (!curRes.ok) throw new Error(`HTTP error! Status: ${curRes.status}`);
    const cur = await curRes.json();
    const min = cur.main?.temp_min ? Math.round(cur.main.temp_min) : null;
    const max = cur.main?.temp_max ? Math.round(cur.main.temp_max) : null;
    if (min !== null && max !== null)
      todayTemp.textContent = `${min}° / ${max}°`;
    else todayTemp.textContent = `${Math.round(cur.main.temp)}°`;
    todayDesc.textContent = cur.weather?.[0]?.description || "--";
    if (cur.weather?.[0]?.icon) {
      todayIcon.src = `https://openweathermap.org/img/wn/${cur.weather[0].icon}@2x.png`;
    }
  } catch (err) {
    console.error("Error fetching weather:", err);
  }
}
fetchWeather();

/* ---------------- Firebase realtime + history ---------------- */
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* Realtime paths produced by your Arduino merge (kept same style) */
const T_REF = db.ref("/Sensors/DHT22/temperature");
const H_REF = db.ref("/Sensors/DHT22/humidity");
const S_REF = db.ref("/Sensors/SoilMoisture/percent");

/* History collection: each child: { ts, t, h, s } pushed by ESP32 */
const HIST_REF = db.ref("/History/readings");

/* Live gauges */
let currentRealtime = { temperature: null, humidity: null, soil: null };

T_REF.on("value", (snap) => {
  const t = snap.val();
  if (t !== null) {
    currentRealtime.temperature = Number(t);
    updateRealtimeUI();
  }
});
H_REF.on("value", (snap) => {
  const h = snap.val();
  if (h !== null) {
    currentRealtime.humidity = Number(h);
    updateRealtimeUI();
  }
});
S_REF.on("value", (snap) => {
  const s = snap.val();
  if (s !== null) {
    currentRealtime.soil = Number(s);
    updateRealtimeUI();
  }
});

/* History cache (updated live) */
let historyCache = []; // array of {ts,t,h,s}
HIST_REF.limitToLast(2000).on("value", (snap) => {
  const obj = snap.val() || {};
  let arr = Object.values(obj).filter((r) => r && typeof r.ts === "number");

  // ------- FIX here --------
  arr = arr.map((r, i) => {
    if (r.ts < 1000000000000) {
      // invalid timestamp
      r.ts = Date.now() - (arr.length - i) * 5000; // approx timestamp 5s gap
    }
    return r;
  });

  arr.sort((a, b) => a.ts - b.ts);
  historyCache = arr;
  refreshHistoryChart();
});

/* Update gauges + alert */
function updateRealtimeUI() {
  const { temperature: t, humidity: h, soil: s } = currentRealtime;
  if (t == null || h == null || s == null) return;

  tempValueEl.textContent = `${t.toFixed(1)} °C`;
  humValueEl.textContent = `${Math.round(h)} %`;
  soilValueEl.textContent = `${Math.round(s)} %`;

  updateGauge(gaugeTempChart, Math.min(100, Math.max(0, (t / 50) * 100)));
  updateGauge(gaugeHumChart, Math.min(100, Math.max(0, h)));
  updateGauge(gaugeSoilChart, Math.min(100, Math.max(0, s)));

  // Alert priority: 1-High Temp (>30), 2-Low Temp (<10), 3-Low Soil (<40), 4-Low Humidity (<30)
  let active = null;
  if (t > 30)
    active = {
      level: "high",
      type: "temp",
      title: "High Temperature",
      detail: "High temperature detected — take cooling measures.",
    };
  else if (t < 10)
    active = {
      level: "high",
      type: "temp",
      title: "Low Temperature",
      detail: "Low temperature detected — keep crops warm.",
    };
  else if (s < 40)
    active = {
      level: "warning",
      type: "soil",
      title: "Low Soil Moisture",
      detail: "Soil moisture is low — water the plants.",
    };
  else if (h < 30)
    active = {
      level: "warning",
      type: "humidity",
      title: "Low Humidity",
      detail: "Humidity is low — consider irrigation or misting.",
    };

  if (!active) {
    alertBox.className = "alert-box neutral";
    alertEmoji.textContent = "🟢";
    alertTitle.textContent = "No alert message";
    alertDetail.textContent = "All conditions normal.";
    const card = document.getElementById("alertCardContent");
    if (card) card.style.display = "none";
  } else {
    alertBox.className =
      active.level === "high" ? "alert-box red" : "alert-box yellow";
    alertEmoji.textContent =
      active.type === "temp" ? "🌡️" : active.type === "soil" ? "🌱" : "💧";
    alertTitle.textContent = active.title;
    alertDetail.textContent = active.detail;
    const card = document.getElementById("alertCardContent");
    if (card) {
      card.style.display = "block";
      document.getElementById("alertMsgContent").innerHTML =
        `<strong>${active.title}:</strong> ${active.detail}`;
    }
  }
}

/* History filtering + chart */
function refreshHistoryChart() {
  const metric = metricSelect.value; // 'temperature' | 'humidity' | 'soil'
  const range = rangeSelect.value; // 'today' | 'yesterday' | 'last7' | 'last30'

  if (!historyCache.length) {
    console.info("No historyCache data");
    initHistoryChart([], [], metric);
    return;
  }

  // Normalize timestamps and sort
  const normalized = historyCache
    .map((r) => {
      if (!r || typeof r.ts !== "number") return null;
      const clone = { ...r };
      if (clone.ts < 1e12) clone.ts = clone.ts * 1000; // seconds -> ms
      return clone;
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);

  // Diagnostics: min/max timestamps and sample count
  const minTs = normalized[0]?.ts || 0;
  const maxTs = normalized[normalized.length - 1]?.ts || 0;
  console.info("History entries:", normalized.length);
  console.info(
    "Min ts:",
    new Date(minTs).toString(),
    "Max ts:",
    new Date(maxTs).toString(),
  );

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 3600 * 1000;

  const getVal = (r) => {
    if (metric === "temperature") return Number(r.t);
    if (metric === "humidity") return Number(r.h);
    return Number(r.s);
  };

  // Helper: build simple labels for chart points
  const timeLabel = (ts) => {
    const d = new Date(ts);
    return d.getTime() >= startOfToday
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { day: "numeric", month: "short" });
  };

  // TODAY
  if (range === "today") {
    const filtered = normalized.filter((r) => r.ts >= startOfToday);
    initHistoryChart(
      filtered.map((r) => timeLabel(r.ts)),
      filtered.map(getVal),
      metric,
    );
    return;
  }

  // LAST30 (keep as last 30 readings)
  if (range === "last30") {
    const last = normalized.slice(-30);
    const labels = last.map((r) => timeLabel(r.ts));
    const data = last.map(getVal);
    initHistoryChart(labels, data, metric);
    return;
  }

  // LAST7 (calendar 7-day window from 6 days ago through today)
  if (range === "last7") {
    const start7 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
    ).getTime();
    // Build 7 full-day buckets
    const days = [];
    for (let i = 0; i < 7; i++) {
      const s = start7 + i * 24 * 3600 * 1000;
      const e = s + 24 * 3600 * 1000;
      days.push({ start: s, end: e });
    }

    // Count real readings per day
    const perDayBuckets = days.map((d) =>
      normalized.filter((r) => r.ts >= d.start && r.ts < d.end),
    );
    const counts = perDayBuckets.map((b) => b.length);
    console.info("Per-day counts (old->today):", counts);

    // If we have at least one reading older than startOfToday, compute averages per day
    const hasOlderThanToday = normalized.some((r) => r.ts < startOfToday);
    if (hasOlderThanToday) {
      const labels = days.map((d) =>
        new Date(d.start).toLocaleDateString([], {
          day: "numeric",
          month: "short",
        }),
      );
      const data = perDayBuckets.map((bucket) => {
        if (!bucket.length) return null;
        const vals = bucket.map(getVal).filter((v) => !Number.isNaN(v));
        if (!vals.length) return null;
        return vals.reduce((a, b) => a + b, 0) / vals.length; // average
      });
      initHistoryChart(labels, data, metric);
      return;
    }

    // ---------- FALLBACK: No older readings (only today present)
    // Create labels for the 7-day window and map the last up-to-7 readings to these days
    console.info(
      "No older-than-today readings — using fallback mapping of last readings to 7-day slots.",
    );

    const labels = days.map((d) =>
      new Date(d.start).toLocaleDateString([], {
        day: "numeric",
        month: "short",
      }),
    );

    // choose up to 7 most recent readings and assign them to the latest days
    const lastReadings = normalized.slice(-7);
    // Prepare data array filled with nulls
    const data = new Array(7).fill(null);

    // Map from the end: place lastReadings[last] -> today slot, previous -> yesterday slot, etc.
    for (let i = 0; i < lastReadings.length; i++) {
      const targetIndex = 7 - lastReadings.length + i; // align reading 0 -> earliest slot among lastReadings
      data[targetIndex] = getVal(lastReadings[i]);
    }

    initHistoryChart(labels, data, metric);
    return;
  }

  // fallback
  initHistoryChart([], [], metric);
}

metricSelect.addEventListener("change", refreshHistoryChart);
rangeSelect.addEventListener("change", refreshHistoryChart);

/* Calendar (kept behavior, optional) */
(function setCalendarLimits() {
  const inp = document.getElementById("calendarInput");
  if (!inp) return;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  inp.max = `${yyyy}-${mm}-${dd}`;
})();
