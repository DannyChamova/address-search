const SUGGEST_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest";
const FIND_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

const COUNTRY_CODE = "BGR";
const LANG_CODE = "bg";

const rootEl = document.getElementById("autocompleteRoot");
const inputEl = document.getElementById("addressInput");
const loaderEl = document.getElementById("loader");
const suggestionsEl = document.getElementById("suggestions");
const resultsEl = document.getElementById("resultsList");
const statusEl = document.getElementById("status");

let debounceTimer = null;

let activeIndex = -1;
let currentSuggestions = [];

let activeResultIndex = -1;
let currentCandidates = [];

let mode = "suggest";

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function setLoading(isLoading) {
  loaderEl.style.display = isLoading ? "block" : "none";
  loaderEl.setAttribute("aria-hidden", String(!isLoading));
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[c]));
}

function clearResults() {
  resultsEl.innerHTML = "";
}

function showSuggestions(items) {
  currentSuggestions = items || [];
  activeIndex = -1;
  mode = "suggest";

  if (!currentSuggestions.length) {
    hideSuggestions();
    return;
  }

  suggestionsEl.innerHTML = currentSuggestions
    .map((it, idx) => `<li role="option" data-idx="${idx}">${escapeHtml(it.text)}</li>`)
    .join("");

  suggestionsEl.style.display = "block";
}

function hideSuggestions() {
  suggestionsEl.style.display = "none";
  suggestionsEl.innerHTML = "";
  currentSuggestions = [];
  activeIndex = -1;
}

function updateActiveSuggestion() {
  const lis = [...suggestionsEl.querySelectorAll("li")];
  lis.forEach((li, i) => li.classList.toggle("is-active", i === activeIndex));

  const activeLi = lis[activeIndex];
  if (activeLi) activeLi.scrollIntoView({ block: "nearest" });
}

function updateActiveResult() {
  const items = [...resultsEl.querySelectorAll(".result-item")];
  items.forEach((li, i) => li.classList.toggle("is-active", i === activeResultIndex));

  const activeLi = items[activeResultIndex];
  if (activeLi) activeLi.scrollIntoView({ block: "nearest" });
}

async function fetchSuggest(text) {
  const url = new URL(SUGGEST_URL);
  url.searchParams.set("f", "json");
  url.searchParams.set("text", text);
  url.searchParams.set("countryCode", COUNTRY_CODE);
  url.searchParams.set("maxSuggestions", "8");

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error("Suggest request failed");
  return resp.json();
}

async function fetchCandidates(singleLine, magicKey) {
  const url = new URL(FIND_URL);
  url.searchParams.set("f", "json");
  url.searchParams.set("SingleLine", singleLine);
  url.searchParams.set("countryCode", COUNTRY_CODE);
  url.searchParams.set("langCode", LANG_CODE);
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("maxLocations", "20");
  url.searchParams.set("outFields", "Match_addr,Addr_type");

  if (magicKey) url.searchParams.set("magicKey", magicKey);

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error("FindAddressCandidates request failed");
  return resp.json();
}

function renderResults(candidates) {
  currentCandidates = candidates || [];
  activeResultIndex = -1;
  mode = "results";

  clearResults();

  if (!currentCandidates.length) {
    resultsEl.innerHTML =
      `<li class="result-item"><div class="result-main"><div class="result-addr">Няма намерени резултати.</div></div></li>`;
    return;
  }

  resultsEl.innerHTML = currentCandidates.slice(0, 20).map((c, idx) => {
    const addr = c.address || "(без адрес)";
    const score = (typeof c.score === "number") ? c.score : null;

    const x = c.location && typeof c.location.x === "number" ? c.location.x : null;
    const y = c.location && typeof c.location.y === "number" ? c.location.y : null;

    const coordsText = (x !== null && y !== null)
      ? `${y.toFixed(6)}, ${x.toFixed(6)}`
      : "—";

    const mapsUrl = (x !== null && y !== null)
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${y},${x}`)}`
      : "";

    return `
      <li class="result-item" data-idx="${idx}">
        <div class="result-main">
          <div class="result-addr" title="${escapeHtml(addr)}">${escapeHtml(addr)}</div>
          <div class="result-meta">
            ${score !== null ? `Score: ${escapeHtml(String(score))}` : "Score: —"}
            <span class="dot">•</span>
            Коорд.: ${escapeHtml(coordsText)}
          </div>
        </div>
        <div class="result-actions">
          <a class="btn-link ${mapsUrl ? "" : "disabled"}"
             href="${mapsUrl || "#"}"
             target="_blank"
             rel="noreferrer"
             ${mapsUrl ? "" : 'aria-disabled="true" tabindex="-1"'}
          >Отвори в Maps</a>
        </div>
      </li>
    `;
  }).join("");
}

