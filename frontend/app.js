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
import {
  DEFAULT_TIME_LIMITS,
  EXECUTABLE_LANGUAGES,
  applyBuffersToDraft,
  buffersFromDraft,
  extractTestCases,
  runCompilerBatch,
  runLanguageBatch,
} from "./execute-runner.js";
import {
  MAX_FINAL_JSON_BYTES,
  filesWithSolution,
  parseFinalCodingQuestion,
} from "./final-json-runner.js";

const VIEW_NAMES = [
  "home",
  "author",
  "execute",
  "execute-final",
  "prepare",
  "validation",
  "ids",
  "reference",
];

const state = {
  luaContent: "",
  testcasesData: null,
  existingJson: null,
  idSource: null,
  result: null,
  authorDraft: emptyDraft("standard"),
  authorHydrating: false,
  execute: {
    testcases: null,
    testcasesLabel: "",
    buffers: {},
    timeLimits: { ...DEFAULT_TIME_LIMITS },
    results: {},
    running: null,
  },
  executeFinal: {
    model: null,
    solutions: {},
    results: {},
    running: null,
    generation: 0,
  },
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
  authorUseExecuteButton: document.querySelector("#author-use-execute-button"),
  authorHintsList: document.querySelector("#author-hints-list"),
  authorFollowupsList: document.querySelector("#author-followups-list"),
  authorAddHint: document.querySelector("#author-add-hint"),
  authorAddFollowup: document.querySelector("#author-add-followup"),
  executeTestcasesFile: document.querySelector("#execute-testcases-file"),
  executeTestcasesStatus: document.querySelector("#execute-testcases-status"),
  executeSummary: document.querySelector("#execute-summary"),
  executeLangPanels: document.querySelector("#execute-lang-panels"),
  executeRunAll: document.querySelector("#execute-run-all"),
  executeToPrepare: document.querySelector("#execute-to-prepare"),
  executeOverallStatus: document.querySelector("#execute-overall-status"),
  executeFinalFile: document.querySelector("#execute-final-file"),
  executeFinalFileStatus: document.querySelector(
    "#execute-final-file-status",
  ),
  executeFinalSummary: document.querySelector("#execute-final-summary"),
  executeFinalLangPanels: document.querySelector(
    "#execute-final-lang-panels",
  ),
  executeFinalRunAll: document.querySelector("#execute-final-run-all"),
  executeFinalOverallStatus: document.querySelector(
    "#execute-final-overall-status",
  ),
  resetWorkspace: document.querySelector("#reset-workspace"),
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
  return state.authorDraft;
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
  document.body.classList.toggle("is-landing", name === "home");
  document.body.classList.remove("nav-open");
  const toggle = document.querySelector("#site-nav-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
  if (name === "execute") {
    state.authorDraft = loadDraft();
    for (const language of EXECUTABLE_LANGUAGES) {
      if (!state.execute.results[language]) {
        state.execute.buffers[language] = buffersFromDraft(
          state.authorDraft,
          language,
        );
      }
    }
    renderExecuteLangPanels();
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

function clearPrepareFileCard(inputId, emptyLabel = "No file selected") {
  const input = document.querySelector(`#${inputId}`);
  const status = document.querySelector(`#${inputId}-status`);
  const card = input?.closest(".file-card");
  if (input) {
    input.value = "";
    input.removeAttribute("aria-invalid");
  }
  if (status) status.textContent = emptyLabel;
  if (card) delete card.dataset.state;
}

function resetWorkspace() {
  const confirmed = window.confirm(
    "Reset the whole workspace?\n\nThis clears the Author Lua draft (localStorage), Execute sessions, Prepare uploads, and validation output. This cannot be undone.",
  );
  if (!confirmed) return;

  persistAuthorDraft.cancel();

  state.luaContent = "";
  state.testcasesData = null;
  state.existingJson = null;
  state.idSource = null;
  state.result = null;
  state.execute = {
    testcases: null,
    testcasesLabel: "",
    buffers: {},
    timeLimits: { ...DEFAULT_TIME_LIMITS },
    results: {},
    running: null,
  };
  state.executeFinal = {
    model: null,
    solutions: {},
    results: {},
    running: null,
    generation: state.executeFinal.generation + 1,
  };

  const draft = clearDraft();
  hydrateAuthorForm(draft);

  clearPrepareFileCard("lua-file");
  clearPrepareFileCard("testcases-file");
  clearPrepareFileCard("existing-file");
  clearPrepareFileCard("id-file");
  if (elements.idStatus) {
    elements.idStatus.textContent =
      "Internal authorization required. Content remains unchanged; all UUID fields are replaced.";
  }

  if (elements.executeTestcasesFile) elements.executeTestcasesFile.value = "";
  if (elements.executeTestcasesStatus) {
    elements.executeTestcasesStatus.textContent =
      "No file selected · cleared on refresh";
  }
  const executeCard = elements.executeTestcasesFile?.closest(".file-card");
  if (executeCard) delete executeCard.dataset.state;
  if (elements.executeSummary) {
    elements.executeSummary.hidden = true;
    elements.executeSummary.textContent = "";
  }
  renderExecuteLangPanels();
  updateExecuteOverallStatus();
  setExecuteControlsBusy(false);

  if (elements.executeFinalFile) {
    elements.executeFinalFile.value = "";
    elements.executeFinalFile.removeAttribute("aria-invalid");
  }
  if (elements.executeFinalFileStatus) {
    elements.executeFinalFileStatus.textContent =
      "No file selected · cleared on refresh";
  }
  const finalCard = elements.executeFinalFile?.closest(".file-card");
  if (finalCard) delete finalCard.dataset.state;
  if (elements.executeFinalSummary) {
    elements.executeFinalSummary.hidden = true;
    elements.executeFinalSummary.replaceChildren();
  }
  renderFinalExecutePanels();
  updateFinalExecuteOverallStatus();
  setFinalExecuteControlsBusy(false);

  const modeCreate = document.querySelector('input[name="mode"][value="create"]');
  if (modeCreate) modeCreate.checked = true;
  const structureStandard = document.querySelector(
    'input[name="structure"][value="standard"]',
  );
  if (structureStandard) structureStandard.checked = true;
  const kindFunction = document.querySelector(
    'input[name="question-kind"][value="function"]',
  );
  if (kindFunction) kindFunction.checked = true;
  const executeKindFunction = document.querySelector(
    'input[name="execute-kind"][value="function"]',
  );
  if (executeKindFunction) executeKindFunction.checked = true;
  for (const input of document.querySelectorAll('input[name="languages"]')) {
    input.checked = true;
  }

  syncConditionalFields();
  invalidatePreparationResult();
  elements.downloadButton.disabled = true;
  setStatus("Workspace reset. Author draft, Execute session, and Prepare uploads were cleared.");
  switchView("author");
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
  const saved = persistAuthorDraft.flush(draft) || saveDraft(draft);
  state.authorDraft = saved;
  updateAuthorSaveStatus(saved.updatedAt);
  return saved;
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

function executeQuestionKind() {
  return (
    document.querySelector('input[name="execute-kind"]:checked')?.value ||
    "function"
  );
}

function ensureExecuteBuffers() {
  const draft = state.authorDraft || loadDraft();
  for (const language of EXECUTABLE_LANGUAGES) {
    if (!state.execute.buffers[language]) {
      state.execute.buffers[language] = buffersFromDraft(draft, language);
    }
  }
}

function readExecuteBufferFromDom(language) {
  return {
    harness:
      document.querySelector(`#execute-${language}-harness`)?.value ?? "",
    solution:
      document.querySelector(`#execute-${language}-solution`)?.value ?? "",
    nodeH: document.querySelector(`#execute-${language}-nodeh`)?.value ?? "",
  };
}

function syncExecuteBufferFromDom(language) {
  state.execute.buffers[language] = readExecuteBufferFromDom(language);
  const limit = Number(
    document.querySelector(`#execute-${language}-limit`)?.value,
  );
  if (Number.isFinite(limit) && limit > 0) {
    state.execute.timeLimits[language] = limit;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderExecuteResults(language, summary, namespace = "execute") {
  const host = document.querySelector(`#${namespace}-${language}-results`);
  if (!host) return;
  if (!summary) {
    host.innerHTML = "";
    return;
  }

  const failed = summary.rows.filter((row) => !row.passed);
  const passed = summary.rows.filter((row) => row.passed);
  const wrap = document.createElement("div");
  wrap.className = "execute-results-wrap";

  const summaryEl = document.createElement("div");
  summaryEl.className = "execute-results-summary";
  summaryEl.dataset.tone =
    summary.passed === summary.total
      ? "pass"
      : summary.passed === 0
        ? "fail"
        : "mixed";
  summaryEl.innerHTML = `
    <strong>${summary.passed}/${summary.total} passed</strong>
    <span>${failed.length} failed · ${passed.length} passed</span>
  `;
  wrap.append(summaryEl);

  if (summary.globalError) {
    const global = document.createElement("p");
    global.className = "execute-results-global";
    global.textContent = summary.globalError;
    wrap.append(global);
  }

  if (failed.length > 0) {
    const failList = document.createElement("div");
    failList.className = "execute-results-list";
    for (const row of failed) {
      const detail = row.error || row.stderr || row.status || "Failed";
      const item = document.createElement("details");
      item.className = "execute-result-item execute-result-fail";
      item.innerHTML = `
        <summary>
          <span class="execute-result-order">#${escapeHtml(row.order ?? row.test_index ?? "")}</span>
          <span class="execute-result-status">${escapeHtml(row.status || "FAIL")}</span>
          <span class="execute-result-time">${row.time == null ? "" : `${escapeHtml(row.time)}s`}</span>
        </summary>
        <pre class="execute-error-pre"></pre>
      `;
      item.querySelector("pre").textContent = detail;
      failList.append(item);
    }
    wrap.append(failList);
  }

  if (passed.length > 0) {
    const passDetails = document.createElement("details");
    passDetails.className = "execute-results-passed";
    passDetails.innerHTML = `
      <summary>${passed.length} passed case${passed.length === 1 ? "" : "s"}</summary>
      <ul class="execute-passed-list"></ul>
    `;
    const list = passDetails.querySelector("ul");
    for (const row of passed) {
      const li = document.createElement("li");
      li.textContent = `#${row.order ?? row.test_index ?? "?"} · ${row.status || "CORRECT"}${
        row.time == null ? "" : ` · ${row.time}s`
      }`;
      list.append(li);
    }
    wrap.append(passDetails);
  }

  host.replaceChildren(wrap);
  const banner = document.querySelector(`#${namespace}-${language}-banner`);
  if (banner) {
    banner.hidden = false;
    banner.textContent = summary.globalError
      ? `${summary.passed}/${summary.total} passed · ${summary.globalError}`
      : `${summary.passed}/${summary.total} passed`;
  }
}

function updateExecuteOverallStatus() {
  if (!elements.executeOverallStatus) return;
  if (!state.execute.testcases) {
    elements.executeOverallStatus.textContent =
      "Upload testcases, then run each language.";
    return;
  }
  const parts = EXECUTABLE_LANGUAGES.map((language) => {
    const summary = state.execute.results[language];
    if (!summary) return `${language}: not run`;
    return `${language}: ${summary.passed}/${summary.total}`;
  });
  elements.executeOverallStatus.textContent = parts.join(" · ");
}

function renderExecuteLangPanels() {
  const host = elements.executeLangPanels;
  if (!host) return;
  ensureExecuteBuffers();
  const draft = state.authorDraft || loadDraft();
  host.replaceChildren();

  for (const language of EXECUTABLE_LANGUAGES) {
    const buffers = state.execute.buffers[language];
    const panel = document.createElement("section");
    panel.className = "panel execute-lang-panel";
    panel.dataset.executeLang = language;

    const title = language.toUpperCase();
    const showNodeH = language === "cpp" && draft.structure === "node";

    panel.innerHTML = `
      <div class="panel-header execute-lang-header">
        <div>
          <span class="panel-index">RUN / ${title}</span>
          <h2>${title}</h2>
          <p id="execute-${language}-banner" class="notice" hidden></p>
        </div>
        <div class="execute-lang-meta">
          <label>
            Time limit (s)
            <input id="execute-${language}-limit" type="number" min="0.1" step="0.1"
              value="${state.execute.timeLimits[language] ?? DEFAULT_TIME_LIMITS[language]}" />
          </label>
        </div>
      </div>
      <div class="execute-actions">
        <button class="button button-primary" type="button" data-execute-run="${language}">Run ${title}</button>
        <button class="button button-secondary" type="button" data-execute-save="${language}">Save to Lua draft</button>
        <button class="button button-secondary" type="button" data-execute-reset="${language}">Reset from draft</button>
      </div>
      <p class="execute-progress" id="execute-${language}-progress" aria-live="polite"></p>
      <div id="execute-${language}-results" class="execute-results-host"></div>
      <details class="execute-code-fold">
        <summary>Edit harness &amp; solution</summary>
        <div class="execute-code-fields">
          <label class="author-field" for="execute-${language}-harness">
            Harness (CODE_BASE64 / main)
            <textarea id="execute-${language}-harness" class="author-code" rows="5" spellcheck="false"></textarea>
          </label>
          <label class="author-field" for="execute-${language}-solution">
            Solution
            <textarea id="execute-${language}-solution" class="author-code" rows="6" spellcheck="false"></textarea>
          </label>
          ${
            showNodeH
              ? `<label class="author-field" for="execute-${language}-nodeh">
                  node.h
                  <textarea id="execute-${language}-nodeh" class="author-code" rows="4" spellcheck="false"></textarea>
                </label>`
              : ""
          }
        </div>
      </details>
    `;

    host.append(panel);
    const harness = panel.querySelector(`#execute-${language}-harness`);
    const solution = panel.querySelector(`#execute-${language}-solution`);
    const nodeh = panel.querySelector(`#execute-${language}-nodeh`);
    if (harness) harness.value = buffers.harness || "";
    if (solution) solution.value = buffers.solution || "";
    if (nodeh) nodeh.value = buffers.nodeH || "";
    if (state.execute.results[language]) {
      renderExecuteResults(language, state.execute.results[language]);
    }
  }
  updateExecuteOverallStatus();
}

function setExecuteControlsBusy(busy) {
  if (elements.executeRunAll) elements.executeRunAll.disabled = busy;
  for (const language of EXECUTABLE_LANGUAGES) {
    const runButton = document.querySelector(`[data-execute-run="${language}"]`);
    if (runButton) runButton.disabled = busy;
  }
}

async function runExecuteLanguage(language, { announce = true, onProgressExtra } = {}) {
  if (!state.execute.testcases?.length) {
    throw new Error("Upload testcases.json on the Execute page first.");
  }
  syncExecuteBufferFromDom(language);
  const draft = state.authorDraft || loadDraft();
  const buffers = state.execute.buffers[language];
  const progress = document.querySelector(`#execute-${language}-progress`);

  const summary = await runLanguageBatch({
    language,
    questionKind: executeQuestionKind(),
    structure: draft.structure || "standard",
    timeLimit: state.execute.timeLimits[language],
    harness: buffers.harness,
    solution: buffers.solution,
    nodeH: buffers.nodeH,
    testcases: state.execute.testcases,
    questionId: "draft",
    questionName: draft.SHORT_TEXT || "question",
    shortText: draft.SHORT_TEXT || "",
    onProgress: ({ message }) => {
      if (progress) progress.textContent = message;
      onProgressExtra?.(language, message);
    },
  });
  state.execute.results[language] = summary;
  renderExecuteResults(language, summary);
  updateExecuteOverallStatus();
  if (progress) {
    progress.textContent = `${summary.passed}/${summary.total} passed`;
  }
  if (announce) {
    setStatus(
      summary.passed === summary.total
        ? `${language.toUpperCase()} passed all cases.`
        : `${language.toUpperCase()} finished with failures — fix and re-run, or continue to Prepare.`,
    );
  }
  return summary;
}

async function handleExecuteRun(language) {
  if (state.execute.running) {
    setStatus("A language run is already in progress.");
    return;
  }
  if (!state.execute.testcases?.length) {
    setStatus("Upload testcases.json on the Execute page first.");
    return;
  }
  state.execute.running = language;
  setExecuteControlsBusy(true);
  try {
    await runExecuteLanguage(language);
  } catch (error) {
    const progress = document.querySelector(`#execute-${language}-progress`);
    if (progress) progress.textContent = error.message;
    setStatus(`Execute failed: ${error.message}`);
  } finally {
    state.execute.running = null;
    setExecuteControlsBusy(false);
  }
}

async function handleExecuteRunAll() {
  if (state.execute.running) {
    setStatus("A language run is already in progress.");
    return;
  }
  if (!state.execute.testcases?.length) {
    setStatus("Upload testcases.json on the Execute page first.");
    return;
  }
  state.execute.running = "all";
  setExecuteControlsBusy(true);
  const live = Object.fromEntries(
    EXECUTABLE_LANGUAGES.map((language) => [language, "starting…"]),
  );
  const refreshOverall = () => {
    if (!elements.executeOverallStatus) return;
    elements.executeOverallStatus.textContent = EXECUTABLE_LANGUAGES.map(
      (language) => `${language.toUpperCase()}: ${live[language]}`,
    ).join(" · ");
  };
  refreshOverall();
  setStatus("Running C++, Python, and Java in parallel…");
  try {
    const settled = await Promise.allSettled(
      EXECUTABLE_LANGUAGES.map((language) =>
        runExecuteLanguage(language, {
          announce: false,
          onProgressExtra: (lang, message) => {
            live[lang] = message;
            refreshOverall();
          },
        }).then((summary) => {
          live[language] = `${summary.passed}/${summary.total}`;
          refreshOverall();
          return { language, summary };
        }),
      ),
    );

    const outcomes = settled.map((result, index) => {
      const language = EXECUTABLE_LANGUAGES[index];
      if (result.status === "fulfilled") {
        const summary = result.value.summary;
        return {
          language,
          ok: summary.passed === summary.total,
          passed: summary.passed,
          total: summary.total,
        };
      }
      const progress = document.querySelector(`#execute-${language}-progress`);
      if (progress) progress.textContent = result.reason?.message || String(result.reason);
      live[language] = "error";
      return {
        language,
        ok: false,
        error: result.reason?.message || String(result.reason),
      };
    });

    updateExecuteOverallStatus();
    const failed = outcomes.filter((item) => !item.ok);
    if (failed.length === 0) {
      setStatus("All languages passed.");
    } else {
      setStatus(
        `Run all finished with issues: ${failed
          .map((item) => item.language.toUpperCase())
          .join(", ")}. Fix and re-run, or continue to Prepare.`,
      );
    }
  } finally {
    state.execute.running = null;
    setExecuteControlsBusy(false);
  }
}

function handleExecuteSave(language) {
  syncExecuteBufferFromDom(language);
  const draft = applyBuffersToDraft(
    state.authorDraft || loadDraft(),
    language,
    state.execute.buffers[language],
  );
  state.authorDraft = saveDraft(draft);
  hydrateAuthorForm(state.authorDraft);
  ensureExecuteBuffers();
  setStatus(`${language.toUpperCase()} buffers saved into Author Lua draft.`);
}

function handleExecuteReset(language) {
  const draft = state.authorDraft || loadDraft();
  state.execute.buffers[language] = buffersFromDraft(draft, language);
  renderExecuteLangPanels();
  setStatus(`${language.toUpperCase()} reset from Author draft.`);
}

async function handleExecuteTestcasesUpload(file) {
  const card = elements.executeTestcasesFile?.closest(".file-card");
  if (!file) {
    state.execute.testcases = null;
    state.execute.testcasesLabel = "";
    if (elements.executeTestcasesStatus) {
      elements.executeTestcasesStatus.textContent =
        "No file selected · cleared on refresh";
    }
    if (card) delete card.dataset.state;
    if (elements.executeSummary) elements.executeSummary.hidden = true;
    updateExecuteOverallStatus();
    return;
  }
  try {
    if (card) card.dataset.state = "loading";
    const text = await file.text();
    const data = JSON.parse(text);
    const cases = extractTestCases(data);
    state.execute.testcases = cases;
    state.execute.testcasesLabel = file.name;
    state.execute.results = {};
    if (elements.executeTestcasesStatus) {
      elements.executeTestcasesStatus.textContent = `${file.name} · ${cases.length} cases · session only`;
    }
    if (card) card.dataset.state = "ready";
    if (elements.executeSummary) {
      elements.executeSummary.hidden = false;
      elements.executeSummary.textContent = `${cases.length} testcases loaded for this session (not stored in localStorage).`;
    }
    renderExecuteLangPanels();
    setStatus(`Loaded ${cases.length} session testcases.`);
  } catch (error) {
    if (card) card.dataset.state = "error";
    if (elements.executeTestcasesStatus) {
      elements.executeTestcasesStatus.textContent = `Could not read file: ${error.message}`;
    }
    setStatus(`Execute upload error: ${error.message}`);
  }
}

function initExecuteUi() {
  renderExecuteLangPanels();
  elements.executeTestcasesFile?.addEventListener("change", (event) => {
    handleExecuteTestcasesUpload(event.currentTarget.files?.[0] || null);
  });
  elements.executeRunAll?.addEventListener("click", (event) => {
    event.preventDefault();
    handleExecuteRunAll();
  });
  elements.executeLangPanels?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.executeRun) {
      event.preventDefault();
      handleExecuteRun(target.dataset.executeRun);
    } else if (target.dataset.executeSave) {
      event.preventDefault();
      handleExecuteSave(target.dataset.executeSave);
    } else if (target.dataset.executeReset) {
      event.preventDefault();
      handleExecuteReset(target.dataset.executeReset);
    }
  });
  elements.executeToPrepare?.addEventListener("click", () => {
    const draft = flushAuthorSave();
    applyDraftToPrepare(draft);
    const kind = executeQuestionKind();
    const kindRadio = document.querySelector(
      `input[name="question-kind"][value="${kind}"]`,
    );
    if (kindRadio) {
      kindRadio.checked = true;
      syncConditionalFields();
    }
    if (state.execute.testcases) {
      state.testcasesData = { test_cases: state.execute.testcases };
      const status = document.querySelector("#testcases-file-status");
      const card = document.querySelector("#testcases-file")?.closest(".file-card");
      if (status) {
        status.textContent = `From Execute session · ${state.execute.testcases.length} cases`;
      }
      if (card) card.dataset.state = "ready";
    }
    const failed = EXECUTABLE_LANGUAGES.filter((language) => {
      const summary = state.execute.results[language];
      return summary && summary.passed < summary.total;
    });
    switchView("prepare");
    if (failed.length > 0) {
      setStatus(
        `Moved to Prepare JSON with warnings: ${failed
          .map((language) => language.toUpperCase())
          .join(", ")} had failing cases. Fix later or verify on the platform.`,
      );
    } else {
      setStatus(
        "Moved to Prepare JSON. Session testcases were copied into this prepare session if uploaded.",
      );
    }
  });
}

function elementWithText(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function updateFinalExecuteOverallStatus() {
  const status = elements.executeFinalOverallStatus;
  if (!status) return;
  const model = state.executeFinal.model;
  if (!model) {
    status.textContent =
      "Upload a final coding_questions.json to inspect runnable packages.";
    return;
  }
  if (model.packages.length === 0) {
    status.textContent =
      "No runnable C++, Python, or Java function packages were found.";
    return;
  }
  status.textContent = model.packages
    .map((item) => {
      const summary = state.executeFinal.results[item.language];
      return summary
        ? `${item.label}: ${summary.passed}/${summary.total}`
        : `${item.label}: not run`;
    })
    .join(" · ");
}

function renderFinalExecuteSummary() {
  const summary = elements.executeFinalSummary;
  const model = state.executeFinal.model;
  if (!summary) return;
  if (!model) {
    summary.hidden = true;
    summary.replaceChildren();
    return;
  }

  const title = elementWithText("strong", "", model.question.shortText);
  const missingSolutions = model.packages.filter(
    (item) => !(state.executeFinal.solutions[item.language] || "").trim(),
  ).length;
  const details = elementWithText(
    "span",
    "",
    `${model.question.difficulty || "Difficulty unavailable"} · ${model.testcases.length} testcases · ${model.packages.length} runnable package${model.packages.length === 1 ? "" : "s"} · ${missingSolutions} need solution · ${model.unavailable.length} unavailable`,
  );
  summary.replaceChildren(title, document.createTextNode(" — "), details);
  summary.hidden = false;
}

function renderFinalExecutePanels() {
  const host = elements.executeFinalLangPanels;
  if (!host) return;
  host.replaceChildren();
  const model = state.executeFinal.model;
  if (!model) {
    updateFinalExecuteOverallStatus();
    setFinalExecuteControlsBusy(false);
    return;
  }

  for (const item of model.packages) {
    const panel = document.createElement("section");
    panel.className = "panel execute-lang-panel";
    panel.dataset.executeFinalLang = item.language;

    const header = document.createElement("div");
    header.className = "panel-header execute-lang-header";
    const headingGroup = document.createElement("div");
    headingGroup.append(
      elementWithText("span", "panel-index", `FINAL / ${item.platform}`),
      elementWithText("h2", "", item.label),
    );
    const banner = elementWithText("p", "notice", "");
    banner.id = `execute-final-${item.language}-banner`;
    banner.hidden = true;
    headingGroup.append(banner);
    header.append(headingGroup);
    header.append(
      elementWithText(
        "p",
        "execute-batch-hint",
        `${item.structure === "node" ? "Node-based" : "Standard"} function package · ${item.timeLimit}s limit`,
      ),
    );

    const actions = document.createElement("div");
    actions.className = "execute-actions";
    const runButton = elementWithText(
      "button",
      "button button-primary",
      `Run ${item.label}`,
    );
    runButton.type = "button";
    runButton.dataset.executeFinalRun = item.language;
    runButton.disabled = Boolean(state.executeFinal.running);
    actions.append(runButton);

    const progress = elementWithText("p", "execute-progress", "");
    progress.id = `execute-final-${item.language}-progress`;
    progress.setAttribute("aria-live", "polite");

    const results = document.createElement("div");
    results.id = `execute-final-${item.language}-results`;
    results.className = "execute-results-host";

    const solutionText =
      state.executeFinal.solutions[item.language] ?? item.solution ?? "";
    const hasSolutionText = Boolean(solutionText.trim());
    const fold = document.createElement("details");
    fold.className = "execute-code-fold";
    fold.open = !hasSolutionText;
    const foldSummary = elementWithText(
      "summary",
      "",
      hasSolutionText
        ? "Reference solution (editable)"
        : "Add reference solution",
    );
    const solutionField = document.createElement("label");
    solutionField.className = "author-field";
    solutionField.htmlFor = `execute-final-${item.language}-solution`;
    solutionField.append(
      document.createTextNode(`Solution → ${item.submitFilePath}`),
    );
    const solutionHelp = elementWithText(
      "p",
      "field-help",
      item.hasSolution
        ? "Packaged solution is prefilled. Edit before run if needed."
        : "This JSON has no solution for this language. Paste one to run testcases.",
    );
    const solutionInput = document.createElement("textarea");
    solutionInput.id = `execute-final-${item.language}-solution`;
    solutionInput.className = "author-code";
    solutionInput.rows = 8;
    solutionInput.spellcheck = false;
    solutionInput.value = solutionText;
    solutionInput.dataset.executeFinalSolution = item.language;
    solutionInput.setAttribute(
      "aria-describedby",
      `execute-final-${item.language}-solution-help`,
    );
    solutionHelp.id = `execute-final-${item.language}-solution-help`;
    solutionField.append(solutionHelp, solutionInput);
    fold.append(foldSummary, solutionField);

    runButton.disabled =
      Boolean(state.executeFinal.running) || !hasSolutionText;

    panel.append(header, actions, progress, results, fold);
    host.append(panel);
    if (state.executeFinal.results[item.language]) {
      renderExecuteResults(
        item.language,
        state.executeFinal.results[item.language],
        "execute-final",
      );
    }
  }

  for (const item of model.unavailable) {
    const panel = document.createElement("section");
    panel.className = "panel execute-lang-panel";
    panel.append(
      elementWithText("span", "panel-index", `UNAVAILABLE / ${item.platform}`),
      elementWithText("h2", "", item.label),
      elementWithText("p", "notice", item.reason),
    );
    host.append(panel);
  }

  updateFinalExecuteOverallStatus();
  setFinalExecuteControlsBusy(Boolean(state.executeFinal.running));
}

function packageHasRunnableSolution(language) {
  return Boolean((state.executeFinal.solutions[language] || "").trim());
}

function setFinalExecuteControlsBusy(busy) {
  if (elements.executeFinalFile) elements.executeFinalFile.disabled = busy;
  const packages = state.executeFinal.model?.packages ?? [];
  const runnableCount = packages.filter((item) =>
    packageHasRunnableSolution(item.language),
  ).length;
  if (elements.executeFinalRunAll) {
    elements.executeFinalRunAll.disabled = busy || runnableCount === 0;
  }
  for (const button of document.querySelectorAll("[data-execute-final-run]")) {
    const language = button.dataset.executeFinalRun;
    button.disabled = busy || !packageHasRunnableSolution(language);
  }
  for (const input of document.querySelectorAll(
    "[data-execute-final-solution]",
  )) {
    input.disabled = busy;
  }
}

async function runFinalExecuteLanguage(
  language,
  { announce = true, onProgressExtra } = {},
) {
  const model = state.executeFinal.model;
  const packageData = model?.packages.find(
    (item) => item.language === language,
  );
  if (!model || !packageData) {
    throw new Error(`No runnable ${language.toUpperCase()} package is loaded.`);
  }

  const generation = state.executeFinal.generation;
  const progress = document.querySelector(
    `#execute-final-${language}-progress`,
  );
  const solutionText =
    state.executeFinal.solutions[language] ??
    document.querySelector(`#execute-final-${language}-solution`)?.value ??
    "";
  const files = filesWithSolution(packageData, solutionText);
  const summary = await runCompilerBatch({
    language,
    questionKind: packageData.questionKind,
    structure: packageData.structure,
    timeLimit: packageData.timeLimit,
    files,
    mainFilePath: packageData.mainFilePath,
    testcases: model.testcases,
    questionId: model.question.id,
    questionName: model.question.shortText,
    shortText: model.question.shortText,
    onProgress: ({ message }) => {
      if (generation !== state.executeFinal.generation) return;
      if (progress) progress.textContent = message;
      onProgressExtra?.(packageData.label, message);
    },
  });

  if (generation !== state.executeFinal.generation) {
    throw new Error("The final JSON session changed during execution.");
  }
  state.executeFinal.results[language] = summary;
  renderExecuteResults(language, summary, "execute-final");
  updateFinalExecuteOverallStatus();
  if (progress) {
    progress.textContent = `${summary.passed}/${summary.total} passed`;
  }
  if (announce) {
    setStatus(
      summary.passed === summary.total
        ? `${packageData.label} final package passed all cases.`
        : `${packageData.label} final package finished with failures.`,
    );
  }
  return summary;
}

async function handleFinalExecuteRun(language) {
  if (state.executeFinal.running) {
    setStatus("A final JSON language run is already in progress.");
    return;
  }
  const generation = state.executeFinal.generation;
  state.executeFinal.running = language;
  setFinalExecuteControlsBusy(true);
  try {
    await runFinalExecuteLanguage(language);
  } catch (error) {
    if (generation !== state.executeFinal.generation) return;
    const progress = document.querySelector(
      `#execute-final-${language}-progress`,
    );
    if (progress) progress.textContent = error.message;
    setStatus(`Final JSON execution failed: ${error.message}`);
  } finally {
    if (generation === state.executeFinal.generation) {
      state.executeFinal.running = null;
      setFinalExecuteControlsBusy(false);
    }
  }
}

async function handleFinalExecuteRunAll() {
  const packages = state.executeFinal.model?.packages ?? [];
  const runnable = packages.filter((item) =>
    packageHasRunnableSolution(item.language),
  );
  if (state.executeFinal.running) {
    setStatus("A final JSON language run is already in progress.");
    return;
  }
  if (packages.length === 0) {
    setStatus("Upload a final JSON with at least one runnable package.");
    return;
  }
  if (runnable.length === 0) {
    setStatus("Paste a reference solution for at least one language first.");
    return;
  }

  const generation = state.executeFinal.generation;
  state.executeFinal.running = "all";
  setFinalExecuteControlsBusy(true);
  const live = Object.fromEntries(
    runnable.map((item) => [item.label, "starting…"]),
  );
  const refreshOverall = () => {
    if (!elements.executeFinalOverallStatus) return;
    elements.executeFinalOverallStatus.textContent = Object.entries(live)
      .map(([label, message]) => `${label}: ${message}`)
      .join(" · ");
  };
  refreshOverall();
  setStatus("Running all packaged final JSON languages in parallel…");

  try {
    const settled = await Promise.allSettled(
      runnable.map((item) =>
        runFinalExecuteLanguage(item.language, {
          announce: false,
          onProgressExtra: (label, message) => {
            live[label] = message;
            refreshOverall();
          },
        }),
      ),
    );
    if (generation !== state.executeFinal.generation) return;
    const outcomes = settled.map((result, index) => {
      const packageData = runnable[index];
      if (result.status === "fulfilled") {
        live[packageData.label] =
          `${result.value.passed}/${result.value.total}`;
        return {
          label: packageData.label,
          ok: result.value.passed === result.value.total,
        };
      }
      const message = result.reason?.message || String(result.reason);
      const progress = document.querySelector(
        `#execute-final-${packageData.language}-progress`,
      );
      if (progress) progress.textContent = message;
      live[packageData.label] = "error";
      return { label: packageData.label, ok: false };
    });
    const failed = outcomes.filter((result) => !result.ok);
    updateFinalExecuteOverallStatus();
    setStatus(
      failed.length === 0
        ? "All packaged final JSON languages passed."
        : `${failed.length} packaged language run${failed.length === 1 ? "" : "s"} finished with issues: ${failed.map((item) => item.label).join(", ")}.`,
    );
  } finally {
    if (generation === state.executeFinal.generation) {
      state.executeFinal.running = null;
      setFinalExecuteControlsBusy(false);
    }
  }
}

function resetFinalExecuteSession() {
  state.executeFinal = {
    model: null,
    solutions: {},
    results: {},
    running: null,
    generation: state.executeFinal.generation + 1,
  };
  renderFinalExecuteSummary();
  renderFinalExecutePanels();
  return state.executeFinal.generation;
}

function showFinalExecuteUploadError(error, card) {
  if (card) card.dataset.state = "error";
  if (elements.executeFinalFile) {
    elements.executeFinalFile.setAttribute("aria-invalid", "true");
  }
  if (elements.executeFinalFileStatus) {
    elements.executeFinalFileStatus.textContent =
      `Could not read file: ${error.message}`;
  }
  if (elements.executeFinalOverallStatus) {
    elements.executeFinalOverallStatus.textContent =
      "The selected final JSON could not be loaded.";
  }
  setStatus(`Final JSON upload error: ${error.message}`);
}

function commitFinalExecuteModel(model, file, card) {
  state.executeFinal.model = model;
  state.executeFinal.solutions = Object.fromEntries(
    model.packages.map((item) => [item.language, item.solution || ""]),
  );
  state.executeFinal.results = {};
  if (elements.executeFinalFile) {
    elements.executeFinalFile.setAttribute("aria-invalid", "false");
  }
  const missingSolutions = model.packages.filter(
    (item) => !item.hasSolution,
  ).length;
  if (elements.executeFinalFileStatus) {
    elements.executeFinalFileStatus.textContent =
      `${file.name} · ${model.testcases.length} cases · ${model.packages.length} runnable packages` +
      (missingSolutions
        ? ` · ${missingSolutions} need pasted solution`
        : "");
  }
  if (card) card.dataset.state = "ready";
  renderFinalExecuteSummary();
  renderFinalExecutePanels();
}

async function handleFinalExecuteUpload(file) {
  const generation = resetFinalExecuteSession();
  const card = elements.executeFinalFile?.closest(".file-card");
  if (!file) {
    if (card) delete card.dataset.state;
    if (elements.executeFinalFileStatus) {
      elements.executeFinalFileStatus.textContent =
        "No file selected · cleared on refresh";
    }
    return;
  }

  try {
    if (file.size > MAX_FINAL_JSON_BYTES) {
      throw new Error("File exceeds the 100 MiB upload limit.");
    }
    if (card) card.dataset.state = "loading";
    const raw = JSON.parse(await file.text());
    if (generation !== state.executeFinal.generation) return;
    commitFinalExecuteModel(parseFinalCodingQuestion(raw), file, card);
  } catch (error) {
    if (generation !== state.executeFinal.generation) return;
    showFinalExecuteUploadError(error, card);
  }
}

function initFinalExecuteUi() {
  renderFinalExecutePanels();
  elements.executeFinalFile?.addEventListener("change", (event) => {
    handleFinalExecuteUpload(event.currentTarget.files?.[0] || null);
  });
  elements.executeFinalRunAll?.addEventListener("click", (event) => {
    event.preventDefault();
    handleFinalExecuteRunAll();
  });
  elements.executeFinalLangPanels?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.executeFinalRun) {
      event.preventDefault();
      handleFinalExecuteRun(target.dataset.executeFinalRun);
    }
  });
  elements.executeFinalLangPanels?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) return;
    const language = target.dataset.executeFinalSolution;
    if (!language) return;
    state.executeFinal.solutions[language] = target.value;
    const fold = target.closest("details");
    const summary = fold?.querySelector("summary");
    if (summary) {
      summary.textContent = target.value.trim()
        ? "Reference solution (editable)"
        : "Add reference solution";
    }
    renderFinalExecuteSummary();
    setFinalExecuteControlsBusy(Boolean(state.executeFinal.running));
  });
}


