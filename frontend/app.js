import {
  buildPracticeJson,
  regenerateIds,
  serializePracticeJson,
  validatePreparation,
} from "./json-prep.js";
import {
  LANGUAGE_KEYS,
  assembleLua,
  clearDraft,
  createDebouncedSave,
  emptyDraft,
  loadDraft,
  parseLuaToDraft,
  saveDraft,
} from "./lua-draft.js";

const VIEW_NAMES = ["author", "prepare", "validation", "ids", "reference"];

const state = {
  luaContent: "",
  testcasesData: null,
  existingJson: null,
  idSource: null,
  result: null,
  authorDraft: emptyDraft("standard"),
  authorHydrating: false,
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
  luaFile: document.querySelector("#lua-file"),
  luaFileStatus: document.querySelector("#lua-file-status"),
  authorForm: document.querySelector("#author-form"),
  authorSaveStatus: document.querySelector("#author-save-status"),
  authorNodeBlock: document.querySelector("#author-node-h-block"),
  authorImportFile: document.querySelector("#author-import-file"),
  authorClearButton: document.querySelector("#author-clear-button"),
  authorDownloadButton: document.querySelector("#author-download-button"),
  authorUsePrepareButton: document.querySelector("#author-use-prepare-button"),
  authorHintsList: document.querySelector("#author-hints-list"),
  authorFollowupsList: document.querySelector("#author-followups-list"),
  authorAddHint: document.querySelector("#author-add-hint"),
  authorAddFollowup: document.querySelector("#author-add-followup"),
};

const stateKeyByInputId = {
  "lua-file": "luaContent",
  "testcases-file": "testcasesData",
  "existing-file": "existingJson",
  "id-file": "idSource",
};
const readVersions = new Map();
const activeReadVersions = new Map();

const persistAuthorDraft = createDebouncedSave((draft) => {
  state.authorDraft = saveDraft(draft);
  updateAuthorSaveStatus(state.authorDraft.updatedAt);
});

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

