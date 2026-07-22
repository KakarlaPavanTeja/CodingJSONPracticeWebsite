import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildPracticeJson,
  normalizeTestCases,
  parseSection,
  regenerateIds,
  serializePracticeJson,
  validatePreparation,
} from "../frontend/json-prep.js";

function readExample(filename, json = false) {
  const content = readFileSync(
    new URL(`../examples/${filename}`, import.meta.url),
    "utf8",
  );
  return json ? JSON.parse(content) : content;
}

const LUA = `
----------QUESTION_DESCRIPTION_START----------
Add two values.
----------QUESTION_DESCRIPTION_END----------
----------SHORT_TEXT_START----------
Add Values
----------SHORT_TEXT_END----------
----------QUESTION_LEVEL_START----------
MEDIUM
----------QUESTION_LEVEL_END----------
----------DEFAULT_TAGS_START----------
arrays, math
----------DEFAULT_TAGS_END----------
----------BEGINNER_TOPICS_START----------
arrays
----------BEGINNER_TOPICS_END----------
----------INTERMEDIATE_TOPICS_START----------
prefix sums
----------INTERMEDIATE_TOPICS_END----------
----------ADVANCED_TOPICS_START----------
----------ADVANCED_TOPICS_END----------
----------COMPANIES_START----------
Alphabet, Inc.
Meta
----------COMPANIES_END----------
----------REAL_LIFE_EXAMPLES_START----------
1. Combining two account balances.
2. Summing two sensor readings.
----------REAL_LIFE_EXAMPLES_END----------
----------HINTS_START----------
----------HINTS_START_1----------
Start with the two available values.
----------HINTS_END_1----------
----------HINTS_START_3----------
Return their sum.
----------HINTS_END_3----------
----------HINTS_END----------
----------FOLLOW_UP_QUESTIONS_START----------
----------FOLLOW_UP_QUESTION_START_1----------
----------QUESTION_START----------
Can overflow occur?
----------QUESTION_END----------
----------ANSWER_START----------
Use a wider integer type when required.
----------ANSWER_END----------
----------FOLLOW_UP_QUESTION_END_1----------
----------FOLLOW_UP_QUESTIONS_END----------
----------CODE_CONTENT_CPP_START----------
int add(int a, int b) { return a + b; }
----------CODE_CONTENT_CPP_END----------
----------CODE_CONTENT_PYTHON_START----------
def add(a, b):
    return a + b
----------CODE_CONTENT_PYTHON_END----------
----------CODE_BASE64_CPP_START----------
#include <iostream>
int main() { std::cout << "✓"; }
----------CODE_BASE64_CPP_END----------
----------CODE_BASE64_PYTHON_START----------
print("✓")
----------CODE_BASE64_PYTHON_END----------
----------DEBUG_HELPER_CODE_CPP_START----------
----------PRE_USER_CODE_START----------
int before = 1;
----------PRE_USER_CODE_END----------
----------POST_USER_CODE_START----------
int after = 2;
----------POST_USER_CODE_END----------
----------DEBUG_HELPER_CODE_CPP_END----------
----------SOLUTIONS_CPP_START----------
int add(int a, int b) { return a + b; }
----------SOLUTIONS_CPP_END----------
----------SOLUTIONS_PYTHON_START----------
def add(a, b): return a + b
----------SOLUTIONS_PYTHON_END----------
`;

const TESTCASES = {
  test_cases: [
    {
      input: "1 2",
      output: "3",
      weightage: 2.5,
      order: 9,
      tags: ["example", "subtask_1", "size_small"],
    },
    {
      input: "4 5",
      multiple_possible_output: true,
      outputs: ["9", "09"],
      weightage: 7.5,
      order: 3,
      tags: [{ name_enum: "stress", display_name: "Stress case" }],
    },
  ],
};

test("normalizes both supported testcase root shapes and preserves v4 tags", () => {
  const objectRoot = normalizeTestCases(TESTCASES);
  const arrayRoot = normalizeTestCases([TESTCASES]);

  assert.equal(objectRoot.testCases.length, 2);
  assert.deepEqual(
    objectRoot.testCases[0].tags.map((tag) => tag.name_enum),
    ["example", "subtask_1", "size_small"],
  );
  assert.equal(objectRoot.testCases[0].order, 1);
  assert.equal(objectRoot.testCases[1].order, 2);
  assert.equal(objectRoot.testCases[1].output, null);
  assert.deepEqual(objectRoot.testCases[1].outputs, ["9", "09"]);
  assert.deepEqual(
    arrayRoot.testCases.map(({ id: _id, ...testcase }) => testcase),
    objectRoot.testCases.map(({ id: _id, ...testcase }) => testcase),
  );
});

