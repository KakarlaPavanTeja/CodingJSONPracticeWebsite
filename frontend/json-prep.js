const LANGUAGES = {
  cpp: {
    platform: "CPP",
    code: "CPP",
    solution: "CPP",
    repository: "CPP",
    execute: "main.cpp",
    submit: "solution.cpp",
    seconds: 1,
  },
  python: {
    platform: "PYTHON",
    code: "PYTHON",
    solution: "PYTHON",
    repository: "PYTHON",
    execute: "main.py",
    submit: "solution.py",
    seconds: 4,
  },
  java: {
    platform: "JAVA",
    code: "JAVA",
    solution: "JAVA",
    repository: "JAVA",
    execute: "Main.java",
    submit: "Solution.java",
    seconds: 2,
  },
  nodejs: {
    platform: "NODE_JS",
    code: "NODE_JS",
    solution: "NODE_JS",
    repository: "NODE_JS",
    execute: "Main.js",
    submit: "Solution.js",
    seconds: 2,
  },
};

const LANGUAGE_ORDER = ["cpp", "python", "java", "nodejs"];

const NON_FUNCTION_DEFAULTS = {
  CPP: "#include<bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your code here...\n    return 0;\n}",
  PYTHON: "# write your code here...",
  JAVA: 'class Main {\n    public static void main(String[] args) {\n        // write your code here...\n        System.out.println("");\n    }\n}',
  NODE_JS:
    "const fs = require('fs');\n\nfunction main() {\n    // Write your code here...\n    console.log(\"Hello, World!\");\n}\n\nmain();",
};

export class PreparationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = "PreparationError";
    this.issues = issues;
  }
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : 0x8 | (random & 0x3);
    return value.toString(16);
  });
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function serializePracticeJson(data) {
  return JSON.stringify(data, null, 2).replace(
    /("time_limit_to_execute_in_seconds": )(-?\d+)(?=,?\n)/g,
    "$1$2.0",
  );
}

function marker(name, boundary) {
  return `----------${name}_${boundary}----------`;
}

export function parseSection(content, name) {
  if (typeof content !== "string") return "";
  const start = marker(name, "START");
  const end = marker(name, "END");
  const startIndex = content.indexOf(start);
  if (startIndex < 0) return "";
  const valueStart = startIndex + start.length;
  const endIndex = content.indexOf(end, valueStart);
  if (endIndex < 0) return "";
  return content.slice(valueStart, endIndex).trim();
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitCompanies(value) {
  if (!value) return [];
  const legalSuffix = /^(inc\.?|incorporated|ltd\.?|llc|corp\.?|corporation|co\.?)$/i;
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const companies = [];
      for (const part of line.split(",").map((item) => item.trim()).filter(Boolean)) {
        if (legalSuffix.test(part) && companies.length > 0) {
          companies[companies.length - 1] += `, ${part}`;
        } else {
          companies.push(part);
        }
      }
      return companies;
    });
}

