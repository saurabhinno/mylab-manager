export async function gql(token: string, query: string, variables: Record<string, any> = {}) {
  const res = await fetch("/api/railway", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL Error");
  return json.data;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rw_token");
}

export function setToken(token: string) {
  localStorage.setItem("rw_token", token);
}

export function clearToken() {
  localStorage.removeItem("rw_token");
}