test("rejects testcase array roots with more than one container", () => {
  assert.throws(
    () => normalizeTestCases([TESTCASES, TESTCASES]),
    /exactly one object/,
  );
});

test("rejects non-positive or non-finite testcase weights", () => {
  for (const weightage of [0, -1, Number.NaN, "1", true, [1]]) {
    assert.throws(
      () =>
        normalizeTestCases({
          test_cases: [{ input: "1", output: "1", weightage, order: 1 }],
        }),
      /positive finite number/,
    );
  }
});

test("rejects testcases without at least one valid tag", () => {
  for (const tags of [
    undefined,
    "example",
    [],
    [""],
    [null],
    [{}],
    [{ name_enum: 42 }],
    ["valid", { name_enum: 42 }],
  ]) {
    assert.throws(
      () =>
        normalizeTestCases({
          test_cases: [
            { input: "1", output: "1", weightage: 1, order: 1, tags },
          ],
        }),
      /at least one valid tag/,
    );
  }
});

test("preserves testcase IDs by content when cases are reordered", () => {
  const existing = [
    { id: "case-a", input: "1", output: "1", order: 1 },
    { id: "case-b", input: "2", output: "2", order: 2 },
  ];
  const result = normalizeTestCases(
    {
      test_cases: [
        {
          input: "2",
          output: "2",
          multiple_possible_output: "false",
          weightage: 1,
          order: 1,
          tags: ["case"],
        },
        {
          input: "1",
          output: "1",
          multiple_possible_output: "false",
          weightage: 1,
          order: 2,
          tags: ["case"],
        },
        { input: "3", output: "3", weightage: 1, order: 3, tags: ["case"] },
      ],
    },
    existing,
  );

  assert.equal(result.testCases[0].id, "case-b");
  assert.equal(result.testCases[1].id, "case-a");
  assert.notEqual(result.testCases[2].id, "case-a");
  assert.notEqual(result.testCases[2].id, "case-b");
});

test("does not transfer an existing testcase ID to an inserted case", () => {
  const existing = [
    { id: "case-a", input: "1", output: "1", order: 1 },
    { id: "case-b", input: "2", output: "2", order: 2 },
  ];
  const result = normalizeTestCases(
    {
      test_cases: [
        { input: "0", output: "0", weightage: 1, order: 1, tags: ["case"] },
        { input: "1", output: "1", weightage: 1, order: 2, tags: ["case"] },
        { input: "2", output: "2", weightage: 1, order: 3, tags: ["case"] },
      ],
    },
    existing,
  );

  assert.notEqual(result.testCases[0].id, "case-a");
  assert.notEqual(result.testCases[0].id, "case-b");
  assert.equal(result.testCases[1].id, "case-a");
  assert.equal(result.testCases[2].id, "case-b");
});

test("does not preserve an ID across singular and multiple output modes", () => {
  const existing = [
    { id: "case-a", input: "1", output: '["x"]', order: 1 },
    { id: "case-b", input: "2", output: "2", order: 2 },
  ];
  const result = normalizeTestCases(
    {
      test_cases: [
        {
          input: "2",
          output: "2",
          weightage: 1,
          order: 1,
          tags: ["case"],
        },
        {
          input: "1",
          multiple_possible_output: true,
          outputs: ["x"],
          weightage: 1,
          order: 2,
          tags: ["case"],
        },
      ],
    },
    existing,
  );

  assert.equal(result.testCases[0].id, "case-b");
  assert.notEqual(result.testCases[1].id, "case-a");
  assert.notEqual(result.testCases[1].id, "case-b");
});

test("builds platform JSON with structured enrichment and exact score", () => {
  const result = buildPracticeJson({
    mode: "create",
    structure: "standard",
    questionKind: "function",
    enabledLanguages: ["python", "cpp"],
    luaContent: LUA,
    testcasesData: TESTCASES,
  });
  const output = result.data[0];
  const metadata = JSON.parse(output.question.metadata);

  assert.equal(output.total_score, 10);
  assert.equal(output.question.difficulty, "MEDIUM");
  assert.deepEqual(
    output.question_asked_by_companies_info,
    [{ company_name: "ALPHABET, INC." }, { company_name: "META" }],
  );
  assert.equal(output.hints.length, 2, "non-contiguous hint markers are retained");
  assert.equal(metadata.follow_up_questions[0].title, "Can overflow occur?");
  assert.deepEqual(
    output.coding_question_details.map((detail) => detail.language),
    ["CPP", "PYTHON"],
  );
  assert.equal(
    output.coding_question_details.filter((detail) => detail.default_code).length,
    1,
  );
  assert.equal(output.language_code_repository_details.length, 2);
  assert.match(
    Buffer.from(
      output.language_code_repository_details[0].code_repository[0].file_content,
      "base64",
    ).toString("utf8"),
    /✓/,
  );
});

