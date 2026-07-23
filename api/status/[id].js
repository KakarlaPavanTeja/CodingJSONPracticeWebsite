import { allowCors, json } from "../_lib/config.js";
import { fetchStatus, sanitizeStatus } from "../_lib/compiler.js";

export default async function handler(req, res) {
  allowCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const requestId =
      req.query?.id ||
      (typeof req.url === "string"
        ? decodeURIComponent(req.url.split("?")[0].split("/").pop() || "")
        : "");
    if (!requestId || requestId === "status") {
      json(res, 400, { error: "request id is required" });
      return;
    }
    const data = await fetchStatus(requestId);
    json(res, 200, data);
  } catch (error) {
    if (error.data) {
      json(res, error.status || 502, sanitizeStatus(error.data));
      return;
    }
    json(res, error.status && error.status >= 400 ? error.status : 502, {
      status: "ERROR",
      error: error.message || "Status proxy failed",
      results: [],
    });
  }
}
