import {
  LARGE_IO_THRESHOLD_BYTES,
  LANGUAGE_IDS,
  getCompilerBaseUrl,
} from "./config.js";
import { uploadInputBlob } from "./s3.js";

function textBytes(value) {
  return Buffer.byteLength(String(value ?? ""), "utf8");
}

/** True when stdin should be uploaded to S3 instead of sent inline. */
export function inputExceedsInlineLimit(inputText) {
  return textBytes(inputText) > LARGE_IO_THRESHOLD_BYTES;
}

export async function buildInputObject(inputText, meta) {
  const text = inputText ?? "";
  if (inputExceedsInlineLimit(text)) {
    const url = await uploadInputBlob({
      contents: text,
      questionId: meta.questionId,
      questionName: meta.questionName,
      order: meta.order,
    });
    if (url) {
      return {
        input_type: "STDIN",
        url,
        base64_encoded: false,
      };
    }
  }
  return {
    input_type: "STDIN",
    contents: text,
    base64_encoded: false,
  };
}

export async function buildOutputObject(tc) {
  const multiple = tc.multiple_possible_output === true;
  const expected = tc.output ?? "";
  const outputObj = {
    output_type: "STDOUT",
    contents: expected,
    multiple_possible_output: multiple,
    base64_encoded: false,
  };
  if (multiple && Array.isArray(tc.outputs)) {
    outputObj.multiple_output_contents = tc.outputs.map((item) => String(item));
  }
  return outputObj;
}

export async function buildTestcasesPayload(testcases, meta) {
  const payload = [];
  const idIndex = {};
  for (let index = 0; index < testcases.length; index += 1) {
    const tc = testcases[index];
    const order = Number(tc.order) || index + 1;
    const tcId = String(tc.id || tc.testcase_id || `tc-${index + 1}`);
    const inputText = tc.input ?? "";
    const expected = String(tc.output ?? "").trim();
    const inputObj = await buildInputObject(inputText, { ...meta, order });
    const outputObj = await buildOutputObject(tc);
    payload.push({
      testcase_id: tcId,
      inputs: [inputObj],
      outputs: [outputObj],
    });
    idIndex[tcId] = {
      test_index: index + 1,
      order,
      input: inputText,
      expected,
    };
  }
  return { payload, idIndex };
}

export function buildCompilePayload({
  languageToken,
  files,
  mainFilePath,
  timeLimit,
  testcasesPayload,
}) {
  const language = LANGUAGE_IDS[languageToken];
  if (!language) {
    throw new Error("Unsupported language");
  }
  return {
    language,
    files: (files || []).map((file) => ({
      file_path: file.file_path || file.filePath,
      file_contents: file.file_contents ?? file.fileContents ?? "",
      base64_encoded: Boolean(file.base64_encoded ?? file.base64Encoded),
    })),
    main_file_path: mainFilePath,
    response_queue_url: "",
    show_outputs: "ALL",
    ignore_trailing_whitespaces: true,
    request_type: "CODE_EVALUATION_WITH_IO_TESTCASES",
    default_execution_time_limit: Number(timeLimit) || 2,
    testcases: testcasesPayload,
  };
}

export async function submitCompile(compilePayload) {
  const base = getCompilerBaseUrl();
  const response = await fetch(`${base}/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(compilePayload),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: "Invalid JSON from compiler" };
  }
  if (!response.ok) {
    const error = new Error(
      data.error || data.message || `Compile failed (${response.status})`,
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function fetchStatus(requestId) {
  const base = getCompilerBaseUrl();
  const response = await fetch(
    `${base}/status/${encodeURIComponent(requestId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { status: "ERROR", response: { error: "Invalid JSON from status" } };
  }
  if (!response.ok) {
    const error = new Error(
      data.error || data.message || `Status failed (${response.status})`,
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return sanitizeStatus(data);
}

function decodeOutputContents(entry) {
  if (!entry) return "";
  const contents = entry.contents;
  if (contents == null) return "";
  if (entry.base64_encoded) {
    try {
      return Buffer.from(contents, "base64").toString("utf8");
    } catch {
      return "";
    }
  }
  return String(contents);
}

export function sanitizeStatus(statusData) {
  const body = statusData?.response || {};
  const overall = statusData?.status || "UNKNOWN";
  const results = Array.isArray(body.results) ? body.results : [];
  return {
    status: overall,
    error:
      typeof body.error === "string"
        ? body.error
        : typeof statusData?.error === "string"
          ? statusData.error
          : null,
    results: results.map((result) => {
      const outputs = Array.isArray(result.outputs) ? result.outputs : [];
      const stdout = outputs.find((item) => item.output_type === "STDOUT");
      const stderr = outputs.find((item) => item.output_type === "STDERR");
      return {
        testcase_id: String(result.testcase_id || result.test_case_id || ""),
        status: result.status || null,
        execution_time: result.execution_time ?? null,
        memory_consumed: result.memory_consumed ?? null,
        stdout: decodeOutputContents(stdout) || result.stdout || "",
        stderr: decodeOutputContents(stderr) || result.stderr || "",
      };
    }),
  };
}
