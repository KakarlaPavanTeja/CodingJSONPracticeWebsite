import { parseSection } from "./json-prep.js";

export const DRAFT_STORAGE_KEY = "coding-json-lua-draft-v1";
export const DRAFT_SAVE_DELAY_MS = 400;

export const LANGUAGE_KEYS = ["CPP", "PYTHON", "JAVA", "NODE_JS"];
export const DEBUG_LANGUAGES = ["CPP", "PYTHON", "JAVA"];

const FLAT_FIELDS = [
  "QUESTION_DESCRIPTION",
  "SHORT_TEXT",
  "QUESTION_LEVEL",
  "COMPANIES",
  "DEFAULT_TAGS",
  "BEGINNER_TOPICS",
  "INTERMEDIATE_TOPICS",
  "ADVANCED_TOPICS",
  "REAL_LIFE_EXAMPLES",
  "NODE_H_CONTENT",
];

function emptyLanguage() {
  return {
    codeContent: "",
    codeBase64: "",
    solution: "",
    debugPre: "",
    debugPost: "",
  };
}

function emptyLanguages() {
  return Object.fromEntries(LANGUAGE_KEYS.map((key) => [key, emptyLanguage()]));
}

export function emptyDraft(structure = "standard") {
  return {
    structure: structure === "node" ? "node" : "standard",
    QUESTION_DESCRIPTION: "",
    SHORT_TEXT: "",
    QUESTION_LEVEL: "",
    COMPANIES: "",
    DEFAULT_TAGS: "",
    BEGINNER_TOPICS: "",
    INTERMEDIATE_TOPICS: "",
    ADVANCED_TOPICS: "",
    REAL_LIFE_EXAMPLES: "",
    NODE_H_CONTENT: "",
    hints: [""],
    followUps: [{ question: "", answer: "" }],
    languages: emptyLanguages(),
    updatedAt: null,
  };
}

function marker(name, boundary) {
  return `----------${name}_${boundary}----------`;
}

function wrapSection(name, value) {
  const body = value == null ? "" : String(value);
  return `${marker(name, "START")}\n${body}\n${marker(name, "END")}`;
}

function indexedMarkerNumbers(outer, itemPrefix) {
  if (!outer) return [];
  const expression = new RegExp(
    `----------${itemPrefix}_START_(\\d+)----------`,
    "g",
  );
  return [
    ...new Set(
      [...outer.matchAll(expression)].map((match) => Number(match[1])),
    ),
  ].sort((left, right) => left - right);
}

function parseIndexedHint(luaContent, index) {
  const outer = parseSection(luaContent, "HINTS");
  if (!outer) return "";
  const start = `----------HINTS_START_${index}----------`;
  const end = `----------HINTS_END_${index}----------`;
  const startIndex = outer.indexOf(start);
  if (startIndex < 0) return "";
  const valueStart = startIndex + start.length;
  const endIndex = outer.indexOf(end, valueStart);
  if (endIndex < 0) return "";
  return outer.slice(valueStart, endIndex).trim();
}

function parseAllHints(luaContent) {
  const outer = parseSection(luaContent, "HINTS");
  const indexes = indexedMarkerNumbers(outer, "HINTS");
  if (indexes.length === 0) return [""];
  return indexes.map((index) => parseIndexedHint(luaContent, index));
}

function parseFollowUpPair(luaContent, index) {
  const outer = parseSection(luaContent, "FOLLOW_UP_QUESTIONS");
  if (!outer) return { question: "", answer: "" };
  const start = `----------FOLLOW_UP_QUESTION_START_${index}----------`;
  const end = `----------FOLLOW_UP_QUESTION_END_${index}----------`;
  const startIndex = outer.indexOf(start);
  if (startIndex < 0) return { question: "", answer: "" };
  const valueStart = startIndex + start.length;
  const endIndex = outer.indexOf(end, valueStart);
  if (endIndex < 0) return { question: "", answer: "" };
  const block = outer.slice(valueStart, endIndex);
  return {
    question: parseSection(block, "QUESTION"),
    answer: parseSection(block, "ANSWER"),
  };
}

function parseAllFollowUps(luaContent) {
  const outer = parseSection(luaContent, "FOLLOW_UP_QUESTIONS");
  const indexes = indexedMarkerNumbers(outer, "FOLLOW_UP_QUESTION");
  if (indexes.length === 0) return [{ question: "", answer: "" }];
  return indexes.map((index) => parseFollowUpPair(luaContent, index));
}

