/** fetch + JSON that always consumes the body, so a failed (e.g. 503) response never leaves a request hanging open. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    await res.text().catch(() => undefined);
    throw new Error(`${res.status}`);
  }
  return res.json() as Promise<T>;
}
