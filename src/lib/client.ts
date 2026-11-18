/** Small fetch helper for client components: JSON in, JSON out, errors thrown. */
export async function sendJson<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
  method: "POST" | "PATCH" | "DELETE" = "POST",
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;
  if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}
