import { timingSafeEqual } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"

// Lets the owner see which Instagram accounts the Instaloader service has, and paste a fresh sessionid
// cookie when one is logged out. Guarded by INSTAGRAM_ADMIN_PASSWORD (sent as the X-Admin-Password header).

function allowed(request: NextRequest) {
  const expected = process.env.INSTAGRAM_ADMIN_PASSWORD || ""
  const given = request.headers.get("x-admin-password") || ""
  return expected.length > 0 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

async function forward(request: NextRequest, init?: RequestInit) {
  const base = process.env.INSTAGRAM_SERVICE_URL?.replace(/\/$/, "")
  const token = process.env.INSTAGRAM_SERVICE_TOKEN
  if (!base || !token) return NextResponse.json({ error: "Instagram search isn't set up yet" }, { status: 503 })
  if (!allowed(request)) {
    await new Promise((resolve) => setTimeout(resolve, 1000)) // slow down password guessing
    return NextResponse.json({ error: "Wrong password" }, { status: 401 })
  }
  try {
    const response = await fetch(`${base}/session`, {
      ...init,
      headers: { "X-Service-Token": token, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(50000),
    })
    const data = await response.json().catch(() => null)
    if (!data) return NextResponse.json({ error: "Instagram service failed" }, { status: 502 })
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Instagram session error:", error)
    return NextResponse.json({ error: "Couldn't reach the Instagram service" }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  return forward(request)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return forward(request, { method: "POST", body: JSON.stringify({ sessionid: String(body.sessionid || "") }) })
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
