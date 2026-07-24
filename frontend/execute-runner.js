/**
 * Client-side execution helpers: Lua draft -> compiler files, poll, result rows.
 * Talks only to same-origin /api/* (never embeds compiler hosts).
 */

export const EXECUTABLE_LANGUAGES = ["cpp", "python", "java"];

export const DEFAULT_TIME_LIMITS = {
  cpp: 1,
  python: 4,
  java: 2,
};

const LANG_FILE = {
  cpp: {
    main: "main.cpp",
    solution: "solution.cpp",
    draftKey: "CPP",
  },
  python: {
    main: "main.py",
    solution: "solution.py",
    draftKey: "PYTHON",
  },
  java: {
    main: "Main.java",
    solution: "Solution.java",
    draftKey: "JAVA",
  },
};

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 120;
const TERMINAL = new Set(["SUCCESS", "FAILED", "NOT_FOUND", "ERROR", "TIMEOUT"]);

export function unwrapTestcasesRoot(data) {
  if (Array.isArray(data)) {
    if (data.length !== 1 || !data[0] || typeof data[0] !== "object") {
      throw new Error(
        "Testcase JSON array root must contain exactly one object.",
      );
    }
    return data[0];
  }
  if (!data || typeof data !== "object") {
    throw new Error("Testcase JSON must be an object or a one-element array.");
  }
  return data;
}

export function extractTestCases(data) {
  const root = unwrapTestcasesRoot(data);
  const list = root.test_cases || root.testcases;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("Testcase JSON must contain a non-empty test_cases array.");
  }
  return list.map((tc, index) => ({
    id: tc.id || `tc-${index + 1}`,
    order: Number(tc.order) || index + 1,
    input: tc.input ?? "",
    output: tc.output ?? "",
    multiple_possible_output: tc.multiple_possible_output === true,
    outputs: Array.isArray(tc.outputs) ? tc.outputs : [],
    tags: Array.isArray(tc.tags) ? tc.tags : [],
    weightage: tc.weightage,
  }));
}

export function buildLanguageFiles({
  language,
  questionKind = "function",
  structure = "standard",
  harness = "",
  solution = "",
  nodeH = "",
}) {
  const config = LANG_FILE[language];
  if (!config) throw new Error(`Unsupported language: ${language}`);

  if (questionKind === "nonfunction") {
    return {
      mainFilePath: config.main,
      files: [
        {
          file_path: config.main,
          file_contents: solution || "",
          base64_encoded: false,
        },
      ],
    };
  }

  const files = [
    {
      file_path: config.main,
      file_contents: harness || "",
      base64_encoded: false,
    },
    {
      file_path: config.solution,
      file_contents: solution || "",
      base64_encoded: false,
    },
  ];
  if (language === "cpp" && structure === "node" && nodeH) {
    files.push({
      file_path: "node.h",
      file_contents: nodeH,
      base64_encoded: false,
    });
  }
  return { mainFilePath: config.main, files };
}

export function buffersFromDraft(draft, language) {
  const config = LANG_FILE[language];
  if (!config) return { harness: "", solution: "", nodeH: "" };
  const lang = draft?.languages?.[config.draftKey] || {};
  return {
    harness: lang.codeBase64 || "",
    solution: lang.solution || "",
    nodeH: draft?.NODE_H_CONTENT || "",
  };
}