function normalizeHints(rawHints) {
  if (!Array.isArray(rawHints) || rawHints.length === 0) return [""];
  return rawHints.map((hint) => (typeof hint === "string" ? hint : ""));
}

function normalizeFollowUps(rawFollowUps) {
  if (!Array.isArray(rawFollowUps) || rawFollowUps.length === 0) {
    return [{ question: "", answer: "" }];
  }
  return rawFollowUps.map((item) => ({
    question: typeof item?.question === "string" ? item.question : "",
    answer: typeof item?.answer === "string" ? item.answer : "",
  }));
}

function parseDebugParts(luaContent, language) {
  const section = parseSection(luaContent, `DEBUG_HELPER_CODE_${language}`);
  if (!section) return { debugPre: "", debugPost: "" };
  return {
    debugPre: parseSection(section, "PRE_USER_CODE"),
    debugPost: parseSection(section, "POST_USER_CODE"),
  };
}

function detectStructure(luaText, structure) {
  if (structure === "standard" || structure === "node") return structure;
  if (
    typeof luaText === "string" &&
    luaText.includes(marker("NODE_H_CONTENT", "START"))
  ) {
    return "node";
  }
  return "standard";
}

function normalizeDraft(raw, fallbackStructure = "standard") {
  const base = emptyDraft(fallbackStructure);
  if (!raw || typeof raw !== "object") return base;

  const structure =
    raw.structure === "node" || raw.structure === "standard"
      ? raw.structure
      : fallbackStructure;

  const draft = emptyDraft(structure);
  for (const field of FLAT_FIELDS) {
    if (typeof raw[field] === "string") draft[field] = raw[field];
  }

  draft.hints = normalizeHints(raw.hints);
  draft.followUps = normalizeFollowUps(raw.followUps);

  for (const language of LANGUAGE_KEYS) {
    const source = raw.languages?.[language] ?? {};
    draft.languages[language] = {
      codeContent:
        typeof source.codeContent === "string" ? source.codeContent : "",
      codeBase64: typeof source.codeBase64 === "string" ? source.codeBase64 : "",
      solution: typeof source.solution === "string" ? source.solution : "",
      debugPre: typeof source.debugPre === "string" ? source.debugPre : "",
      debugPost: typeof source.debugPost === "string" ? source.debugPost : "",
    };
  }

  draft.updatedAt =
    typeof raw.updatedAt === "string" || typeof raw.updatedAt === "number"
      ? raw.updatedAt
      : null;

  return draft;
}

export function parseLuaToDraft(luaText, structure) {
  const text = typeof luaText === "string" ? luaText : "";
  const resolved = detectStructure(text, structure);
  const draft = emptyDraft(resolved);

  for (const field of FLAT_FIELDS) {
    draft[field] = parseSection(text, field);
  }

  draft.hints = parseAllHints(text);
  draft.followUps = parseAllFollowUps(text);

  for (const language of LANGUAGE_KEYS) {
    const debug = parseDebugParts(text, language);
    draft.languages[language] = {
      codeContent: parseSection(text, `CODE_CONTENT_${language}`),
      codeBase64: parseSection(text, `CODE_BASE64_${language}`),
      solution: parseSection(text, `SOLUTIONS_${language}`),
      debugPre: debug.debugPre,
      debugPost: debug.debugPost,
    };
  }

  return draft;
}

function assembleHints(hints) {
  const list = normalizeHints(hints);
  const blocks = list.map((value, position) => {
    const index = position + 1;
    return [
      `----------HINTS_START_${index}----------`,
      value,
      `----------HINTS_END_${index}----------`,
    ].join("\n");
  });
  return [
    marker("HINTS", "START"),
    "",
    blocks.join("\n\n"),
    "",
    marker("HINTS", "END"),
  ].join("\n");
}

function assembleFollowUps(followUps) {
  const list = normalizeFollowUps(followUps);
  const blocks = list.map((pair, position) => {
    const index = position + 1;
    return [
      `----------FOLLOW_UP_QUESTION_START_${index}----------`,
      "",
      wrapSection("QUESTION", pair.question ?? ""),
      "",
      wrapSection("ANSWER", pair.answer ?? ""),
      "",
      `----------FOLLOW_UP_QUESTION_END_${index}----------`,
    ].join("\n");
  });
  return [
    marker("FOLLOW_UP_QUESTIONS", "START"),
    "",
    blocks.join("\n\n"),
    "",
    marker("FOLLOW_UP_QUESTIONS", "END"),
  ].join("\n");
}

