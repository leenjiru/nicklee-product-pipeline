import { type NextRequest, NextResponse } from "next/server"
import { findGsmarenaSpecs, parseAvechiProduct } from "@/lib/phone-sources"

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim()
  let parsed: URL
  try { parsed = new URL(url || "") } catch { return NextResponse.json({ error: "Valid product url is required" }, { status: 400 }) }
  if (parsed.origin !== "https://avechi.co.ke" || !parsed.pathname.includes("/product/")) {
    return NextResponse.json({ error: "Only Avechi product pages are supported" }, { status: 400 })
  }

  try {
    const response = await fetch(parsed.href, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) })
    if (!response.ok) throw new Error(`Product page responded ${response.status}`)
    const product = parseAvechiProduct(await response.text())
    const gsmarena = await findGsmarenaSpecs(product.name || request.nextUrl.searchParams.get("title") || "")
    return NextResponse.json({ url: parsed.href, product, gsmarena })
  } catch (error) {
    console.error("Net details error:", error)
    return NextResponse.json({ error: "Unable to load product details right now" }, { status: 502 })
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