export function applyBuffersToDraft(draft, language, buffers) {
  const next = structuredClone
    ? structuredClone(draft)
    : JSON.parse(JSON.stringify(draft));
  const config = LANG_FILE[language];
  if (!config) return next;
  next.languages[config.draftKey] = {
    ...next.languages[config.draftKey],
    codeBase64: buffers.harness ?? "",
    solution: buffers.solution ?? "",
  };
  if (language === "cpp" && buffers.nodeH != null) {
    next.NODE_H_CONTENT = buffers.nodeH;
  }
  return next;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mapStatusToRows(statusPayload, idIndex, orderedIds) {
  const resultsById = new Map();
  for (const result of statusPayload?.results || []) {
    if (result.testcase_id) resultsById.set(String(result.testcase_id), result);
  }

  const overall = statusPayload?.status || "UNKNOWN";
  const globalError =
    overall === "FAILED" ||
    overall === "ERROR" ||
    overall === "TIMEOUT" ||
    overall === "NOT_FOUND"
      ? statusPayload?.error || `Batch status: ${overall}`
      : null;

  const rows = [];
  let passed = 0;
  for (const tcId of orderedIds) {
    const meta = idIndex[tcId] || {};
    const result = resultsById.get(String(tcId));
    const row = {
      testcase_id: tcId,
      test_index: meta.test_index,
      order: meta.order,
      input: meta.input || "",
      expected: meta.expected || "",
      got: "",
      stderr: "",
      status: null,
      passed: false,
      time: null,
      memory: null,
      error: null,
    };
    if (!result) {
      row.status = "NO_RESULT";
      row.error = globalError || "No result returned for this testcase";
    } else {
      row.status = result.status;
      row.time = result.execution_time ?? null;
      row.memory = result.memory_consumed ?? null;
      row.got = result.stdout || "";
      row.stderr = result.stderr || "";
      if (result.status === "CORRECT") {
        row.passed = true;
        passed += 1;
      } else {
        row.error = [
          `Expected: ${row.expected}`,
          `Actual:   ${String(row.got).trim()}`,
          `Stderr:   ${String(row.stderr).trim()}`,
          result.status ? `Status: ${result.status}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
    rows.push(row);
  }
  return {
    overall,
    globalError,
    passed,
    total: rows.length,
    rows,
  };
}

async function postCompile(payload) {
  const response = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Compile failed (${response.status})`);
  }
  return data;
}

async function getStatus(requestId) {
  const response = await fetch(`/api/status/${encodeURIComponent(requestId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok && !data.status) {
    throw new Error(data.error || `Status failed (${response.status})`);
  }
  return data;
}

export async function runCompilerBatch({
  language,
  questionKind,
  structure,
  timeLimit,
  files,
  mainFilePath,
  testcases,
  questionId,
  questionName,
  shortText,
  onProgress,
}) {
  onProgress?.({ phase: "submit", message: "Submitting batch…" });
  const submit = await postCompile({
    language,
    questionKind,
    structure,
    timeLimit,
    files,
    mainFilePath,
    testcases,
    questionId,
    questionName,
    shortText,
  });

  const idIndex = submit.id_index || {};
  const orderedIds = (testcases || []).map((tc, index) =>
    String(tc.id || `tc-${index + 1}`),
  );

  let statusPayload;
  if (submit.request_id) {
    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
      statusPayload = await getStatus(submit.request_id);
      const reported = Array.isArray(statusPayload.results)
        ? statusPayload.results.length
        : 0;
      onProgress?.({
        phase: "poll",
        attempt,
        message: `Polling status… ${reported}/${orderedIds.length} cases reported (${attempt}/${MAX_POLL_ATTEMPTS})`,
      });
      if (TERMINAL.has(statusPayload.status)) break;
      await sleep(POLL_INTERVAL_MS);
    }
    if (!statusPayload || !TERMINAL.has(statusPayload.status)) {
      statusPayload = {
        status: "TIMEOUT",
        error: "Timed out waiting for results",
        results: statusPayload?.results || [],
      };
    }
  } else if (submit.inline) {
    statusPayload = {
      status: submit.inline.status || "SUCCESS",
      error: submit.inline.error || null,
      results: (
        submit.inline.response?.results ||
        submit.inline.results ||
        []
      ).map((result) => ({
        testcase_id: String(result.testcase_id || result.test_case_id || ""),
        status: result.status,
        execution_time: result.execution_time,
        memory_consumed: result.memory_consumed,
        stdout: result.stdout || "",
        stderr: result.stderr || "",
      })),
    };
  } else {
    throw new Error("No request id returned from compile");
  }

  onProgress?.({ phase: "done", message: "Mapping results…" });
  return mapStatusToRows(statusPayload, idIndex, orderedIds);
}

export async function runLanguageBatch(options) {
  const { mainFilePath, files } = buildLanguageFiles(options);
  return runCompilerBatch({ ...options, mainFilePath, files });
}
