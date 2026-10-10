import { type NextRequest, NextResponse } from "next/server"

// Calls the Instaloader service in /instagram-service. Configure on the Next.js host:
//   INSTAGRAM_SERVICE_URL   e.g. https://ig.example.com
//   INSTAGRAM_SERVICE_TOKEN same value as SERVICE_TOKEN on the service
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim()
  if (!query) return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })

  const base = process.env.INSTAGRAM_SERVICE_URL?.replace(/\/$/, "")
  const token = process.env.INSTAGRAM_SERVICE_TOKEN
  if (!base || !token) {
    return NextResponse.json({ error: "Instagram search isn't set up yet (INSTAGRAM_SERVICE_URL / INSTAGRAM_SERVICE_TOKEN missing)", notConfigured: true }, { status: 503 })
  }

  try {
    const response = await fetch(`${base}/search?query=${encodeURIComponent(query)}`, {
      headers: { "X-Service-Token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data) return NextResponse.json({ error: data?.error || "Instagram service failed" }, { status: 502 })
    return NextResponse.json({ query: data.query, posts: data.posts || [], errors: data.errors || [] })
  } catch (error) {
    console.error("Instagram search error:", error)
    return NextResponse.json({ error: "Couldn't reach the Instagram service" }, { status: 502 })
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
