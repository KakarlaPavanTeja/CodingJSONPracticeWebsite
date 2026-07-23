import {
  LANGUAGE_IDS,
  allowCors,
  json,
  readJsonBody,
} from "./_lib/config.js";
import {
  buildCompilePayload,
  buildTestcasesPayload,
  submitCompile,
} from "./_lib/compiler.js";

export default async function handler(req, res) {
  allowCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const languageToken = String(body.language || "").toLowerCase();
    if (!LANGUAGE_IDS[languageToken]) {
      json(res, 400, {
        error: "Unsupported language. Use cpp, python, or java.",
      });
      return;
    }
    if (!Array.isArray(body.files) || body.files.length === 0) {
      json(res, 400, { error: "files are required" });
      return;
    }
    if (!Array.isArray(body.testcases) || body.testcases.length === 0) {
      json(res, 400, { error: "testcases are required" });
      return;
    }

    const meta = {
      questionId: body.questionId || "draft",
      questionName: body.questionName || body.shortText || "question",
    };
    const { payload: testcasesPayload, idIndex } = await buildTestcasesPayload(
      body.testcases,
      meta,
    );
    const compilePayload = buildCompilePayload({
      languageToken,
      files: body.files,
      mainFilePath: body.mainFilePath || body.main_file_path,
      timeLimit: body.timeLimit ?? body.default_execution_time_limit,
      testcasesPayload,
    });

    const submit = await submitCompile(compilePayload);
    const requestId = submit.request_id || null;

    json(res, 200, {
      request_id: requestId,
      id_index: idIndex,
      inline: !requestId
        ? {
            status: submit.status || "SUCCESS",
            response: submit.response || submit,
          }
        : null,
    });
  } catch (error) {
    const status = error.status && error.status >= 400 ? error.status : 502;
    json(res, status, {
      error: error.message || "Compile proxy failed",
    });
  }
}