function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadJson(data, filename) {
  downloadText(serializePracticeJson(data), filename, "application/json");
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

function formatSavedAt(updatedAt) {
  if (!updatedAt) return "Not saved yet";
  try {
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return "Saved locally";
    return `Saved locally · ${date.toLocaleString()}`;
  } catch {
    return "Saved locally";
  }
}

function updateAuthorSaveStatus(updatedAt) {
  if (!elements.authorSaveStatus) return;
  elements.authorSaveStatus.textContent = formatSavedAt(updatedAt);
}

function syncAuthorStructureUi(structure) {
  const isNode = structure === "node";
  if (elements.authorNodeBlock) elements.authorNodeBlock.hidden = !isNode;
  const radio = document.querySelector(
    `input[name="author-structure"][value="${structure}"]`,
  );
  if (radio) radio.checked = true;
}

function setAuthorLanguageTab(language) {
  for (const tab of document.querySelectorAll("[data-author-lang]")) {
    const selected = tab.dataset.authorLang === language;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of document.querySelectorAll("[data-author-lang-panel]")) {
    panel.hidden = panel.dataset.authorLangPanel !== language;
  }
}

function renderHintsList(hints) {
  const list = elements.authorHintsList;
  if (!list) return;
  const values = Array.isArray(hints) && hints.length > 0 ? hints : [""];
  list.replaceChildren();
  values.forEach((hint, index) => {
    const item = document.createElement("div");
    item.className = "author-repeat-item";
    item.dataset.hintIndex = String(index);

    const header = document.createElement("div");
    header.className = "author-repeat-header";
    const title = document.createElement("strong");
    title.textContent = `Hint ${index + 1}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button-secondary author-remove-item";
    remove.dataset.removeHint = String(index);
    remove.textContent = "Remove";
    remove.disabled = values.length <= 1;
    header.append(title, remove);

    const field = document.createElement("label");
    field.className = "author-field";
    field.htmlFor = `author-hint-${index + 1}`;
    const textarea = document.createElement("textarea");
    textarea.id = `author-hint-${index + 1}`;
    textarea.name = `hint-${index + 1}`;
    textarea.rows = 3;
    textarea.value = hint ?? "";
    field.append(textarea);

    item.append(header, field);
    list.append(item);
  });
}

function renderFollowUpsList(followUps) {
  const list = elements.authorFollowupsList;
  if (!list) return;
  const values =
    Array.isArray(followUps) && followUps.length > 0
      ? followUps
      : [{ question: "", answer: "" }];
  list.replaceChildren();
  values.forEach((pair, index) => {
    const item = document.createElement("fieldset");
    item.className = "author-followup author-repeat-item";
    item.dataset.followupIndex = String(index);

    const legend = document.createElement("legend");
    legend.className = "author-repeat-header";
    const title = document.createElement("span");
    title.textContent = `Follow-up ${index + 1}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button-secondary author-remove-item";
    remove.dataset.removeFollowup = String(index);
    remove.textContent = "Remove";
    remove.disabled = values.length <= 1;
    legend.append(title, remove);

    const qLabel = document.createElement("label");
    qLabel.className = "author-field";
    qLabel.htmlFor = `author-followup-q-${index + 1}`;
    qLabel.append("Question");
    const qArea = document.createElement("textarea");
    qArea.id = `author-followup-q-${index + 1}`;
    qArea.name = `followup-q-${index + 1}`;
    qArea.rows = 2;
    qArea.value = pair?.question ?? "";
    qLabel.append(qArea);

    const aLabel = document.createElement("label");
    aLabel.className = "author-field";
    aLabel.htmlFor = `author-followup-a-${index + 1}`;
    aLabel.append("Answer");
    const aArea = document.createElement("textarea");
    aArea.id = `author-followup-a-${index + 1}`;
    aArea.name = `followup-a-${index + 1}`;
    aArea.rows = 3;
    aArea.value = pair?.answer ?? "";
    aLabel.append(aArea);

    item.append(legend, qLabel, aLabel);
    list.append(item);
  });
}

function hydrateAuthorForm(draft) {
  state.authorHydrating = true;
  state.authorDraft = draft;
  syncAuthorStructureUi(draft.structure);

  const setValue = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.value = value ?? "";
  };

  setValue("#author-description", draft.QUESTION_DESCRIPTION);
  setValue("#author-short-text", draft.SHORT_TEXT);
  setValue("#author-level", draft.QUESTION_LEVEL);
  setValue("#author-companies", draft.COMPANIES);
  setValue("#author-default-tags", draft.DEFAULT_TAGS);
  setValue("#author-beginner-topics", draft.BEGINNER_TOPICS);
  setValue("#author-intermediate-topics", draft.INTERMEDIATE_TOPICS);
  setValue("#author-advanced-topics", draft.ADVANCED_TOPICS);
  setValue("#author-real-life", draft.REAL_LIFE_EXAMPLES);
  setValue("#author-node-h", draft.NODE_H_CONTENT);

  renderHintsList(draft.hints);
  renderFollowUpsList(draft.followUps);

  for (const language of LANGUAGE_KEYS) {
    const lang = draft.languages[language];
    setValue(`#author-${language}-codeContent`, lang.codeContent);
    setValue(`#author-${language}-codeBase64`, lang.codeBase64);
    setValue(`#author-${language}-solution`, lang.solution);
    setValue(`#author-${language}-debugPre`, lang.debugPre);
    setValue(`#author-${language}-debugPost`, lang.debugPost);
  }

  updateAuthorSaveStatus(draft.updatedAt);
  state.authorHydrating = false;
}

