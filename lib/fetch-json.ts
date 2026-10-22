/** fetch + JSON for client components. Always reads the body, so failed responses don't leave connections open. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    await res.text().catch(() => undefined);
    throw new Error(`${url} answered ${res.status}`);
  }
  return (await res.json()) as T;
}