test("serializes execution time limits with a decimal fraction", () => {
  const result = buildPracticeJson({
    mode: "create",
    structure: "standard",
    questionKind: "function",
    enabledLanguages: ["cpp", "python"],
    luaContent: LUA,
    testcasesData: TESTCASES,
  });

  const serialized = serializePracticeJson(result.data);
  assert.match(serialized, /"time_limit_to_execute_in_seconds": 1\.0/);
  assert.match(serialized, /"time_limit_to_execute_in_seconds": 4\.0/);
  assert.deepEqual(JSON.parse(serialized), result.data);

  const reordered = {
    time_limit_to_execute_in_seconds: 2,
    total_score: 25,
    nested: {
      time_limit_to_execute_in_seconds: 1.5,
      note: '"time_limit_to_execute_in_seconds": 8',
    },
  };
  const reorderedJson = serializePracticeJson(reordered);
  assert.match(reorderedJson, /"time_limit_to_execute_in_seconds": 2\.0,/);
  assert.match(reorderedJson, /"time_limit_to_execute_in_seconds": 1\.5/);
  assert.match(reorderedJson, /"total_score": 25/);
  assert.doesNotMatch(reorderedJson, /"total_score": 25\.0/);
  assert.deepEqual(JSON.parse(reorderedJson), reordered);
});

test("supports legacy comma-separated companies and legal suffixes", () => {
  for (const [companies, expected] of [
    [
      "Google, Amazon, Microsoft, De Shaw",
      ["GOOGLE", "AMAZON", "MICROSOFT", "DE SHAW"],
    ],
    ["Alphabet, Inc., Meta", ["ALPHABET, INC.", "META"]],
  ]) {
    const result = buildPracticeJson({
      mode: "create",
      structure: "standard",
      questionKind: "function",
      enabledLanguages: ["cpp"],
      luaContent: LUA.replace("Alphabet, Inc.\nMeta", companies),
      testcasesData: TESTCASES,
    }).data[0];

    assert.deepEqual(
      result.question_asked_by_companies_info.map((item) => item.company_name),
      expected,
    );
  }
});

test("keeps stable IDs and unrelated legacy fields when testcase count changes", () => {
  const initial = buildPracticeJson({
    mode: "create",
    structure: "standard",
    questionKind: "function",
    enabledLanguages: ["cpp"],
    luaContent: LUA,
    testcasesData: TESTCASES,
  }).data;
  initial[0].legacy_extension = { retained: true };
  const oldQuestionId = initial[0].question.question_id;
  const oldCodeId = initial[0].coding_question_details[0].code_id;
  const oldSolutionId = initial[0].solutions[0].code_details[0].code_id;

  const updateCases = structuredClone(TESTCASES);
  updateCases.test_cases.push({
    input: "10 20",
    output: "30",
    weightage: 1,
    order: 3,
    tags: ["subtask_2"],
  });
  const updated = buildPracticeJson({
    mode: "update",
    structure: "standard",
    questionKind: "function",
    enabledLanguages: ["cpp"],
    luaContent: LUA,
    testcasesData: updateCases,
    existingJson: initial,
  }).data[0];

  assert.equal(updated.question.question_id, oldQuestionId);
  assert.equal(updated.coding_question_details[0].code_id, oldCodeId);
  assert.equal(updated.solutions[0].code_details[0].code_id, oldSolutionId);
  assert.deepEqual(updated.legacy_extension, { retained: true });
  assert.equal(updated.test_cases.length, 3);
});

test("creates non-function JSON without repositories, solutions, or debug helpers", () => {
  const result = buildPracticeJson({
    mode: "create",
    structure: "standard",
    questionKind: "nonfunction",
    enabledLanguages: ["python"],
    luaContent: LUA,
    testcasesData: TESTCASES,
  }).data[0];

  assert.equal(result.coding_question_details[0].is_function_based, false);
  assert.match(result.coding_question_details[0].code_content, /write your code here/i);
  assert.equal(result.coding_question_details[0].debug_helper_code, null);
  assert.deepEqual(result.language_code_repository_details, []);
  assert.deepEqual(result.solutions, []);
});