function readAuthorForm() {
  const structure =
    document.querySelector('input[name="author-structure"]:checked')?.value ??
    "standard";
  const draft = emptyDraft(structure);
  draft.QUESTION_DESCRIPTION =
    document.querySelector("#author-description")?.value ?? "";
  draft.SHORT_TEXT = document.querySelector("#author-short-text")?.value ?? "";
  draft.QUESTION_LEVEL = document.querySelector("#author-level")?.value ?? "";
  draft.COMPANIES = document.querySelector("#author-companies")?.value ?? "";
  draft.DEFAULT_TAGS =
    document.querySelector("#author-default-tags")?.value ?? "";
  draft.BEGINNER_TOPICS =
    document.querySelector("#author-beginner-topics")?.value ?? "";
  draft.INTERMEDIATE_TOPICS =
    document.querySelector("#author-intermediate-topics")?.value ?? "";
  draft.ADVANCED_TOPICS =
    document.querySelector("#author-advanced-topics")?.value ?? "";
  draft.REAL_LIFE_EXAMPLES =
    document.querySelector("#author-real-life")?.value ?? "";
  draft.NODE_H_CONTENT = document.querySelector("#author-node-h")?.value ?? "";

  const hintItems = [
    ...document.querySelectorAll("#author-hints-list [data-hint-index]"),
  ];
  draft.hints =
    hintItems.length > 0
      ? hintItems.map(
          (item) => item.querySelector("textarea")?.value ?? "",
        )
      : [""];

  const followupItems = [
    ...document.querySelectorAll("#author-followups-list [data-followup-index]"),
  ];
  draft.followUps =
    followupItems.length > 0
      ? followupItems.map((item) => {
          const areas = item.querySelectorAll("textarea");
          return {
            question: areas[0]?.value ?? "",
            answer: areas[1]?.value ?? "",
          };
        })
      : [{ question: "", answer: "" }];

  for (const language of LANGUAGE_KEYS) {
    draft.languages[language] = {
      codeContent:
        document.querySelector(`#author-${language}-codeContent`)?.value ?? "",
      codeBase64:
        document.querySelector(`#author-${language}-codeBase64`)?.value ?? "",
      solution:
        document.querySelector(`#author-${language}-solution`)?.value ?? "",
      debugPre:
        document.querySelector(`#author-${language}-debugPre`)?.value ?? "",
      debugPost:
        document.querySelector(`#author-${language}-debugPost`)?.value ?? "",
    };
  }
  draft.updatedAt = state.authorDraft.updatedAt;
  return draft;
}

function addAuthorHint() {
  const draft = readAuthorForm();
  draft.hints.push("");
  state.authorHydrating = true;
  renderHintsList(draft.hints);
  state.authorHydrating = false;
  scheduleAuthorSave();
  document
    .querySelector(`#author-hint-${draft.hints.length}`)
    ?.focus();
}

function removeAuthorHint(index) {
  const draft = readAuthorForm();
  if (draft.hints.length <= 1) return;
  draft.hints.splice(index, 1);
  state.authorHydrating = true;
  renderHintsList(draft.hints);
  state.authorHydrating = false;
  scheduleAuthorSave();
}

function addAuthorFollowup() {
  const draft = readAuthorForm();
  draft.followUps.push({ question: "", answer: "" });
  state.authorHydrating = true;
  renderFollowUpsList(draft.followUps);
  state.authorHydrating = false;
  scheduleAuthorSave();
  document
    .querySelector(`#author-followup-q-${draft.followUps.length}`)
    ?.focus();
}

function removeAuthorFollowup(index) {
  const draft = readAuthorForm();
  if (draft.followUps.length <= 1) return;
  draft.followUps.splice(index, 1);
  state.authorHydrating = true;
  renderFollowUpsList(draft.followUps);
  state.authorHydrating = false;
  scheduleAuthorSave();
}

function scheduleAuthorSave() {
  if (state.authorHydrating) return;
  const draft = readAuthorForm();
  state.authorDraft = draft;
  syncAuthorStructureUi(draft.structure);
  persistAuthorDraft(draft);
  elements.authorSaveStatus.textContent = "Saving…";
}

