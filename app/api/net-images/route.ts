import { type NextRequest, NextResponse } from "next/server"

const BASE_URL = "https://avechi.co.ke"
const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
}

const absoluteUrl = (value: string) => new URL(value, BASE_URL).href
const cleanImageUrl = (value: string) => absoluteUrl(value).replace(/-\d+x\d+(\.[a-z]+)(\?.*)?$/i, "$1$2")
const imageFilename = (value: string) => decodeURIComponent(new URL(value).pathname.split("/").pop() || "image")

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim()
  const maxProducts = Math.min(Math.max(Number(request.nextUrl.searchParams.get("maxProducts")) || 8, 1), 20)
  const maxImages = Math.min(Math.max(Number(request.nextUrl.searchParams.get("maxImages")) || 8, 1), 15)
  if (!query) return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })

  try {
    const searchResponse = await fetch(`${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=product`, { headers, cache: "no-store" })
    if (!searchResponse.ok) throw new Error(`Net search failed: ${searchResponse.status}`)
    const searchHtml = await searchResponse.text()
    const productUrls: string[] = []
    const seenProducts = new Set<string>()
    for (const match of searchHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
      const href = absoluteUrl(match[1]).split("?")[0]
      if (!href.includes("/product/") || seenProducts.has(href)) continue
      seenProducts.add(href); productUrls.push(href)
      if (productUrls.length >= maxProducts) break
    }

    const products = await Promise.all(productUrls.map(async (url) => {
      const response = await fetch(url, { headers, cache: "no-store" })
      if (!response.ok) return null
      const html = await response.text()
      const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() || "Net product"
      const images: { url: string; filename: string }[] = []
      const addImage = (value?: string) => {
        if (!value || !value.includes("/wp-content/uploads/") || /logo/i.test(value)) return
        const image = cleanImageUrl(value.replace(/&amp;/g, "&"))
        if (!images.some((item) => item.url === image)) images.push({ url: image, filename: imageFilename(image) })
      }
      addImage(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1])
      for (const match of html.matchAll(/<(?:img|source)[^>]+(?:data-large_image|data-src|src|srcset)=["']([^"']+)["'][^>]*>/gi)) {
        for (const candidate of match[1].split(",")) addImage(candidate.trim().split(/\s+/)[0])
        if (images.length >= maxImages) break
      }
      return { title, url, images: images.slice(0, maxImages) }
    }))
    return NextResponse.json({ query, products: products.filter(Boolean) })
  } catch (error) {
    console.error("Net image search error:", error)
    return NextResponse.json({ error: "Unable to search net images right now" }, { status: 502 })
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
