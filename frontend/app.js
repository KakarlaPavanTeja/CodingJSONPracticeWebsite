import {
  buildPracticeJson,
  regenerateIds,
  serializePracticeJson,
  validatePreparation,
} from "./json-prep.js";

const state = {
  luaContent: "",
  testcasesData: null,
  existingJson: null,
  idSource: null,
  result: null,
};

const elements = {
  views: [...document.querySelectorAll("[data-view]")],
  navLinks: [...document.querySelectorAll("[data-nav]")],
  form: document.querySelector("#preparation-form"),
  existingCard: document.querySelector("#existing-file-card"),
  nodeNotice: document.querySelector("#node-notice"),
  status: document.querySelector("#status-region"),
  inlineReport: document.querySelector("#inline-report"),
  validationEmpty: document.querySelector("#validation-empty"),
  validationResult: document.querySelector("#validation-result"),
  validationReport: document.querySelector("#validation-report"),
  summary: document.querySelector("#output-summary"),
  changeSummary: document.querySelector("#change-summary"),
  preview: document.querySelector("#json-preview"),
  prepareButton: document.querySelector("#prepare-button"),
  downloadButton: document.querySelector("#download-button"),
  idButton: document.querySelector("#regenerate-ids-button"),
  idStatus: document.querySelector("#id-status"),
};

const stateKeyByInputId = {
  "lua-file": "luaContent",
  "testcases-file": "testcasesData",
  "existing-file": "existingJson",
  "id-file": "idSource",
};
const readVersions = new Map();
const activeReadVersions = new Map();

function syncReadButtons() {
  elements.prepareButton.disabled = activeReadVersions.size > 0;
  elements.idButton.disabled = activeReadVersions.has("id-file");
}

function invalidatePreparationResult() {
  state.result = null;
  elements.inlineReport.hidden = true;
  elements.validationResult.hidden = true;
  elements.validationEmpty.hidden = false;
  elements.preview.textContent = "";
}

function selectedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value ?? "";
}

function enabledLanguages() {
  return [
    ...document.querySelectorAll('input[name="languages"]:checked'),
  ].map((input) => input.value);
}

function currentInput() {
  return {
    mode: selectedValue("mode"),
    structure: selectedValue("structure"),
    questionKind: selectedValue("question-kind"),
    enabledLanguages: enabledLanguages(),
    luaContent: state.luaContent,
    testcasesData: state.testcasesData,
    existingJson: state.existingJson,
  };
}

function setStatus(message) {
  elements.status.textContent = message;
}

