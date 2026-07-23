import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getS3Config, s3Configured } from "./config.js";

let client = null;

function getClient() {
  if (client) return client;
  const cfg = getS3Config();
  client = new S3Client({
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return client;
}

function slugify(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "question"
  );
}

function publicUrl(bucket, region, key) {
  return `http://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Upload STDIN blob to S3. Returns public URL or null on failure.
 */
export async function uploadInputBlob({
  contents,
  questionId = "draft",
  questionName = "question",
  order = 1,
}) {
  if (!s3Configured()) return null;
  const cfg = getS3Config();
  const qid = String(questionId || "draft").trim() || "draft";
  const filename = `${qid}_${slugify(questionName)}_testcases_${order}_input.txt`;
  const key = `${cfg.prefix.replace(/\/?$/, "/")}${filename}`.replace(
    /\/+/g,
    "/",
  );

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key.replace(/^\//, ""),
        Body: contents || "",
        ContentType: "text/plain; charset=utf-8",
      }),
    );
    return publicUrl(cfg.bucket, cfg.region, key.replace(/^\//, ""));
  } catch {
    return null;
  }
}
