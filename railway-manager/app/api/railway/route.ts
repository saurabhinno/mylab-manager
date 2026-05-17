import { NextRequest, NextResponse } from "next/server";

const RAILWAY_API = "https://backboard.railway.app/graphql/v2";

export async function POST(request: NextRequest) {
  const { query, variables, token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const res = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
