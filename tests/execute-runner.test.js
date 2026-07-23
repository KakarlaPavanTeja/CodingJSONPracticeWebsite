import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TIME_LIMITS,
  buildLanguageFiles,
  extractTestCases,
  mapStatusToRows,
} from "../frontend/execute-runner.js";
import {
  LARGE_IO_THRESHOLD_BYTES,
  LANGUAGE_IDS,
} from "../api/_lib/config.js";
import {
  buildCompilePayload,
  inputExceedsInlineLimit,
} from "../api/_lib/compiler.js";

test("extractTestCases accepts object and single-element array roots", () => {
  const cases = extractTestCases({
    test_cases: [
      {
        id: "a",
        order: 1,
        input: "1\n",
        output: "1",
        tags: ["example"],
        weightage: 1,
      },
    ],
  });
  assert.equal(cases.length, 1);
  assert.equal(cases[0].id, "a");
  assert.equal(cases[0].weightage, 1);

  const fromArray = extractTestCases([
    {
      test_cases: [{ input: "2", output: "2", order: 1, tags: ["t"] }],
    },
  ]);
  assert.equal(fromArray[0].input, "2");
});

test("buildLanguageFiles maps function and node.h for cpp", () => {
  const built = buildLanguageFiles({
    language: "cpp",
    questionKind: "function",
    structure: "node",
    harness: "int main(){}",
    solution: "int solve(){return 1;}",
    nodeH: "struct Node{};",
  });
  assert.equal(built.mainFilePath, "main.cpp");
  assert.equal(built.files.length, 3);
  assert.equal(built.files[2].file_path, "node.h");
});

test("buildLanguageFiles nonfunction uses a single main file", () => {
  const built = buildLanguageFiles({
    language: "python",
    questionKind: "nonfunction",
    solution: "print(1)",
  });
  assert.equal(built.files.length, 1);
  assert.equal(built.files[0].file_path, "main.py");
});

test("mapStatusToRows marks CORRECT as passed and fills errors", () => {
  const idIndex = {
    "tc-1": { test_index: 1, order: 1, input: "1", expected: "1" },
    "tc-2": { test_index: 2, order: 2, input: "2", expected: "2" },
  };
  const summary = mapStatusToRows(
    {
      status: "SUCCESS",
      results: [
        {
          testcase_id: "tc-1",
          status: "CORRECT",
          execution_time: 0.01,
          stdout: "1",
          stderr: "",
        },
        {
          testcase_id: "tc-2",
          status: "WRONG_ANSWER",
          execution_time: 0.02,
          stdout: "9",
          stderr: "",
        },
      ],
    },
    idIndex,
    ["tc-1", "tc-2"],
  );
  assert.equal(summary.passed, 1);
  assert.equal(summary.total, 2);
  assert.equal(summary.rows[0].passed, true);
  assert.equal(summary.rows[1].passed, false);
  assert.match(summary.rows[1].error, /Expected: 2/);
});

test("default time limits match CPP 1 / Python 4 / Java 2", () => {
  assert.equal(DEFAULT_TIME_LIMITS.cpp, 1);
  assert.equal(DEFAULT_TIME_LIMITS.python, 4);
  assert.equal(DEFAULT_TIME_LIMITS.java, 2);
});

test("language ids are v3 cpp/python/java only", () => {
  assert.equal(LANGUAGE_IDS.cpp, "7");
  assert.equal(LANGUAGE_IDS.python, "22");
  assert.equal(LANGUAGE_IDS.java, "30");
  assert.equal(LANGUAGE_IDS.node, undefined);
});

test("S3 inline threshold is 50KB and inputExceedsInlineLimit respects it", () => {
  assert.equal(LARGE_IO_THRESHOLD_BYTES, 50 * 1024);
  assert.equal(inputExceedsInlineLimit("small"), false);
  assert.equal(inputExceedsInlineLimit("x".repeat(50 * 1024 + 1)), true);
});

test("buildCompilePayload uses v3 language id and time limit", () => {
  const payload = buildCompilePayload({
    languageToken: "python",
    files: [
      {
        file_path: "main.py",
        file_contents: "print(1)",
        base64_encoded: false,
      },
    ],
    mainFilePath: "main.py",
    timeLimit: 4,
    testcasesPayload: [],
  });
  assert.equal(payload.language, "22");
  assert.equal(payload.default_execution_time_limit, 4);
  assert.equal(payload.main_file_path, "main.py");
  assert.equal(payload.request_type, "CODE_EVALUATION_WITH_IO_TESTCASES");
});