async function chooseSuggestionAndSearch(chosen) {
  if (!chosen) return;

  inputEl.value = chosen.text;
  hideSuggestions();

  setStatus("Търся резултати...");
  setLoading(true);

  try {
    const data = await fetchCandidates(chosen.text, chosen.magicKey);
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    renderResults(candidates);
    setStatus("");
  } catch (e) {
    setStatus("Грешка при търсенето на резултати. Опитай пак.");
  } finally {
    setLoading(false);
  }
}

inputEl.addEventListener("input", () => {
  const text = inputEl.value.trim();

  currentCandidates = [];
  activeResultIndex = -1;
  clearResults();

  if (debounceTimer) clearTimeout(debounceTimer);

  if (text.length < 3) {
    hideSuggestions();
    setStatus("Въведи поне 3 символа.");
    return;
  }

  setStatus("Търся подсказки...");
  setLoading(true);

  debounceTimer = setTimeout(async () => {
    try {
      const data = await fetchSuggest(text);
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      showSuggestions(suggestions);
      setStatus(suggestions.length ? "" : "Няма подсказки.");
    } catch (e) {
      hideSuggestions();
      setStatus("Грешка при подсказките. Опитай пак.");
    } finally {
      setLoading(false);
    }
  }, 300);
});

suggestionsEl.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-idx]");
  if (!li) return;

  const idx = Number(li.dataset.idx);
  const chosen = currentSuggestions[idx];
  chooseSuggestionAndSearch(chosen);
});

resultsEl.addEventListener("click", (e) => {
  const li = e.target.closest(".result-item[data-idx]");
  if (!li) return;

  const idx = Number(li.dataset.idx);
  if (Number.isNaN(idx)) return;

  activeResultIndex = idx;
  mode = "results";
  updateActiveResult();

  const clickedLink = e.target.closest("a.btn-link");
  if (clickedLink) return;

  const link = li.querySelector('a.btn-link:not(.disabled)');
  if (link) link.click();
});

inputEl.addEventListener("keydown", (e) => {
  const suggestionsOpen = suggestionsEl.style.display === "block";
  const hasResults = resultsEl.querySelectorAll(".result-item[data-idx]").length > 0;

  if (suggestionsOpen) mode = "suggest";
  else if (hasResults) mode = "results";

  if (e.key === "ArrowDown") {
    if (mode === "suggest" && suggestionsOpen) {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentSuggestions.length - 1);
      updateActiveSuggestion();
    } else if (mode === "results" && hasResults) {
      e.preventDefault();
      const max = resultsEl.querySelectorAll(".result-item[data-idx]").length - 1;
      activeResultIndex = Math.min(activeResultIndex + 1, max);
      updateActiveResult();
    }
    return;
  }

  if (e.key === "ArrowUp") {
    if (mode === "suggest" && suggestionsOpen) {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActiveSuggestion();
    } else if (mode === "results" && hasResults) {
      e.preventDefault();
      activeResultIndex = Math.max(activeResultIndex - 1, 0);
      updateActiveResult();
    }
    return;
  }

  if (e.key === "Enter") {
    if (mode === "suggest" && suggestionsOpen && activeIndex >= 0 && currentSuggestions[activeIndex]) {
      e.preventDefault();
      chooseSuggestionAndSearch(currentSuggestions[activeIndex]);
      return;
    }

    if (mode === "results" && hasResults && activeResultIndex >= 0) {
      e.preventDefault();
      const item = resultsEl.querySelector(`.result-item[data-idx="${activeResultIndex}"]`);
      const link = item ? item.querySelector('a.btn-link:not(.disabled)') : null;
      if (link) link.click();
      return;
    }
  }

  if (e.key === "Escape") {
    if (suggestionsOpen) hideSuggestions();
    activeIndex = -1;
    activeResultIndex = -1;
    updateActiveResult();
    setStatus("");
  }
});

document.addEventListener("click", (e) => {
  if (!rootEl.contains(e.target)) {
    hideSuggestions();
  }
});

inputEl.addEventListener("focus", () => {
  if (currentSuggestions.length) {
    suggestionsEl.style.display = "block";
  }
});

inputEl.addEventListener("blur", () => {
  setTimeout(() => hideSuggestions(), 120);
});

setStatus("Въведи поне 3 символа.");
