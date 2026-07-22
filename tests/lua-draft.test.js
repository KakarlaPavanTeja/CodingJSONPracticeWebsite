import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseSection } from "../frontend/json-prep.js";
import {
  assembleLua,
  emptyDraft,
  parseLuaToDraft,
} from "../frontend/lua-draft.js";

function readExample(filename) {
  return readFileSync(
    new URL(`../examples/${filename}`, import.meta.url),
    "utf8",
  );
}

function assertMarkerPair(lua, name) {
  assert.match(lua, new RegExp(`----------${name}_START----------`));
  assert.match(lua, new RegExp(`----------${name}_END----------`));
}

const STANDARD_MARKERS = [
  "QUESTION_DESCRIPTION",
  "SHORT_TEXT",
  "QUESTION_LEVEL",
  "COMPANIES",
  "DEFAULT_TAGS",
  "BEGINNER_TOPICS",
  "INTERMEDIATE_TOPICS",
  "ADVANCED_TOPICS",
  "REAL_LIFE_EXAMPLES",
  "FOLLOW_UP_QUESTIONS",
  "HINTS",
  "CODE_CONTENT_CPP",
  "CODE_CONTENT_PYTHON",
  "CODE_CONTENT_JAVA",
  "CODE_CONTENT_NODE_JS",
  "DEBUG_HELPER_CODE_CPP",
  "DEBUG_HELPER_CODE_PYTHON",
  "DEBUG_HELPER_CODE_JAVA",
  "CODE_BASE64_CPP",
  "CODE_BASE64_PYTHON",
  "CODE_BASE64_JAVA",
  "CODE_BASE64_NODE_JS",
  "SOLUTIONS_CPP",
  "SOLUTIONS_PYTHON",
  "SOLUTIONS_JAVA",
  "SOLUTIONS_NODE_JS",
];

test("assembleLua(parseLuaToDraft(standard outline)) preserves markers and empty sections", () => {
  const outline = readExample("standard-outline.lua");
  const draft = parseLuaToDraft(outline, "standard");
  assert.equal(draft.structure, "standard");
  assert.equal(draft.QUESTION_DESCRIPTION, "");
  assert.equal(draft.NODE_H_CONTENT, "");

  const assembled = assembleLua(draft);
  for (const name of STANDARD_MARKERS) {
    assertMarkerPair(assembled, name);
  }
  assert.doesNotMatch(assembled, /NODE_H_CONTENT_START/);

  const roundTrip = parseLuaToDraft(assembled, "standard");
  assert.deepEqual(roundTrip.hints, ["", "", ""]);
  assert.deepEqual(roundTrip.followUps, [
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);
  assert.equal(roundTrip.languages.CPP.codeContent, "");
  assert.equal(roundTrip.languages.CPP.debugPre, "");
});

test("variable hint and follow-up counts round-trip and renumber on assemble", () => {
  const draft = emptyDraft("standard");
  draft.hints = ["First", "Second", "Third", "Fourth"];
  draft.followUps = [
    { question: "Q1", answer: "A1" },
    { question: "Q2", answer: "A2" },
    { question: "Q3", answer: "A3" },
  ];

  const assembled = assembleLua(draft);
  assert.match(assembled, /----------HINTS_START_4----------/);
  assert.match(assembled, /----------FOLLOW_UP_QUESTION_START_3----------/);
  assert.doesNotMatch(assembled, /----------HINTS_START_5----------/);

  const parsed = parseLuaToDraft(assembled, "standard");
  assert.deepEqual(parsed.hints, draft.hints);
  assert.deepEqual(parsed.followUps, draft.followUps);
});

test("populated sample sections survive round-trip for hints, follow-ups, and debug helpers", () => {
  const draft = emptyDraft("standard");
  draft.QUESTION_DESCRIPTION = "Add two values.";
  draft.SHORT_TEXT = "Add Values";
  draft.QUESTION_LEVEL = "MEDIUM";
  draft.hints = ["Start with the inputs.", "", "Return their sum."];
  draft.followUps = [
    { question: "Can overflow occur?", answer: "Use a wider type." },
    { question: "", answer: "" },
  ];
  draft.languages.CPP.codeContent = "int add(int a, int b) { return a + b; }";
  draft.languages.CPP.debugPre = "int before = 1;";
  draft.languages.CPP.debugPost = "int after = 2;";
  draft.languages.CPP.solution = "int add(int a, int b) { return a + b; }";
  draft.languages.PYTHON.codeBase64 = 'print("ok")';

  const assembled = assembleLua(draft);
  assert.equal(
    parseSection(assembled, "QUESTION_DESCRIPTION"),
    "Add two values.",
  );
  assert.match(assembled, /----------HINTS_START_1----------/);
  assert.match(assembled, /----------FOLLOW_UP_QUESTION_START_1----------/);

  const parsed = parseLuaToDraft(assembled, "standard");
  assert.equal(parsed.QUESTION_DESCRIPTION, "Add two values.");
  assert.equal(parsed.SHORT_TEXT, "Add Values");
  assert.deepEqual(parsed.hints, [
    "Start with the inputs.",
    "",
    "Return their sum.",
  ]);
  assert.deepEqual(parsed.followUps[0], {
    question: "Can overflow occur?",
    answer: "Use a wider type.",
  });
  assert.equal(
    parsed.languages.CPP.codeContent,
    draft.languages.CPP.codeContent,
  );
  assert.equal(parsed.languages.CPP.debugPre, "int before = 1;");
  assert.equal(parsed.languages.CPP.debugPost, "int after = 2;");
  assert.equal(parsed.languages.CPP.solution, draft.languages.CPP.solution);
  assert.equal(parsed.languages.PYTHON.codeBase64, 'print("ok")');

  const second = parseLuaToDraft(assembleLua(parsed), "standard");
  assert.deepEqual(second.hints, parsed.hints);
  assert.deepEqual(second.followUps, parsed.followUps);
  assert.equal(second.languages.CPP.debugPre, parsed.languages.CPP.debugPre);
});

test("node draft includes NODE_H_CONTENT markers", () => {
  const outline = readExample("node-outline.lua");
  const draft = parseLuaToDraft(outline);
  assert.equal(draft.structure, "node");

  draft.NODE_H_CONTENT = "#ifndef NODE_H\n#define NODE_H\n#endif";
  const assembled = assembleLua(draft);
  assertMarkerPair(assembled, "NODE_H_CONTENT");
  assert.equal(
    parseSection(assembled, "NODE_H_CONTENT"),
    "#ifndef NODE_H\n#define NODE_H\n#endif",
  );

  const roundTrip = parseLuaToDraft(assembled);
  assert.equal(roundTrip.structure, "node");
  assert.equal(roundTrip.NODE_H_CONTENT, draft.NODE_H_CONTENT);

  for (const name of STANDARD_MARKERS) {
    assertMarkerPair(assembled, name);
  }
});

test("emptyDraft defaults to standard with four languages", () => {
  const draft = emptyDraft();
  assert.equal(draft.structure, "standard");
  assert.equal(draft.hints.length, 1);
  assert.equal(draft.followUps.length, 1);
  assert.ok(draft.languages.CPP);
  assert.ok(draft.languages.NODE_JS);
});
