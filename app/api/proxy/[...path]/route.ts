import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

async function proxy(request: NextRequest, path: string[]) {
  const url = `${API_URL}/api/${path.join("/")}${request.nextUrl.search}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // Forward cookies
  const cookie = request.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;

  const body = request.method !== "GET" ? await request.text() : undefined;

  const res = await fetch(url, {
    method: request.method,
    headers,
    body,
  });

  const data = await res.text();
  const response = new NextResponse(data, { status: res.status });
  response.headers.set("Content-Type", "application/json");

  // get() joins Set-Cookie with a comma and splits the Expires date, so the
  // browser keeps a session cookie and drops it when the app quits.
  const setCookies =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
