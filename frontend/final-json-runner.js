import { DEFAULT_TIME_LIMITS } from "./execute-runner.js";

export const MAX_FINAL_JSON_BYTES = 100 * 1024 * 1024;

const MAX_TESTCASES = 200;
const MAX_REPOSITORY_FILES = 32;
const MAX_PACKAGE_BYTES = 1024 * 1024;

const LANGUAGE_CONFIG = [
  { platform: "CPP", language: "cpp", label: "C++" },
  { platform: "PYTHON", language: "python", label: "Python" },
  { platform: "JAVA", language: "java", label: "Java" },
];

function fail(message) {
  throw new Error(message);
}

function parseRoot(raw) {
  if (
    !Array.isArray(raw) ||
    raw.length !== 1 ||
    !raw[0] ||
    typeof raw[0] !== "object" ||
    Array.isArray(raw[0])
  ) {
    fail(
      "Final JSON must be an array containing exactly one coding question object.",
    );
  }
  return raw[0];
}

function parseTestcases(question) {
  if (!Array.isArray(question.test_cases) || question.test_cases.length === 0) {
    fail("Final JSON must contain a non-empty test_cases array.");
  }
  if (question.test_cases.length > MAX_TESTCASES) {
    fail(`Final JSON can contain at most ${MAX_TESTCASES} testcases.`);
  }

  const ids = new Set();
  return question.test_cases.map((testcase, index) => {
    if (!testcase || typeof testcase !== "object" || Array.isArray(testcase)) {
      fail(`Testcase ${index + 1} must be an object.`);
    }
    const id = String(testcase.id || `tc-${index + 1}`);
    if (ids.has(id)) fail("Testcase ids must be unique.");
    ids.add(id);

    if (typeof testcase.input !== "string") {
      fail(`Testcase ${index + 1} input must be a string.`);
    }
    const multiple = testcase.multiple_possible_output === true;
    if (multiple) {
      if (
        !Array.isArray(testcase.outputs) ||
        testcase.outputs.length === 0 ||
        testcase.outputs.some((output) => typeof output !== "string")
      ) {
        fail(
          `Testcase ${index + 1} must provide non-empty string outputs when multiple outputs are enabled.`,
        );
      }
    } else if (typeof testcase.output !== "string") {
      fail(`Testcase ${index + 1} output must be a string.`);
    }

    return {
      id,
      order: Number(testcase.order) || index + 1,
      input: testcase.input,
      output: typeof testcase.output === "string" ? testcase.output : "",
      multiple_possible_output: multiple,
      outputs: multiple ? [...testcase.outputs] : [],
    };
  });
}

function solutionDetails(question) {
  if (!Array.isArray(question.solutions)) return [];
  return question.solutions.flatMap((solution) =>
    Array.isArray(solution?.code_details) ? solution.code_details : [],
  );
}

function validateBase64(value, description) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${description} is missing base64 file content.`);
  }
  const compact = value.replace(/\s+/g, "");
  const valid =
    compact.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      compact,
    );
  if (!valid) fail(`${description} contains invalid base64.`);
  return compact;
}

function safeRelativePath(value, description) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${description} must be a safe relative path.`);
  }
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    /[\u0000-\u001f\u007f]/.test(normalized) ||
    normalized.length > 240 ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    fail(`${description} must be a safe relative path.`);
  }
  return normalized;
}

function textBytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function platformsIn(question) {
  const platforms = new Set();
  for (const detail of question.coding_question_details ?? []) {
    if (detail?.language) platforms.add(String(detail.language).toUpperCase());
  }
  for (const repository of question.language_code_repository_details ?? []) {
    if (repository?.language) {
      platforms.add(String(repository.language).toUpperCase());
    }
  }
  for (const detail of solutionDetails(question)) {
    if (detail?.language) platforms.add(String(detail.language).toUpperCase());
  }
  return platforms;
}

