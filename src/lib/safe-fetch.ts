import { assertPublicHttpUrl } from "./ssrf-guard";
export async function safeText(
  raw: string,
): Promise<{ ok: boolean; text: string; status: number }> {
  let url = raw;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHttpUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("invalid_redirect");
      url = new URL(location, url).toString();
      await response.body?.cancel();
      continue;
    }
    const reader = response.body?.getReader();
    let text = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    if (reader) {
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 512000) throw new Error("response_too_large");
          text += decoder.decode(chunk.value, { stream: true });
        }
      } finally {
        await reader.cancel();
      }
    }
    return { ok: response.ok, text, status: response.status };
  }
  throw new Error("too_many_redirects");
}
