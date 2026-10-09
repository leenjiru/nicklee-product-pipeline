import { type NextRequest, NextResponse } from "next/server"
import { searchAvechi, searchGsmarena, type PhoneSearchResult } from "@/lib/phone-sources"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim()
  if (!query) return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })

  // Run both sources together; GSMArena results come first, Avechi fills in when GSMArena is blocked or has no match.
  const [gsm, avechi] = await Promise.allSettled([searchGsmarena(query), searchAvechi(query)])
  const results: PhoneSearchResult[] = [
    ...(gsm.status === "fulfilled" ? gsm.value : []),
    ...(avechi.status === "fulfilled" ? avechi.value : []),
  ]
  if (gsm.status === "rejected") console.error("GSMArena search error:", gsm.reason)
  if (avechi.status === "rejected") console.error("Avechi search error:", avechi.reason)

  if (results.length === 0 && gsm.status === "rejected" && avechi.status === "rejected") {
    return NextResponse.json({ error: "Phone sources are unreachable right now" }, { status: 502 })
  }
  return NextResponse.json(results.slice(0, 30))
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