test("allows node-based preparation without C++ and validates node.h when C++ is enabled", () => {
  assert.doesNotThrow(() =>
    buildPracticeJson({
      mode: "create",
      structure: "node",
      questionKind: "function",
      enabledLanguages: ["python"],
      luaContent: LUA,
      testcasesData: TESTCASES,
    }),
  );

  assert.throws(
    () =>
      buildPracticeJson({
        mode: "create",
        structure: "node",
        questionKind: "function",
        enabledLanguages: ["cpp"],
        luaContent: LUA,
        testcasesData: TESTCASES,
      }),
    /NODE_H_CONTENT/,
  );
});

test("rejects selected function languages missing from the Lua package", () => {
  assert.throws(
    () =>
      buildPracticeJson({
        mode: "create",
        structure: "standard",
        questionKind: "function",
        enabledLanguages: ["java"],
        luaContent: LUA,
        testcasesData: TESTCASES,
      }),
    /Selected JAVA language is missing CODE_CONTENT/,
  );
});

test("reports preflight errors without generating output", () => {
  const report = validatePreparation({
    mode: "update",
    structure: "node",
    questionKind: "function",
    enabledLanguages: [],
    luaContent: "",
    testcasesData: null,
    existingJson: null,
  });

  assert.ok(report.errors.length >= 4);
  assert.equal(report.canGenerate, false);
});

test("regenerates all platform IDs while retaining content", () => {
  const source = buildPracticeJson({
    mode: "create",
    structure: "standard",
    questionKind: "function",
    enabledLanguages: ["cpp"],
    luaContent: LUA,
    testcasesData: TESTCASES,
  }).data;
  const oldQuestionId = source[0].question.question_id;
  const regenerated = regenerateIds(source);

  assert.notEqual(regenerated[0].question.question_id, oldQuestionId);
  assert.equal(regenerated[0].question.short_text, "Add Values");
  assert.equal(new Set(regenerated[0].test_cases.map((item) => item.id)).size, 2);
});

test("rejects malformed existing question structures", () => {
  assert.throws(
    () => regenerateIds([{ question: "not-an-object" }]),
    /question must be an object/,
  );
  assert.throws(
    () =>
      regenerateIds([
        {
          question: { question_id: "question" },
          test_cases: "not-an-array",
        },
      ]),
    /test_cases must be an array/,
  );
});

test("builds updated populated samples against the current preparation contract", () => {
  for (const fixture of [
    {
      lua: "standard-with-content.lua",
      testcases: "testcases-single.json",
      structure: "standard",
      score: 25,
      minimumTagCount: 5,
      entryPoint: "findMaxMinRuntime",
    },
    {
      lua: "node-with-content.lua",
      testcases: "testcases-multiple.json",
      structure: "node",
      score: 25,
      minimumTagCount: 5,
      entryPoint: "buildBinaryTree",
    },
  ]) {
    const testcaseData = readExample(fixture.testcases, true);
    const result = buildPracticeJson({
      mode: "create",
      structure: fixture.structure,
      questionKind: "function",
      enabledLanguages: ["cpp", "python", "java", "nodejs"],
      luaContent: readExample(fixture.lua),
      testcasesData: testcaseData,
    });

    assert.equal(result.summary.testcaseCount, 3);
    assert.equal(result.summary.totalScore, fixture.score);
    assert.ok(result.summary.tagCount >= fixture.minimumTagCount);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(result.summary.languages, [
      "CPP",
      "PYTHON",
      "JAVA",
      "NODE_JS",
    ]);
    const output = result.data[0];
    const solutionDetails = output.solutions.flatMap(
      (solution) => solution.code_details,
    );
    assert.equal(solutionDetails.length, 4);
    assert.deepEqual(
      solutionDetails.map((detail) => detail.language).sort(),
      ["CPP", "JAVA", "NODE_JS", "PYTHON"],
    );
    assert.ok(
      solutionDetails.every(
        (detail) =>
          typeof detail.code_content === "string" &&
          detail.code_content.length > 80 &&
          detail.code_content.includes(fixture.entryPoint),
      ),
    );
    for (const detail of output.coding_question_details) {
      if (detail.language === "NODE_JS") continue;
      const helper = JSON.parse(detail.debug_helper_code);
      assert.ok(helper.pre_user_code.length > 0);
      assert.doesNotMatch(helper.pre_user_code, /pre user code/i);
    }
  }
  assert.doesNotMatch(readExample("node-with-content.lua"), /preorder/i);
});

