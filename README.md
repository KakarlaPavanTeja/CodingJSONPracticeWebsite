# Coding JSON Preparation

A browser dashboard for authoring Lua, optionally executing C++/Python/Java
reference solutions against session-uploaded testcases, then creating and
validating platform-ready `coding_questions.json` files.

Freelancers use the dashboard to prepare the final JSON and share it with the
source Lua, testcase JSON, and preparation summary. The internal team performs
the final review and platform loading.

Author Lua drafts are saved to `localStorage`. Execute testcases are
**session-only** (re-upload after refresh). Prepare uploads stay in the browser
until the page is closed. Compiler credentials never ship in the frontend; runs
go through same-origin API routes.

## What it does

- Authors packaged Lua in the browser (Author Lua) with a draft autosaved to
  Chrome `localStorage`. **Use in Prepare JSON** fills the Lua slot without a
  re-upload; download `question.lua` remains available.
- **Execute** (C++ / Python / Java): upload `testcases.json` for the session,
  run the reference solution from the Lua draft, inspect pass/fail and errors,
  edit code, **Save to Lua draft**, and re-run. **Node.js execution is not
  supported in this tool** — verify Node.js on the platform after the question
  is loaded.
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

Static UI only (no compiler — Execute buttons will fail):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/frontend/`.

For **Execute** and **Execute Final JSON** (real `/api/compile` proxy):

```bash
cp .env.example .env
# fill COMPILER_BASE_URL and AWS_* in .env (never commit)
npm install
npm run dev
```

Then open `http://127.0.0.1:3000/` (rewrites match production: UI at `/`,
`#execute-final` for final JSON).

`npm run dev` starts `scripts/local-dev.mjs`, which serves the UI and proxies
`/api/compile` + `/api/status/*` through the same handlers as Vercel to
`COMPILER_BASE_URL`. A plain `python3 -m http.server` will not hit the
original compiler.

Use **Author Lua** (`#author`) to edit the full Lua contract. Drafts persist in
this browser until you clear them. Use **Execute** (`#execute`) after the Lua
draft and a session testcase upload are ready, or **Execute Final JSON** with a
packaged `coding_questions.json`.

Set these on Vercel (Production / Preview) or in `.env` for `vercel dev`:
`COMPILER_BASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_REGION`, `S3_BUCKET`, optional `S3_PREFIX`. Do not commit real secrets.
If AWS keys were ever shared in chat, rotate them after configuring Vercel.

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