function switchView(name, { focus = true } = {}) {
  const target = document.querySelector(`[data-view="${name}"]`);
  if (!target) return;
  for (const view of elements.views) view.hidden = view !== target;
  for (const link of elements.navLinks) {
    if (link.dataset.nav === name) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
  if (window.location.hash !== `#${name}`) window.location.hash = name;
  if (focus) target.querySelector("h1")?.focus();
}

function reportMarkup(report, heading = "Preflight validation") {
  const container = document.createElement("div");
  container.className = "report-stack";

  const title = document.createElement("h2");
  title.textContent = heading;
  container.append(title);

  if (report.errors.length === 0 && report.warnings.length === 0) {
    const success = document.createElement("div");
    success.className = "report report-success";
    success.innerHTML =
      '<strong>Ready to download</strong><span>All blocking checks passed.</span>';
    container.append(success);
  }

  if (report.errors.length > 0) {
    const errors = document.createElement("div");
    errors.className = "report report-error";
    errors.setAttribute("role", "alert");
    const strong = document.createElement("strong");
    strong.textContent = `${report.errors.length} blocking issue${
      report.errors.length === 1 ? "" : "s"
    }`;
    const list = document.createElement("ul");
    for (const error of report.errors) {
      const item = document.createElement("li");
      item.textContent = error;
      list.append(item);
    }
    errors.append(strong, list);
    container.append(errors);
  }

  if (report.warnings.length > 0) {
    const warnings = document.createElement("div");
    warnings.className = "report report-warning";
    const strong = document.createElement("strong");
    strong.textContent = `${report.warnings.length} automatic correction${
      report.warnings.length === 1 ? "" : "s"
    }`;
    const list = document.createElement("ul");
    for (const warning of [...new Set(report.warnings)]) {
      const item = document.createElement("li");
      item.textContent = warning;
      list.append(item);
    }
    warnings.append(strong, list);
    container.append(warnings);
  }
  return container;
}

function renderInlineReport(report) {
  elements.inlineReport.replaceChildren(reportMarkup(report));
  elements.inlineReport.hidden = false;
  if (report.errors.length > 0) {
    const heading = elements.inlineReport.querySelector("h2");
    heading.tabIndex = -1;
    heading.focus();
  }
}

function definitionList(data) {
  const list = document.createElement("dl");
  list.className = "summary-grid";
  for (const [label, value] of data) {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = String(value);
    wrapper.append(term, description);
    list.append(wrapper);
  }
  return list;
}

function renderResult(result) {
  state.result = result;
  elements.validationEmpty.hidden = true;
  elements.validationResult.hidden = false;
  elements.validationReport.replaceChildren(
    reportMarkup({ errors: [], warnings: result.warnings }),
  );

  const summary = result.summary;
  elements.summary.replaceChildren(
    definitionList([
      ["Question", result.data[0].question.short_text],
      ["Difficulty", summary.difficulty],
      ["Languages", summary.languages.join(", ")],
      ["Testcases", summary.testcaseCount],
      ["Public / hidden", `${summary.publicCount} / ${summary.hiddenCount}`],
      ["Total score", summary.totalScore],
      ["Testcase tags", summary.tagCount],
      ["Hints / follow-ups", `${summary.hintCount} / ${summary.followupCount}`],
      ["Question ID", summary.questionId],
    ]),
  );

  const changes = result.changes;
  const retained = changes.legacyFieldsRetained.length
    ? changes.legacyFieldsRetained.join(", ")
    : "None";
  elements.changeSummary.replaceChildren(
    definitionList([
      ["Previous testcases", changes.previousTestcaseCount],
      ["New testcases", changes.testcaseCount],
      ["Added / removed", `${changes.added} / ${changes.removed}`],
      ["Preserved testcase IDs", changes.preservedTestcaseIds],
      ["Question ID", changes.questionIdPreserved ? "Preserved" : "Generated"],
      ["Legacy fields retained", retained],
    ]),
  );
  elements.changeSummary.parentElement.hidden = summary.mode !== "update";
  elements.preview.textContent = serializePracticeJson(result.data);
}

function downloadJson(data, filename) {
  const blob = new Blob([serializePracticeJson(data)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function readFile(input, kind) {
  const file = input.files?.[0];
  const status = document.querySelector(`#${input.id}-status`);
  const card = input.closest(".file-card");
  const stateKey = stateKeyByInputId[input.id];
  const version = (readVersions.get(input.id) ?? 0) + 1;
  readVersions.set(input.id, version);
  state[stateKey] = kind === "text" ? "" : null;
  if (card) delete card.dataset.state;
  if (input.id === "id-file") {
    elements.idStatus.textContent =
      "Internal authorization required. Content remains unchanged; all UUID fields are replaced.";
  }
  if (input.id !== "id-file") invalidatePreparationResult();
  if (!file) {
    if (status) status.textContent = "No file selected";
    activeReadVersions.delete(input.id);
    syncReadButtons();
    input.removeAttribute("aria-invalid");
    return;
  }
  activeReadVersions.set(input.id, version);
  if (card) card.dataset.state = "loading";
  syncReadButtons();
  try {
    const content = await file.text();
    const value = kind === "text" ? content : JSON.parse(content);
    if (readVersions.get(input.id) !== version || input.files?.[0] !== file) return;
    state[stateKey] = value;
    if (status) status.textContent = `${file.name} · ${Math.ceil(file.size / 1024)} KB`;
    if (card) card.dataset.state = "ready";
    input.setAttribute("aria-invalid", "false");
    setStatus(`${file.name} loaded.`);
  } catch (error) {
    if (readVersions.get(input.id) !== version) return;
    input.setAttribute("aria-invalid", "true");
    if (card) card.dataset.state = "error";
    if (status) status.textContent = `Could not read ${file.name}: ${error.message}`;
    setStatus(`File error: ${error.message}`);
  } finally {
    if (activeReadVersions.get(input.id) === version) {
      activeReadVersions.delete(input.id);
    }
    syncReadButtons();
  }
}

function syncConditionalFields() {
  const update = selectedValue("mode") === "update";
  elements.existingCard.hidden = !update;
  document.querySelector("#existing-file").required = update;
  elements.nodeNotice.hidden = selectedValue("structure") !== "node";
  invalidatePreparationResult();
}

for (const link of elements.navLinks) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    switchView(link.dataset.nav);
  });
}

for (const input of document.querySelectorAll('input[type="radio"]')) {
  input.addEventListener("change", syncConditionalFields);
}

for (const input of document.querySelectorAll('input[name="languages"]')) {
  input.addEventListener("change", invalidatePreparationResult);
}

for (const [selector, kind] of [
  ["#lua-file", "text"],
  ["#testcases-file", "json"],
  ["#existing-file", "json"],
  ["#id-file", "json"],
]) {
  document.querySelector(selector).addEventListener("change", (event) => {
    readFile(event.currentTarget, kind);
  });
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (activeReadVersions.size > 0) {
    setStatus("Wait for all selected files to finish loading.");
    return;
  }
  elements.prepareButton.disabled = true;
  elements.form.setAttribute("aria-busy", "true");
  setStatus("Validating files and building the preview.");
  try {
    const input = currentInput();
    const preflight = validatePreparation(input);
    if (!preflight.canGenerate) {
      renderInlineReport(preflight);
      setStatus("Validation found blocking issues.");
      return;
    }
    const result = buildPracticeJson(input);
    renderResult(result);
    setStatus("Validation passed. Preview is ready.");
    switchView("validation");
  } catch (error) {
    renderInlineReport({ errors: [error.message], warnings: [] });
    setStatus("Preparation failed.");
  } finally {
    syncReadButtons();
    elements.form.setAttribute("aria-busy", "false");
  }
});

elements.downloadButton.addEventListener("click", () => {
  if (!state.result) return;
  downloadJson(state.result.data, "coding_questions.json");
  setStatus("coding_questions.json downloaded.");
});

elements.idButton.addEventListener("click", () => {
  if (!state.idSource) {
    elements.idStatus.textContent = "Upload a coding_questions.json first.";
    elements.idStatus.focus();
    return;
  }
  try {
    const regenerated = regenerateIds(state.idSource);
    downloadJson(regenerated, "coding_questions_new_ids.json");
    elements.idStatus.textContent =
      "All question, code, solution, and testcase IDs were regenerated.";
  } catch (error) {
    elements.idStatus.textContent = error.message;
  }
});

document.querySelector("#back-to-prepare").addEventListener("click", () => {
  switchView("prepare");
});

window.addEventListener("hashchange", () => {
  const name = window.location.hash.slice(1);
  if (["prepare", "validation", "ids", "reference"].includes(name)) {
    switchView(name, { focus: false });
  }
});

syncConditionalFields();
const initialView = window.location.hash.slice(1);
switchView(
  ["prepare", "validation", "ids", "reference"].includes(initialView)
    ? initialView
    : "prepare",
  { focus: false },
);