for (const link of elements.navLinks) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    switchView(link.dataset.nav);
  });
}

document.querySelector("[data-view=\"home\"]")?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-home-go]");
  if (!(target instanceof HTMLElement)) return;
  event.preventDefault();
  const dest = target.dataset.homeGo;
  if (VIEW_NAMES.includes(dest)) switchView(dest);
});

elements.resetWorkspace?.addEventListener("click", (event) => {
  event.preventDefault();
  resetWorkspace();
});

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

  elements.authorUseExecuteButton?.addEventListener("click", () => {
    flushAuthorSave();
    const prepareKind =
      document.querySelector('input[name="question-kind"]:checked')?.value ||
      "function";
    const executeKind = document.querySelector(
      `input[name="execute-kind"][value="${prepareKind}"]`,
    );
    if (executeKind) executeKind.checked = true;
    switchView("execute");
    setStatus("Author draft ready for Execute. Upload session testcases next.");
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

document.querySelector("#site-nav-toggle")?.addEventListener("click", () => {
  const open = document.body.classList.toggle("nav-open");
  document
    .querySelector("#site-nav-toggle")
    ?.setAttribute("aria-expanded", open ? "true" : "false");
});

hydrateAuthorForm(loadDraft());
setAuthorLanguageTab("CPP");
initExecuteUi();
initFinalExecuteUi();
syncConditionalFields();
const initialView = window.location.hash.slice(1);
switchView(VIEW_NAMES.includes(initialView) ? initialView : "home", {
  focus: false,
});
