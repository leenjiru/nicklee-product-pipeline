import { type NextRequest, NextResponse } from "next/server"

// Every photo and the full caption of one Instagram post, from the Instaloader service (see /api/instagram-images)
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim()
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: "id parameter is required" }, { status: 400 })

  const base = process.env.INSTAGRAM_SERVICE_URL?.replace(/\/$/, "")
  const token = process.env.INSTAGRAM_SERVICE_TOKEN
  if (!base || !token) {
    return NextResponse.json({ error: "Instagram search isn't set up yet (INSTAGRAM_SERVICE_URL / INSTAGRAM_SERVICE_TOKEN missing)", notConfigured: true }, { status: 503 })
  }

  try {
    const response = await fetch(`${base}/post?id=${id}`, {
      headers: { "X-Service-Token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data) return NextResponse.json({ error: data?.error || "Instagram service failed" }, { status: response.status === 429 ? 429 : 502 })
    return NextResponse.json(data)
  } catch (error) {
    console.error("Instagram post error:", error)
    return NextResponse.json({ error: "Couldn't reach the Instagram service" }, { status: 502 })
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30
