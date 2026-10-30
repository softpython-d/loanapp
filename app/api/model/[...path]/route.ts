import { NextRequest, NextResponse } from "next/server";

const modelApiUrl = (process.env.MODEL_API_URL || "https://mlmodel-tul7.onrender.com").replace(/\/+$/, "");

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const endpoint = `${modelApiUrl}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  try {
    const response = await fetch(endpoint, {
      method: request.method,
      headers: request.method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The model service could not be reached.";
    return NextResponse.json({ detail: `Model service request failed: ${message}` }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