test("sample testcase files demonstrate both supported roots and output modes", () => {
  const single = readExample("testcases-single.json", true);
  const multiple = readExample("testcases-multiple.json", true);

  assert.equal(Array.isArray(single), false);
  assert.equal(Array.isArray(multiple), true);
  assert.ok(
    single.test_cases.every(
      (testcase) =>
        typeof testcase.output === "string" &&
        testcase.output.length > 0 &&
        !Object.hasOwn(testcase, "outputs") &&
        testcase.multiple_possible_output !== true &&
        testcase.tags.length > 0,
    ),
  );
  assert.ok(
    multiple[0].test_cases.every(
      (testcase) =>
        testcase.multiple_possible_output === true &&
        testcase.outputs.length > 0 &&
        !Object.hasOwn(testcase, "output") &&
        testcase.tags.length > 0,
    ),
  );
});

test("standard sample does not restore legacy t-loops in supplied harnesses", () => {
  const lua = readExample("standard-with-content.lua");
  const sections = [
    ["CODE_BASE64_CPP", "int t;"],
    ["DEBUG_HELPER_CODE_CPP", "int t;"],
    ["CODE_BASE64_PYTHON", "for _ in range(t):"],
    ["DEBUG_HELPER_CODE_PYTHON", "for _ in range(t):"],
    ["CODE_BASE64_JAVA", "int t = scanner.nextInt();"],
    ["DEBUG_HELPER_CODE_JAVA", "int t = scanner.nextInt();"],
    ["CODE_BASE64_NODE_JS", "const t = parseInt(input[idx++]);"],
  ];

  for (const [sectionName, legacyBatchStatement] of sections) {
    const harness = parseSection(lua, sectionName);
    assert.ok(harness, `${sectionName} should be present`);
    assert.equal(harness.includes(legacyBatchStatement), false);
  }
});

test("sample testcase outputs match their populated reference solutions", () => {
  const standard = readExample("testcases-single.json", true);
  for (const testcase of standard.test_cases) {
    const values = testcase.input.trim().split(/\s+/).map(Number);
    let cursor = 0;
    const runtimeCount = values[cursor++];
    const runtimes = values.slice(cursor, cursor + runtimeCount);
    cursor += runtimeCount;
    const appCount = values[cursor++];
    let low = 0;
    let high = Math.floor(
      runtimes.reduce((sum, runtime) => sum + runtime, 0) / appCount,
    );
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const supplied = runtimes.reduce(
        (sum, runtime) => sum + Math.min(runtime, middle),
        0,
      );
      if (supplied >= middle * appCount) low = middle;
      else high = middle - 1;
    }
    assert.equal(cursor, values.length);
    assert.equal(testcase.output, String(low));
  }

  const node = readExample("testcases-multiple.json", true)[0];
  for (const testcase of node.test_cases) {
    const values = testcase.input.trim().split(/\s+/).map(Number);
    const size = values[0];
    const inorder = values.slice(1, size + 1);
    const postorder = values.slice(size + 1, size * 2 + 1);
    assert.equal(values.length, size * 2 + 1);
    const positions = new Map(inorder.map((value, index) => [value, index]));
    let postorderIndex = postorder.length - 1;
    const build = (left, right) => {
      if (left > right) return null;
      const value = postorder[postorderIndex--];
      const middle = positions.get(value);
      const root = { value, left: null, right: null };
      root.right = build(middle + 1, right);
      root.left = build(left, middle - 1);
      return root;
    };
    const queue = [build(0, inorder.length - 1)];
    const levelOrder = [];
    while (queue.some(Boolean)) {
      const current = queue.shift();
      if (!current) {
        levelOrder.push("null");
        continue;
      }
      levelOrder.push(String(current.value));
      queue.push(current.left, current.right);
    }
    while (levelOrder.at(-1) === "null") levelOrder.pop();
    const normalizeTreeOutput = (output) => {
      const tokens = output
        .trim()
        .split(/\s+/)
        .map((token) => (token === "N" ? "null" : token));
      while (tokens.at(-1) === "null") tokens.pop();
      return tokens.join(" ");
    };
    const expected = levelOrder.join(" ");
    assert.ok(
      testcase.outputs.every(
        (output) => normalizeTreeOutput(output) === expected,
      ),
    );
  }
});