function flushAuthorSave() {
  if (state.authorHydrating) return state.authorDraft;
  const draft = readAuthorForm();
  state.authorDraft = persistAuthorDraft.flush(draft);
  updateAuthorSaveStatus(state.authorDraft.updatedAt);
  return state.authorDraft;
}

function markLuaCardFromBrowserDraft() {
  const card = elements.luaFile?.closest(".file-card");
  if (elements.luaFile) {
    elements.luaFile.value = "";
    elements.luaFile.removeAttribute("aria-invalid");
    elements.luaFile.removeAttribute("required");
  }
  if (card) card.dataset.state = "ready";
  if (elements.luaFileStatus) {
    elements.luaFileStatus.textContent = "Browser draft · saved locally";
  }
}

function applyDraftToPrepare(draft) {
  const assembled = assembleLua(draft);
  state.luaContent = assembled;
  invalidatePreparationResult();

  const structureRadio = document.querySelector(
    `input[name="structure"][value="${draft.structure}"]`,
  );
  if (structureRadio) {
    structureRadio.checked = true;
    syncConditionalFields();
  }

  markLuaCardFromBrowserDraft();
  return assembled;
}

for (const link of elements.navLinks) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    switchView(link.dataset.nav);
  });
}

for (const input of document.querySelectorAll(
  '#preparation-form input[type="radio"]',
)) {
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
    const input = event.currentTarget;
    if (input.id === "lua-file") {
      input.required = true;
    }
    readFile(input, kind);
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

if (elements.authorForm) {
  elements.authorForm.addEventListener("input", scheduleAuthorSave);
  elements.authorForm.addEventListener("change", scheduleAuthorSave);

  elements.authorForm.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.removeHint != null) {
      event.preventDefault();
      removeAuthorHint(Number(target.dataset.removeHint));
      return;
    }
    if (target.dataset.removeFollowup != null) {
      event.preventDefault();
      removeAuthorFollowup(Number(target.dataset.removeFollowup));
    }
  });

  elements.authorAddHint?.addEventListener("click", (event) => {
    event.preventDefault();
    addAuthorHint();
  });
  elements.authorAddFollowup?.addEventListener("click", (event) => {
    event.preventDefault();
    addAuthorFollowup();
  });

  for (const tab of document.querySelectorAll("[data-author-lang]")) {
    tab.addEventListener("click", () => {
      setAuthorLanguageTab(tab.dataset.authorLang);
    });
  }

  elements.authorImportFile?.addEventListener("change", async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const draft = parseLuaToDraft(text);
      const saved = saveDraft(draft);
      hydrateAuthorForm(saved);
      setStatus(`${file.name} imported into Author Lua draft.`);
    } catch (error) {
      setStatus(`Could not import Lua: ${error.message}`);
    } finally {
      event.currentTarget.value = "";
    }
  });

  elements.authorClearButton?.addEventListener("click", () => {
    persistAuthorDraft.cancel();
    const draft = clearDraft();
    hydrateAuthorForm(draft);
    setStatus("Author Lua draft cleared.");
  });

  elements.authorDownloadButton?.addEventListener("click", () => {
    const draft = flushAuthorSave();
    downloadText(assembleLua(draft), "question.lua", "text/plain");
    setStatus("question.lua downloaded.");
  });

  elements.authorUsePrepareButton?.addEventListener("click", () => {
    const draft = flushAuthorSave();
    applyDraftToPrepare(draft);
    switchView("prepare");
    setStatus("Browser Lua draft loaded into Prepare JSON.");
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushAuthorSave();
});

window.addEventListener("beforeunload", () => {
  flushAuthorSave();
});

window.addEventListener("hashchange", () => {
  const name = window.location.hash.slice(1);
  if (VIEW_NAMES.includes(name)) {
    switchView(name, { focus: false });
  }
});

hydrateAuthorForm(loadDraft());
setAuthorLanguageTab("CPP");
syncConditionalFields();
const initialView = window.location.hash.slice(1);
switchView(VIEW_NAMES.includes(initialView) ? initialView : "prepare", {
  focus: false,
});
