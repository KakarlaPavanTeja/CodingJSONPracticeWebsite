# Coding JSON Preparation

A browser-only dashboard for creating, updating, validating, and previewing
platform-ready `coding_questions.json` files.

Freelancers use the dashboard to prepare the final JSON and share it with the
source Lua, testcase JSON, and preparation summary. The internal team performs
the final review and platform loading.

The application has no backend and makes no network requests. Uploaded files stay
inside the browser. Author Lua drafts are saved to `localStorage` until cleared;
other session uploads are discarded when the page is closed.

## What it does

- Authors packaged Lua in the browser (Author Lua) with a draft autosaved to
  Chrome `localStorage`. **Use in Prepare JSON** fills the Lua slot without a
  re-upload; download `question.lua` remains available.
- Creates a new practice coding-question JSON from packaged Lua and testcase JSON.
- Updates an existing coding-question JSON while preserving stable IDs.
- Supports standard and node-based questions.
- Supports function and non-function execution styles.
- Filters C++, Python, Java, and Node.js output to selected languages.
- Validates testcase inputs, outputs, weights, orders, tags, and multiple outputs.
- Shows preflight warnings, an output summary, update changes, and the complete JSON
  before download.
- Provides internal-team-only ID regeneration for explicitly authorized imports.

AI content generation and usage tracking are intentionally not part of this project.
Hints, real-life examples, and follow-up questions already present in the Lua file
are still packaged into the final JSON.

## Run locally

Because the application uses browser ES modules, serve the repository over HTTP:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/frontend/
```

Use **Author Lua** (`#author`) to edit the full Lua contract. Drafts persist in
this browser until you clear them. From Author, choose **Use in Prepare JSON** to
continue with testcases, or download `question.lua` separately.
## Inputs

### Create

- Packaged `.lua`
- Testcase `.json`

### Update

- Existing `coding_questions.json`
- Packaged `.lua`
- Testcase `.json`

Testcases may use either supported root:

```json
{
  "test_cases": []
}
```

or:

```json
[
  {
    "test_cases": []
  }
]
```

Every testcase requires:

- non-empty string `input`
- non-empty string `output`, or non-empty `outputs` when
  `multiple_possible_output` is `true`
- strictly positive numeric `weightage`
- `order` (normalized sequentially during preparation)
- at least one valid `tags` entry

V4 tags such as `example`, `subtask_1`, `size_small`, and `stress` are preserved
and converted into platform tag objects.

The content policy uses batched `t` input for binary-result problems such as
Yes/No or True/False. Other output types use one logical case per JSON testcase.
The statement, all language harnesses, solutions, and testcase inputs must follow
the same selected format.

## Checked-in examples

The repository includes updated local versions of all six samples linked by the
original platform. These local files follow the current testcase, tag, language,
node-header, enrichment, and solution contract:

- [`examples/standard-with-content.lua`](examples/standard-with-content.lua)
- [`examples/standard-outline.lua`](examples/standard-outline.lua)
- [`examples/node-with-content.lua`](examples/node-with-content.lua)
- [`examples/node-outline.lua`](examples/node-outline.lua)
- [`examples/testcases-single.json`](examples/testcases-single.json)
- [`examples/testcases-multiple.json`](examples/testcases-multiple.json)

## Tests

The transformation logic is isolated from the UI and tested with Node's built-in
test runner:

```bash
npm test
```

The suite covers testcase schema variants, tagged cases, multiple outputs, weight
validation, stable IDs, create/update behavior, non-function output, node handling,
ID regeneration, and Lua draft assemble/parse round-trips.

## Deployment

Deploy as a static site with `frontend/` as the output directory. No Python
runtime, API key, Render service, database, or server process is required.

### Vercel

This repo includes a root `vercel.json` that serves `frontend/` at the site root
with no build step.

**Option A — GitHub (recommended)**

1. Commit and push to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Leave Framework Preset as **Other**. Vercel will read `vercel.json`.
4. Deploy. The site URL will serve `frontend/index.html`.

Production URL after the initial deploy:

```text
https://coding-json-practice.vercel.app
```

**Option B — CLI**

```bash
npx vercel
```

For production:

```bash
npx vercel --prod
```

You can delete the old Render web service
(`codingjsonpracticewebsite.onrender.com`); it is no longer used.
