"""
OpenAI LLM client for CSV / content enrichment (default: gpt-5.4 via Responses API).
"""

from __future__ import annotations

import os
import re
import time
import requests

CHAT_URL = "https://api.openai.com/v1/chat/completions"
RESPONSES_URL = "https://api.openai.com/v1/responses"

_DEFAULT_MODEL = "gpt-5.4"
_DEFAULT_TIMEOUT_SEC = 300
_RETRYABLE_STATUS = frozenset({408, 429, 500, 502, 503, 504})


def _resolve_read_timeout_sec() -> int:
    raw = os.environ.get("OPENAI_READ_TIMEOUT_SEC", "").strip()
    if raw:
        return max(1, int(raw))
    return _DEFAULT_TIMEOUT_SEC


def _post_with_retries(url: str, headers: dict, payload: dict, timeout: int) -> requests.Response:
    max_retries = max(1, int(os.environ.get("OPENAI_MAX_RETRIES", "8")))
    base = float(os.environ.get("OPENAI_RETRY_BASE_SEC", "2"))
    last: requests.Response | None = None
    for attempt in range(max_retries):
        last = requests.post(url, headers=headers, json=payload, timeout=timeout)
        if last.status_code == 200:
            return last
        if attempt + 1 >= max_retries or last.status_code not in _RETRYABLE_STATUS:
            break
        wait = min(base * (2**attempt), 120.0)
        if last.status_code == 429:
            ra = last.headers.get("Retry-After")
            if ra:
                try:
                    wait = max(wait, float(ra))
                except ValueError:
                    pass
        print(
            f"OpenAI returned {last.status_code}, waiting {wait:.1f}s (attempt {attempt + 1}/{max_retries})...",
            flush=True,
        )
        time.sleep(wait)
    assert last is not None
    return last


def _normalize_usage(usage: dict) -> dict:
    if not usage:
        return {}
    return {
        "prompt_tokens": usage.get("prompt_tokens") or usage.get("input_tokens", 0),
        "completion_tokens": usage.get("completion_tokens") or usage.get("output_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
    }


def _text_from_responses_body(data: dict) -> str:
    parts: list[str] = []
    for item in data.get("output", []):
        if item.get("type") != "message":
            continue
        for block in item.get("content", []):
            if block.get("type") == "output_text" and "text" in block:
                parts.append(block["text"])
    return "".join(parts).strip()


def _resolve_model_and_route() -> tuple[str, str]:
    model = (
        os.environ.get("OPENAI_MODEL_ENRICHMENT", "").strip()
        or os.environ.get("OPENAI_MODEL", "").strip()
        or _DEFAULT_MODEL
    )
    mode = os.environ.get("OPENAI_API_MODE", "").strip().lower()
    if mode in {"responses", "chat"}:
        return model, mode
    m = model.lower().strip()
    if re.match(r"^gpt-5\.\d+$", m):
        return model, "responses"
    return model, "chat"


def call_llm(system_prompt: str, user_prompt: str, temperature: float = 1):
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Set OPENAI_API_KEY to use llm_client.py")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    model, route = _resolve_model_and_route()

    if route == "responses":
        url = RESPONSES_URL
        payload: dict = {
            "model": model,
            "input": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        if temperature != 1:
            payload["temperature"] = temperature
    else:
        url = CHAT_URL
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        if temperature != 1:
            payload["temperature"] = temperature

    timeout_sec = _resolve_read_timeout_sec()
    response = _post_with_retries(url, headers, payload, timeout=timeout_sec)
    if response.status_code != 200:
        raise RuntimeError(f"LLM call failed: {response.status_code} - {response.text}")

    data = response.json()
    if url == RESPONSES_URL:
        return _text_from_responses_body(data), _normalize_usage(data.get("usage") or {})

    choice0 = data["choices"][0]
    content = choice0["message"]["content"] if "message" in choice0 else choice0.get("text", "")
    return content, _normalize_usage(data.get("usage") or {})
