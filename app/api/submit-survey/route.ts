import { NextResponse } from "next/server";

// Retired — all review submissions now go through /api/review/submit
export async function POST() {
  console.error("[submit-survey] This endpoint is retired. Client is calling a deprecated route.");
  return NextResponse.json({ error: "This endpoint has been retired. Please use /review/<token>." }, { status: 410 });
}