function displayName(tag) {
  return tag
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeTags(rawTags) {
  if (!Array.isArray(rawTags)) return [];
  if (
    rawTags.some(
      (item) =>
        !(
          (typeof item === "string" && item.trim()) ||
          (item &&
            typeof item === "object" &&
            typeof item.name_enum === "string" &&
            item.name_enum.trim())
        ),
    )
  ) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  for (const item of rawTags) {
    const name =
      typeof item === "string"
        ? item.trim()
        : typeof item?.name_enum === "string"
          ? item.name_enum.trim()
          : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    normalized.push({
      name_enum: name,
      display_name:
        typeof item === "object" && String(item?.display_name ?? "").trim()
          ? String(item.display_name).trim()
          : displayName(name),
    });
  }
  return normalized;
}

function unwrapTestcases(data) {
  if (Array.isArray(data) && data.length !== 1) {
    throw new PreparationError(
      "Testcase JSON array root must contain exactly one object.",
    );
  }
  const container = Array.isArray(data) ? data[0] : data;
  if (!container || typeof container !== "object" || !Array.isArray(container.test_cases)) {
    throw new PreparationError(
      'Testcase JSON must be {"test_cases": [...]} or [{"test_cases": [...]}].',
    );
  }
  if (container.test_cases.length === 0) {
    throw new PreparationError("Testcase JSON must contain at least one test case.");
  }
  return container.test_cases;
}

function testcaseSignature(testcase) {
  const multiple = testcase.multiple_possible_output === true;
  const outputs = multiple
    ? JSON.stringify(testcase.outputs ?? [])
    : String(testcase.output ?? "");
  return `${String(testcase.input ?? "")}\u0000${
    multiple ? "multiple" : "single"
  }\u0000${outputs}`;
}

function existingIdQueues(existingTestCases) {
  const queues = new Map();
  for (const testcase of existingTestCases ?? []) {
    if (!testcase?.id) continue;
    const signature = testcaseSignature(testcase);
    if (!queues.has(signature)) queues.set(signature, []);
    queues.get(signature).push(testcase.id);
  }
  return queues;
}

export function normalizeTestCases(data, existingTestCases = []) {
  const source = unwrapTestcases(data);
  const warnings = [];
  const queues = existingIdQueues(existingTestCases);
  const reservationQueues = existingIdQueues(existingTestCases);
  const reservedIds = new Set();
  for (const testcase of source) {
    if (!testcase || typeof testcase !== "object") continue;
    const reservedId = reservationQueues.get(testcaseSignature(testcase))?.shift();
    if (reservedId) reservedIds.add(reservedId);
  }
  const usedIds = new Set();
  const testCases = source.map((testcase, index) => {
    if (!testcase || typeof testcase !== "object") {
      throw new PreparationError(`Test case ${index + 1} must be an object.`);
    }
    if (typeof testcase.input !== "string" || !testcase.input.trim()) {
      throw new PreparationError(`Test case ${index + 1} requires a non-empty string input.`);
    }

    const weightage = testcase.weightage;
    if (
      typeof weightage !== "number" ||
      !Number.isFinite(weightage) ||
      weightage <= 0
    ) {
      throw new PreparationError(
        `Test case ${index + 1} weightage must be a positive finite number.`,
      );
    }

    const multiple = testcase.multiple_possible_output === true;
    let output = null;
    let outputs;
    if (multiple) {
      if (
        !Array.isArray(testcase.outputs) ||
        testcase.outputs.length === 0 ||
        testcase.outputs.some((item) => typeof item !== "string" || !item.trim())
      ) {
        throw new PreparationError(
          `Test case ${index + 1} requires non-empty string outputs.`,
        );
      }
      outputs = [...testcase.outputs];
    } else {
      if (typeof testcase.output !== "string" || !testcase.output.trim()) {
        throw new PreparationError(
          `Test case ${index + 1} requires a non-empty string output.`,
        );
      }
      output = testcase.output;
    }

    const expectedOrder = index + 1;
    if (Number(testcase.order) !== expectedOrder) {
      warnings.push(
        `Test case ${index + 1} order was normalized to ${expectedOrder}.`,
      );
    }

    const tags = normalizeTags(testcase.tags);
    if (tags.length === 0) {
      throw new PreparationError(
        `Test case ${index + 1} requires at least one valid tag.`,
      );
    }

    const signature = testcaseSignature({ ...testcase, output, outputs });
    const queue = queues.get(signature) ?? [];
    let id = queue.shift();
    if (!id) {
      const orderMatch = existingTestCases.find(
        (candidate) =>
          Number(candidate?.order) === expectedOrder &&
          candidate?.id &&
          !usedIds.has(candidate.id) &&
          !reservedIds.has(candidate.id),
      );
      id = orderMatch?.id;
    }
    if (!id || usedIds.has(id)) id = uuid();
    usedIds.add(id);

    const normalized = {
      id,
      input: testcase.input,
      output,
      is_hidden: expectedOrder > 2,
      weightage,
      evaluation_type: "DEFAULT",
      display_text: null,
      criteria: null,
      tags,
      order: expectedOrder,
    };
    if (multiple) {
      normalized.multiple_possible_output = true;
      normalized.outputs = outputs;
    }
    return normalized;
  });

  return { testCases, warnings };
}

function indexedSections(content, outerName, itemPrefix) {
  const outer = parseSection(content, outerName);
  if (!outer) return [];
  const expression = new RegExp(
    `----------${itemPrefix}_START_(\\d+)----------`,
    "g",
  );
  const indexes = [
    ...new Set([...outer.matchAll(expression)].map((match) => Number(match[1]))),
  ].sort((left, right) => left - right);
  return indexes
    .map((index) => ({
      index,
      content: (() => {
        const start = `----------${itemPrefix}_START_${index}----------`;
        const end = `----------${itemPrefix}_END_${index}----------`;
        const startIndex = outer.indexOf(start);
        if (startIndex < 0) return "";
        const valueStart = startIndex + start.length;
        const endIndex = outer.indexOf(end, valueStart);
        return endIndex < 0 ? "" : outer.slice(valueStart, endIndex).trim();
      })(),
    }))
    .filter((item) => item.content);
}

function parseHints(luaContent) {
  return indexedSections(luaContent, "HINTS", "HINTS").map((item, position) => ({
    duration_to_unlock_hint_in_seconds: 0,
    order: position + 1,
    title: { content: `Hint ${position + 1}`, content_type: "TEXT" },
    description: { content: item.content, content_type: "MARKDOWN" },
  }));
}

function parseFollowups(luaContent) {
  return indexedSections(
    luaContent,
    "FOLLOW_UP_QUESTIONS",
    "FOLLOW_UP_QUESTION",
  )
    .map(({ content }) => {
      const title = parseSection(content, "QUESTION");
      const answer = parseSection(content, "ANSWER");
      if (!title || !answer) return null;
      return {
        title,
        content: { content_type: "MARKDOWN", content: answer },
      };
    })
    .filter(Boolean);
}

function parseDebugHelper(luaContent, platformLanguage) {
  const section = parseSection(luaContent, `DEBUG_HELPER_CODE_${platformLanguage}`);
  if (!section) return null;
  const preUserCode = parseSection(section, "PRE_USER_CODE");
  const postUserCode = parseSection(section, "POST_USER_CODE");
  if (!preUserCode && !postUserCode) return null;
  return JSON.stringify(
    { pre_user_code: preUserCode, post_user_code: postUserCode },
    null,
    2,
  );
}

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function orderedLanguages(enabledLanguages) {
  const selected = new Set(enabledLanguages ?? []);
  return LANGUAGE_ORDER.filter((language) => selected.has(language));
}

function existingSharedId(items, nested = false) {
  if (!Array.isArray(items)) return null;
  if (nested) {
    for (const item of items) {
      const id = item?.code_details?.find((detail) => detail?.code_id)?.code_id;
      if (id) return id;
    }
    return null;
  }
  return items.find((item) => item?.code_id)?.code_id ?? null;
}

function buildLanguages({
  luaContent,
  enabledLanguages,
  questionKind,
  existingQuestion,
}) {
  const nonFunction = questionKind === "nonfunction";
  const languages = orderedLanguages(enabledLanguages);
  const codeId =
    existingSharedId(existingQuestion?.coding_question_details) ?? uuid();
  const solutionId = existingSharedId(existingQuestion?.solutions, true) ?? uuid();

  const available = languages.filter((language) => {
    const config = LANGUAGES[language];
    const code = parseSection(luaContent, `CODE_CONTENT_${config.code}`);
    return nonFunction || Boolean(code);
  });
  if (available.length === 0) {
    throw new PreparationError(
      "None of the selected languages have code content in the Lua file.",
    );
  }
  const defaultLanguage = available[0];
  const codingDetails = available.map((language) => {
    const config = LANGUAGES[language];
    return {
      code_content:
        (nonFunction ? NON_FUNCTION_DEFAULTS[config.platform] : "") ||
        parseSection(luaContent, `CODE_CONTENT_${config.code}`),
      default_code: language === defaultLanguage,
      language: config.platform,
      code_id: codeId,
      is_function_based: !nonFunction,
      debug_helper_code: nonFunction
        ? null
        : parseDebugHelper(luaContent, config.platform),
    };
  });

  const repositories = [];
  if (!nonFunction) {
    for (const language of available) {
      const config = LANGUAGES[language];
      const repositoryContent = parseSection(
        luaContent,
        `CODE_BASE64_${config.repository}`,
      );
      if (!repositoryContent) continue;
      repositories.push({
        language: config.platform,
        file_path_to_execute: config.execute,
        default_file_path_to_submit_code: config.submit,
        code_repository: [
          {
            file_name: config.execute,
            file_type: "FILE",
            file_content: utf8ToBase64(repositoryContent),
          },
        ],
      });
    }
  }

  const solutionDetails = [];
  if (!nonFunction) {
    for (const language of available) {
      const config = LANGUAGES[language];
      const content = parseSection(luaContent, `SOLUTIONS_${config.solution}`);
      if (!content) continue;
      solutionDetails.push({
        code_id: solutionId,
        code_content: content,
        language: config.platform,
        default_code: false,
      });
    }
    if (solutionDetails.length > 0) solutionDetails[0].default_code = true;
  }

  const solutions =
    solutionDetails.length === 0
      ? []
      : [
          {
            order: 1,
            title: { content: "Code", content_type: "TEXT" },
            description: { content: "", content_type: "" },
            code_details: solutionDetails,
            complexity_analysis: { content: "", content_type: "" },
          },
        ];

  const metrics = available.map((language) => ({
    language: LANGUAGES[language].platform,
    time_limit_to_execute_in_seconds: LANGUAGES[language].seconds,
  }));

  return {
    available,
    codingDetails,
    repositories,
    solutions,
    metrics,
  };
}

function parseExisting(existingJson) {
  if (
    !Array.isArray(existingJson) ||
    existingJson.length !== 1 ||
    !existingJson[0] ||
    typeof existingJson[0] !== "object"
  ) {
    throw new PreparationError(
      "Existing JSON must be an array containing exactly one coding question object.",
    );
  }
  const output = existingJson[0];
  if (
    !output.question ||
    typeof output.question !== "object" ||
    Array.isArray(output.question)
  ) {
    throw new PreparationError("Existing JSON question must be an object.");
  }
  for (const key of [
    "test_cases",
    "coding_question_details",
    "language_code_repository_details",
    "solutions",
  ]) {
    if (output[key] !== undefined && !Array.isArray(output[key])) {
      throw new PreparationError(`Existing JSON ${key} must be an array.`);
    }
  }
  for (const solution of output.solutions ?? []) {
    if (
      !solution ||
      typeof solution !== "object" ||
      (solution.code_details !== undefined && !Array.isArray(solution.code_details))
    ) {
      throw new PreparationError(
        "Existing JSON solution code_details must be an array.",
      );
    }
  }
  return output;
}

export function validatePreparation(input) {
  const errors = [];
  const warnings = [];
  if (!["create", "update"].includes(input.mode)) {
    errors.push("Choose Create or Update mode.");
  }
  if (!["standard", "node"].includes(input.structure)) {
    errors.push("Choose Standard or Node-Based structure.");
  }
  if (!["function", "nonfunction"].includes(input.questionKind)) {
    errors.push("Choose Function or Non-function question kind.");
  }
  if (!Array.isArray(input.enabledLanguages) || input.enabledLanguages.length === 0) {
    errors.push("Select at least one language.");
  }
  if (typeof input.luaContent !== "string" || !input.luaContent.trim()) {
    errors.push("Upload a Lua preparation file.");
  } else {
    for (const required of [
      "QUESTION_DESCRIPTION",
      "SHORT_TEXT",
      "QUESTION_LEVEL",
    ]) {
      if (!parseSection(input.luaContent, required)) {
        errors.push(`Lua file is missing ${required}.`);
      }
    }
    const difficulty = parseSection(input.luaContent, "QUESTION_LEVEL").toUpperCase();
    if (difficulty && !["EASY", "MEDIUM", "HARD"].includes(difficulty)) {
      warnings.push("Invalid difficulty will fall back to the existing value or EASY.");
    }
    for (const language of input.enabledLanguages ?? []) {
      const config = LANGUAGES[language];
      if (!config) {
        errors.push(`Unsupported language selection: ${language}.`);
        continue;
      }
      if (input.questionKind !== "function") continue;
      if (!parseSection(input.luaContent, `CODE_CONTENT_${config.code}`)) {
        errors.push(`Selected ${config.platform} language is missing CODE_CONTENT.`);
      }
      if (!parseSection(input.luaContent, `CODE_BASE64_${config.repository}`)) {
        errors.push(`Selected ${config.platform} language is missing CODE_BASE64.`);
      }
      if (!parseSection(input.luaContent, `SOLUTIONS_${config.solution}`)) {
        warnings.push(`Selected ${config.platform} language has no solution section.`);
      }
    }
    if (
      input.structure === "node" &&
      input.enabledLanguages?.includes("cpp") &&
      !parseSection(input.luaContent, "NODE_H_CONTENT")
    ) {
      errors.push("Node-Based preparation with C++ requires NODE_H_CONTENT.");
    }
  }
  if (!input.testcasesData) {
    errors.push("Upload testcase JSON.");
  } else {
    try {
      const result = normalizeTestCases(
        input.testcasesData,
        input.mode === "update" && input.existingJson
          ? parseExisting(input.existingJson).test_cases
          : [],
      );
      warnings.push(...result.warnings);
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (input.mode === "update") {
    if (!input.existingJson) {
      errors.push("Upload the existing coding_questions.json for Update mode.");
    } else {
      try {
        parseExisting(input.existingJson);
      } catch (error) {
        errors.push(error.message);
      }
    }
  }
  const uniqueErrors = [...new Set(errors)];
  const uniqueWarnings = [...new Set(warnings)];
  return {
    errors: uniqueErrors,
    warnings: uniqueWarnings,
    canGenerate: uniqueErrors.length === 0,
  };
}

export function buildPracticeJson(input) {
  const report = validatePreparation(input);
  if (!report.canGenerate) {
    throw new PreparationError(
      `Preparation failed: ${report.errors.join(" ")}`,
      report.errors,
    );
  }

  const existingQuestion =
    input.mode === "update" ? parseExisting(input.existingJson) : null;
  const normalized = normalizeTestCases(
    input.testcasesData,
    existingQuestion?.test_cases ?? [],
  );
  const testCases = normalized.testCases;
  const totalScore = Number(
    testCases.reduce((sum, testcase) => sum + testcase.weightage, 0).toFixed(2),
  );
  const languageData = buildLanguages({
    luaContent: input.luaContent,
    enabledLanguages: input.enabledLanguages,
    questionKind: input.questionKind,
    existingQuestion,
  });

  if (input.structure === "node" && languageData.available.includes("cpp")) {
    const nodeHeader = parseSection(input.luaContent, "NODE_H_CONTENT");
    if (!nodeHeader) {
      throw new PreparationError(
        "Node-Based preparation with C++ requires NODE_H_CONTENT.",
      );
    }
    const cppRepository = languageData.repositories.find(
      (repository) => repository.language === "CPP",
    );
    if (!cppRepository) {
      throw new PreparationError(
        "Node-Based preparation with C++ requires a CPP repository section.",
      );
    }
    cppRepository.code_repository.push({
      file_name: "node.h",
      file_type: "FILE",
      file_content: utf8ToBase64(nodeHeader),
    });
  }

  const beginner = splitList(parseSection(input.luaContent, "BEGINNER_TOPICS"));
  const intermediate = splitList(
    parseSection(input.luaContent, "INTERMEDIATE_TOPICS"),
  );
  const advanced = splitList(parseSection(input.luaContent, "ADVANCED_TOPICS"));
  const topics = [...beginner, ...intermediate, ...advanced];
  const metadata = JSON.stringify(
    {
      real_life_example: parseSection(input.luaContent, "REAL_LIFE_EXAMPLES"),
      follow_up_questions: parseFollowups(input.luaContent),
      topics,
    },
    null,
    2,
  );
  const rawDifficulty = parseSection(input.luaContent, "QUESTION_LEVEL").toUpperCase();
  const difficulty = ["EASY", "MEDIUM", "HARD"].includes(rawDifficulty)
    ? rawDifficulty
    : existingQuestion?.question?.difficulty ?? "EASY";

  const output = existingQuestion ? clone(existingQuestion) : {};
  output.test_cases = testCases;
  output.total_score = totalScore;
  output.question_type = "CODING";
  output.question_asked_by_companies_info = splitCompanies(
    parseSection(input.luaContent, "COMPANIES"),
  ).map((company) => ({ company_name: company.toUpperCase() }));
  output.question = {
    ...(existingQuestion?.question ?? {}),
    difficulty,
    content: parseSection(input.luaContent, "QUESTION_DESCRIPTION"),
    short_text: parseSection(input.luaContent, "SHORT_TEXT"),
    multimedia: existingQuestion?.question?.multimedia ?? [],
    language: "ENGLISH",
    content_type: "MARKDOWN",
    question_id: existingQuestion?.question?.question_id ?? uuid(),
    default_tag_names: splitList(parseSection(input.luaContent, "DEFAULT_TAGS")),
    concept_tag_names: existingQuestion?.question?.concept_tag_names ?? [],
    concept_filter_tag_names: topics,
    topic_tag_names: {
      beginner_tag_names: beginner,
      intermediate_tag_names: intermediate,
      advanced_tag_names: advanced,
    },
    metadata,
  };
  output.coding_question_details = languageData.codingDetails;
  output.code_repository_details = null;
  output.language_code_repository_details = languageData.repositories;
  output.solutions = languageData.solutions;
  output.hints = parseHints(input.luaContent);
  output.test_case_evaluation_metrics = languageData.metrics;

  const previousCount = existingQuestion?.test_cases?.length ?? 0;
  const preservedIds = existingQuestion
    ? testCases.filter((testcase) =>
        existingQuestion.test_cases?.some((old) => old.id === testcase.id),
      ).length
    : 0;
  return {
    data: [output],
    warnings: [...report.warnings, ...normalized.warnings],
    summary: {
      mode: input.mode,
      structure: input.structure,
      questionKind: input.questionKind,
      difficulty,
      languages: languageData.codingDetails.map((detail) => detail.language),
      testcaseCount: testCases.length,
      publicCount: Math.min(2, testCases.length),
      hiddenCount: Math.max(0, testCases.length - 2),
      totalScore,
      tagCount: new Set(
        testCases.flatMap((testcase) =>
          testcase.tags.map((tag) => tag.name_enum),
        ),
      ).size,
      hintCount: output.hints.length,
      followupCount: JSON.parse(metadata).follow_up_questions.length,
      questionId: output.question.question_id,
    },
    changes: {
      previousTestcaseCount: previousCount,
      testcaseCount: testCases.length,
      added: Math.max(0, testCases.length - previousCount),
      removed: Math.max(0, previousCount - testCases.length),
      preservedTestcaseIds: preservedIds,
      questionIdPreserved: Boolean(existingQuestion?.question?.question_id),
      legacyFieldsRetained: existingQuestion
        ? Object.keys(existingQuestion).filter(
            (key) =>
              ![
                "test_cases",
                "total_score",
                "question_type",
                "question_asked_by_companies_info",
                "question",
                "coding_question_details",
                "code_repository_details",
                "language_code_repository_details",
                "solutions",
                "hints",
                "test_case_evaluation_metrics",
              ].includes(key),
          )
        : [],
    },
  };
}

export function regenerateIds(source) {
  parseExisting(source);
  const result = clone(source);
  const output = result[0];
  output.question.question_id = uuid();
  const codeId = uuid();
  for (const detail of output.coding_question_details ?? []) {
    detail.code_id = codeId;
  }
  const solutionId = uuid();
  for (const solution of output.solutions ?? []) {
    for (const detail of solution.code_details ?? []) {
      detail.code_id = solutionId;
    }
  }
  for (const testcase of output.test_cases ?? []) {
    testcase.id = uuid();
  }
  return result;
}