function assembleDebugHelper(language, languageDraft) {
  return [
    marker(`DEBUG_HELPER_CODE_${language}`, "START"),
    "",
    wrapSection("PRE_USER_CODE", languageDraft?.debugPre ?? ""),
    "",
    wrapSection("POST_USER_CODE", languageDraft?.debugPost ?? ""),
    "",
    marker(`DEBUG_HELPER_CODE_${language}`, "END"),
  ].join("\n");
}

function headerComment(structure) {
  if (structure === "node") {
    return [
      "-- Current node-based practice-question outline.",
      "-- Keep every marker unchanged. Put one company per line and use only",
      "-- EASY, MEDIUM, or HARD for QUESTION_LEVEL.",
      "-- NODE_H_CONTENT is required whenever C++ is enabled.",
      "",
    ].join("\n");
  }
  return [
    "-- Current standard practice-question outline.",
    "-- Keep every marker unchanged. Put one company per line and use only",
    "-- EASY, MEDIUM, or HARD for QUESTION_LEVEL.",
    "",
  ].join("\n");
}

export function assembleLua(draft) {
  const normalized = normalizeDraft(draft, draft?.structure ?? "standard");
  const languages = normalized.languages;
  const parts = [
    headerComment(normalized.structure),
    wrapSection("QUESTION_DESCRIPTION", normalized.QUESTION_DESCRIPTION),
    "",
    wrapSection("SHORT_TEXT", normalized.SHORT_TEXT),
    "",
    wrapSection("QUESTION_LEVEL", normalized.QUESTION_LEVEL),
    "",
    wrapSection("COMPANIES", normalized.COMPANIES),
    "",
    wrapSection("DEFAULT_TAGS", normalized.DEFAULT_TAGS),
    "",
    wrapSection("BEGINNER_TOPICS", normalized.BEGINNER_TOPICS),
    "",
    wrapSection("INTERMEDIATE_TOPICS", normalized.INTERMEDIATE_TOPICS),
    "",
    wrapSection("ADVANCED_TOPICS", normalized.ADVANCED_TOPICS),
    "",
    wrapSection("REAL_LIFE_EXAMPLES", normalized.REAL_LIFE_EXAMPLES),
    "",
    assembleFollowUps(normalized.followUps),
    "",
    assembleHints(normalized.hints),
    "",
  ];

  for (const language of LANGUAGE_KEYS) {
    parts.push(
      wrapSection(`CODE_CONTENT_${language}`, languages[language].codeContent),
      "",
    );
  }

  for (const language of DEBUG_LANGUAGES) {
    parts.push(assembleDebugHelper(language, languages[language]), "");
  }

  parts.push(
    wrapSection("CODE_BASE64_CPP", languages.CPP.codeBase64),
    "",
  );

  if (normalized.structure === "node") {
    parts.push(wrapSection("NODE_H_CONTENT", normalized.NODE_H_CONTENT), "");
  }

  for (const language of ["PYTHON", "JAVA", "NODE_JS"]) {
    parts.push(
      wrapSection(`CODE_BASE64_${language}`, languages[language].codeBase64),
      "",
    );
  }

  for (const language of LANGUAGE_KEYS) {
    parts.push(
      wrapSection(`SOLUTIONS_${language}`, languages[language].solution),
      "",
    );
  }

  return `${parts.join("\n").replace(/\n+$/, "")}\n`;
}

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadDraft() {
  const store = storage();
  if (!store) return emptyDraft("standard");
  try {
    const raw = store.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return emptyDraft("standard");
    return normalizeDraft(JSON.parse(raw), "standard");
  } catch {
    return emptyDraft("standard");
  }
}

export function saveDraft(draft) {
  const normalized = normalizeDraft(draft, draft?.structure ?? "standard");
  normalized.updatedAt = new Date().toISOString();
  const store = storage();
  if (store) {
    store.setItem(DRAFT_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function clearDraft() {
  const store = storage();
  if (store) store.removeItem(DRAFT_STORAGE_KEY);
  return emptyDraft("standard");
}

export function createDebouncedSave(saveFn, delayMs = DRAFT_SAVE_DELAY_MS) {
  let timer = null;
  const run = (draft) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      saveFn(draft);
    }, delayMs);
  };
  run.flush = (draft) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    return saveFn(draft);
  };
  run.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return run;
}