function packageForLanguage(question, config) {
  const details = Array.isArray(question.coding_question_details)
    ? question.coding_question_details
    : [];
  const detail = details.find(
    (item) => String(item?.language).toUpperCase() === config.platform,
  );
  if (!detail) fail("Coding question details are missing.");
  if (detail.is_function_based !== true) {
    fail(
      "Non-function final JSON does not include a runnable reference package.",
    );
  }

  const repositories = Array.isArray(
    question.language_code_repository_details,
  )
    ? question.language_code_repository_details
    : [];
  const repository = repositories.find(
    (item) => String(item?.language).toUpperCase() === config.platform,
  );
  if (!repository) fail("Code repository is missing.");
  if (!Array.isArray(repository.code_repository)) {
    fail("Repository code_repository must be an array.");
  }
  if (repository.code_repository.length > MAX_REPOSITORY_FILES) {
    fail(`Repository can contain at most ${MAX_REPOSITORY_FILES} files.`);
  }

  const mainFilePath = safeRelativePath(
    repository.file_path_to_execute,
    "Repository file_path_to_execute",
  );
  const submitFilePath = safeRelativePath(
    repository.default_file_path_to_submit_code,
    "Repository default_file_path_to_submit_code",
  );
  if (mainFilePath === submitFilePath) {
    fail("Repository execute and submit paths must be different.");
  }

  const files = [];
  const paths = new Set();
  let packageBytes = 0;
  for (const [index, file] of repository.code_repository.entries()) {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      fail(`Repository file ${index + 1} must be an object.`);
    }
    if (file.file_type && file.file_type !== "FILE") {
      fail(`Repository file ${index + 1} must have file_type FILE.`);
    }
    const filePath = safeRelativePath(
      file.file_name,
      `Repository file ${index + 1} name`,
    );
    if (paths.has(filePath)) fail("Repository file paths must be unique.");
    paths.add(filePath);
    const contents = validateBase64(
      file.file_content,
      `${config.label} repository file ${filePath}`,
    );
    packageBytes += Math.ceil((contents.length * 3) / 4);
    files.push({
      file_path: filePath,
      file_contents: contents,
      base64_encoded: true,
    });
  }
  if (!paths.has(mainFilePath)) {
    fail(`Repository is missing executable file ${mainFilePath}.`);
  }

  const existingSubmitIndex = files.findIndex(
    (file) => file.file_path === submitFilePath,
  );
  if (existingSubmitIndex !== -1) {
    // Keep harness/helpers only; the submit path is filled at run time from
    // the packaged solution or the user's textarea.
    files.splice(existingSubmitIndex, 1);
  }

  const rawSolution = solutionDetails(question).find(
    (item) => String(item?.language).toUpperCase() === config.platform,
  )?.code_content;
  const solution =
    typeof rawSolution === "string" && rawSolution.trim() ? rawSolution : "";
  const hasSolution = solution.length > 0;
  if (hasSolution) packageBytes += textBytes(solution);

  const hasNodeHeader =
    config.platform === "CPP" &&
    [...paths].some((filePath) => filePath.split("/").at(-1) === "node.h");

  const metric = Array.isArray(question.test_case_evaluation_metrics)
    ? question.test_case_evaluation_metrics.find(
        (item) => String(item?.language).toUpperCase() === config.platform,
      )
    : null;
  const requestedLimit = Number(metric?.time_limit_to_execute_in_seconds);
  const timeLimit =
    Number.isFinite(requestedLimit) &&
    requestedLimit >= 0.1 &&
    requestedLimit <= 30
      ? requestedLimit
      : DEFAULT_TIME_LIMITS[config.language];

  if (packageBytes > MAX_PACKAGE_BYTES) {
    fail("Code package exceeds the 1 MiB decoded-size limit.");
  }

  return {
    platform: config.platform,
    language: config.language,
    label: config.label,
    questionKind: "function",
    structure: hasNodeHeader ? "node" : "standard",
    timeLimit,
    mainFilePath,
    submitFilePath,
    solution,
    hasSolution,
    files,
  };
}

export function filesWithSolution(packageData, solutionText) {
  const solution = String(solutionText ?? "");
  if (!solution.trim()) {
    fail("Paste a reference solution before running this language.");
  }
  const packageBytes =
    packageData.files.reduce((total, file) => {
      if (file.base64_encoded) {
        return total + Math.ceil((String(file.file_contents).length * 3) / 4);
      }
      return total + textBytes(file.file_contents);
    }, 0) + textBytes(solution);
  if (packageBytes > MAX_PACKAGE_BYTES) {
    fail("Code package exceeds the 1 MiB decoded-size limit.");
  }
  return [
    ...packageData.files.map((file) => ({ ...file })),
    {
      file_path: packageData.submitFilePath,
      file_contents: solution,
      base64_encoded: false,
    },
  ];
}

export function parseFinalCodingQuestion(raw) {
  const root = parseRoot(raw);
  if (
    !root.question ||
    typeof root.question !== "object" ||
    Array.isArray(root.question)
  ) {
    fail("Final JSON question must be an object.");
  }
  for (const key of [
    "coding_question_details",
    "language_code_repository_details",
    "solutions",
    "test_case_evaluation_metrics",
  ]) {
    if (root[key] !== undefined && !Array.isArray(root[key])) {
      fail(`Final JSON ${key} must be an array.`);
    }
  }

  const testcases = parseTestcases(root);
  const present = platformsIn(root);
  const packages = [];
  const unavailable = [];

  for (const config of LANGUAGE_CONFIG) {
    if (!present.has(config.platform)) continue;
    try {
      packages.push(packageForLanguage(root, config));
    } catch (error) {
      unavailable.push({
        platform: config.platform,
        label: config.label,
        reason: error.message,
      });
    }
  }
  if (present.has("NODE_JS")) {
    unavailable.push({
      platform: "NODE_JS",
      label: "Node.js",
      reason: "Node.js execution is not supported by this compiler runner.",
    });
  }

  return {
    question: {
      id: String(root.question.question_id || "final-json"),
      shortText:
        typeof root.question.short_text === "string"
          ? root.question.short_text
          : "Coding question",
      difficulty:
        typeof root.question.difficulty === "string"
          ? root.question.difficulty
          : "",
    },
    testcases,
    packages,
    unavailable,
  };
}
