import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MAX_FINAL_JSON_BYTES,
  filesWithSolution,
  parseFinalCodingQuestion,
} from "../frontend/final-json-runner.js";
import { buildPracticeJson } from "../frontend/json-prep.js";

function base64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function readExample(filename) {
  return readFileSync(
    new URL(`../examples/${filename}`, import.meta.url),
    "utf8",
  );
}

function finalCodingQuestion() {
  return [
    {
      question: {
        question_id: "question-1",
        short_text: "Reverse a linked list",
        difficulty: "MEDIUM",
      },
      test_cases: [
        {
          id: "case-1",
          order: 1,
          input: "3\n1 2 3\n",
          output: "3 2 1",
          tags: [{ name_enum: "PUBLIC", display_name: "Public" }],
          weightage: 5,
        },
        {
          id: "case-2",
          order: 2,
          input: "1\n7\n",
          output: "",
          outputs: ["7", "7 "],
          multiple_possible_output: true,
          tags: [{ name_enum: "HIDDEN", display_name: "Hidden" }],
          weightage: 5,
        },
      ],
      coding_question_details: [
        { language: "CPP", is_function_based: true },
        { language: "PYTHON", is_function_based: true },
        { language: "NODE_JS", is_function_based: true },
      ],
      language_code_repository_details: [
        {
          language: "CPP",
          file_path_to_execute: "main.cpp",
          default_file_path_to_submit_code: "solution.cpp",
          code_repository: [
            {
              file_name: "main.cpp",
              file_type: "FILE",
              file_content: base64('#include "solution.cpp"\nint main() {}'),
            },
            {
              file_name: "node.h",
              file_type: "FILE",
              file_content: base64("struct ListNode { int value; ListNode* next; };"),
            },
          ],
        },
        {
          language: "PYTHON",
          file_path_to_execute: "main.py",
          default_file_path_to_submit_code: "solution.py",
          code_repository: [
            {
              file_name: "main.py",
              file_type: "FILE",
              file_content: base64("from solution import solve\nprint(solve())"),
            },
            {
              file_name: "helpers/io.py",
              file_type: "FILE",
              file_content: base64("def read():\n    return input()"),
            },
          ],
        },
        {
          language: "NODE_JS",
          file_path_to_execute: "index.js",
          default_file_path_to_submit_code: "solution.js",
          code_repository: [
            {
              file_name: "index.js",
              file_type: "FILE",
              file_content: base64('require("./solution")'),
            },
          ],
        },
      ],
      solutions: [
        {
          order: 1,
          code_details: [
            {
              language: "CPP",
              code_content: "ListNode* solve(ListNode* head) { return head; }",
            },
            {
              language: "PYTHON",
              code_content: "def solve():\n    return 7",
            },
            {
              language: "NODE_JS",
              code_content: "module.exports = () => 7;",
            },
          ],
        },
      ],
      test_case_evaluation_metrics: [
        { language: "CPP", time_limit_to_execute_in_seconds: 1 },
        { language: "PYTHON", time_limit_to_execute_in_seconds: 4 },
        { language: "NODE_JS", time_limit_to_execute_in_seconds: 3 },
      ],
    },
  ];
}

test("parses runnable packages and testcases from final coding_questions.json", () => {
  const input = finalCodingQuestion();
  const before = JSON.stringify(input);

  const parsed = parseFinalCodingQuestion(input);

  assert.equal(JSON.stringify(input), before, "input must not be mutated");
  assert.deepEqual(parsed.question, {
    id: "question-1",
    shortText: "Reverse a linked list",
    difficulty: "MEDIUM",
  });
  assert.equal(parsed.testcases.length, 2);
  assert.deepEqual(parsed.testcases[1].outputs, ["7", "7 "]);
  assert.deepEqual(
    parsed.packages.map((item) => item.language),
    ["cpp", "python"],
  );

  const cpp = parsed.packages[0];
  assert.equal(cpp.questionKind, "function");
  assert.equal(cpp.structure, "node");
  assert.equal(cpp.timeLimit, 1);
  assert.equal(cpp.mainFilePath, "main.cpp");
  assert.equal(cpp.submitFilePath, "solution.cpp");
  assert.equal(cpp.hasSolution, true);
  assert.match(cpp.solution, /ListNode/);
  assert.equal(cpp.files.length, 2);
  assert.equal(
    cpp.files.find((file) => file.file_path === "main.cpp").base64_encoded,
    true,
  );
  assert.ok(
    !cpp.files.some((file) => file.file_path === "solution.cpp"),
    "solution text stays separate until run time",
  );
  assert.equal(
    cpp.files.find((file) => file.file_path === "node.h").base64_encoded,
    true,
  );

  const python = parsed.packages[1];
  assert.equal(python.mainFilePath, "main.py");
  assert.equal(python.submitFilePath, "solution.py");
  assert.equal(python.hasSolution, true);
  assert.ok(
    python.files.some((file) => file.file_path === "helpers/io.py"),
    "additional repository files should be forwarded",
  );

  const nodeIssue = parsed.unavailable.find(
    (item) => item.platform === "NODE_JS",
  );
  assert.match(nodeIssue.reason, /not supported/i);
});

