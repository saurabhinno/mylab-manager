export async function apiRequest(path: string, options: RequestInit = {}) {
  // Route through same-origin proxy to avoid CORS
  // path comes in as "/api/auth/login" → proxy at "/api/proxy/auth/login"
  const proxyPath = path.replace("/api/", "/api/proxy/");
  const res = await fetch(proxyPath, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}
