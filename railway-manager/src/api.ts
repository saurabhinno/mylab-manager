import fetch from "node-fetch";
import { getToken } from "./config";

const RAILWAY_API = "https://backboard.railway.app/graphql/v2";

export async function gql(query: string, variables: Record<string, any> = {}) {
  const token = getToken();
  if (!token) {
    throw new Error("No Railway API token configured. Run: rw auth login");
  }

  const res = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as any;
  if (json.errors) {
    throw new Error(json.errors.map((e: any) => e.message).join("\n"));
  }
  return json.data;
}