test("parses the final JSON produced by the preparation workflow", () => {
  const generated = buildPracticeJson({
    mode: "create",
    structure: "standard",
    questionKind: "function",
    enabledLanguages: ["cpp", "python", "java"],
    luaContent: readExample("standard-with-content.lua"),
    testcasesData: JSON.parse(readExample("testcases-single.json")),
    existingJson: null,
  }).data;

  const parsed = parseFinalCodingQuestion(generated);

  assert.deepEqual(
    parsed.packages.map((item) => item.language),
    ["cpp", "python", "java"],
  );
  assert.equal(parsed.testcases.length, generated[0].test_cases.length);
  assert.equal(parsed.question.id, generated[0].question.question_id);
});

test("keeps malformed language packages unavailable without blocking valid ones", () => {
  const input = finalCodingQuestion();
  input[0].language_code_repository_details[0].code_repository[0].file_content =
    "not-valid-base64%%%";

  const parsed = parseFinalCodingQuestion(input);

  assert.deepEqual(
    parsed.packages.map((item) => item.language),
    ["python"],
  );
  const cppIssue = parsed.unavailable.find((item) => item.platform === "CPP");
  assert.match(cppIssue.reason, /base64/i);
});

test("reports non-function packages as unavailable", () => {
  const input = finalCodingQuestion();
  input[0].coding_question_details[0].is_function_based = false;

  const parsed = parseFinalCodingQuestion(input);

  assert.deepEqual(
    parsed.packages.map((item) => item.language),
    ["python"],
  );
  assert.match(
    parsed.unavailable.find((item) => item.platform === "CPP").reason,
    /non-function/i,
  );
});

test("keeps packages runnable when only the reference solution is missing", () => {
  const input = finalCodingQuestion();
  input[0].solutions[0].code_details = input[0].solutions[0].code_details.filter(
    (item) => item.language !== "PYTHON",
  );

  const parsed = parseFinalCodingQuestion(input);
  const python = parsed.packages.find((item) => item.language === "python");

  assert.ok(python, "python package should remain available");
  assert.equal(python.hasSolution, false);
  assert.equal(python.solution, "");
  assert.equal(python.submitFilePath, "solution.py");
  assert.ok(
    !python.files.some((file) => file.file_path === "solution.py"),
    "missing solutions must not invent a submit file until the user provides one",
  );
  assert.ok(
    !parsed.unavailable.some((item) => item.platform === "PYTHON"),
    "missing solutions should not mark the package unavailable",
  );

  assert.throws(() => filesWithSolution(python, "   "), /solution/i);
  const files = filesWithSolution(python, "def solve():\n    return 7");
  assert.deepEqual(
    files.find((file) => file.file_path === "solution.py"),
    {
      file_path: "solution.py",
      file_contents: "def solve():\n    return 7",
      base64_encoded: false,
    },
  );
});

test("keeps unsafe repository paths out of compiler payloads", () => {
  const input = finalCodingQuestion();
  input[0].language_code_repository_details[0].code_repository[0].file_name =
    "../main.cpp";
  input[0].language_code_repository_details[0].file_path_to_execute =
    "../main.cpp";

  const parsed = parseFinalCodingQuestion(input);

  assert.ok(!parsed.packages.some((item) => item.language === "cpp"));
  assert.match(
    parsed.unavailable.find((item) => item.platform === "CPP").reason,
    /safe relative path/i,
  );

  const excessiveFiles = finalCodingQuestion();
  excessiveFiles[0].language_code_repository_details[0].code_repository =
    Array.from({ length: 33 }, (_, index) => ({
      file_name: index === 0 ? "main.cpp" : `helper-${index}.cpp`,
      file_type: "FILE",
      file_content: base64("// source"),
    }));
  const parsedExcessive = parseFinalCodingQuestion(excessiveFiles);
  assert.match(
    parsedExcessive.unavailable.find((item) => item.platform === "CPP").reason,
    /at most 32 files/i,
  );

  const controlCharacterPath = finalCodingQuestion();
  controlCharacterPath[0].language_code_repository_details[0]
    .code_repository[0].file_name = "main\n.cpp";
  const parsedControlCharacterPath = parseFinalCodingQuestion(
    controlCharacterPath,
  );
  assert.match(
    parsedControlCharacterPath.unavailable.find(
      (item) => item.platform === "CPP",
    ).reason,
    /safe relative path/i,
  );
});

test("rejects malformed roots, duplicate testcase ids, and excessive cases", () => {
  assert.throws(
    () => parseFinalCodingQuestion({}),
    /array containing exactly one coding question/i,
  );

  const duplicate = finalCodingQuestion();
  duplicate[0].test_cases[1].id = "case-1";
  assert.throws(
    () => parseFinalCodingQuestion(duplicate),
    /testcase ids must be unique/i,
  );

  const excessive = finalCodingQuestion();
  excessive[0].test_cases = Array.from({ length: 201 }, (_, index) => ({
    id: `case-${index + 1}`,
    order: index + 1,
    input: String(index),
    output: String(index),
  }));
  assert.throws(
    () => parseFinalCodingQuestion(excessive),
    /at most 200 testcases/i,
  );

  const malformedSections = finalCodingQuestion();
  malformedSections[0].language_code_repository_details = {};
  assert.throws(
    () => parseFinalCodingQuestion(malformedSections),
    /language_code_repository_details must be an array/i,
  );
});

test("exposes Execute Final JSON page controls", () => {
  const html = readFileSync(
    new URL("../frontend/index.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /data-nav="execute-final"/);
  assert.match(html, /id="execute-final-file"/);
  assert.match(html, /id="execute-final-run-all"/);
  assert.equal(MAX_FINAL_JSON_BYTES, 100 * 1024 * 1024);
});
