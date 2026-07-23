/**
 * Shared server config. Secrets come only from process.env (Vercel).
 */

export const LARGE_IO_THRESHOLD_BYTES = 50 * 1024;

export function getCompilerBaseUrl() {
  const url = (process.env.COMPILER_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!url) {
    throw new Error("COMPILER_BASE_URL is not configured");
  }
  return url;
}

export function getS3Config() {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    region: process.env.AWS_REGION || "ap-south-1",
    bucket: process.env.S3_BUCKET || "new-assets.ccbp.in",
    prefix: process.env.S3_PREFIX || "testing-coding-question-test-cases/",
  };
}

export function s3Configured() {
  const cfg = getS3Config();
  return Boolean(cfg.accessKeyId && cfg.secretAccessKey && cfg.bucket);
}

/** Client language token -> v3 orchestrator language id (string). */
export const LANGUAGE_IDS = {
  cpp: "7",
  python: "22",
  java: "30",
};

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export function allowCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
