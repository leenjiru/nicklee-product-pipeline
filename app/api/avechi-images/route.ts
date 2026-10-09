import { type NextRequest, NextResponse } from "next/server"

const BASE_URL = "https://avechi.co.ke"
const SEARCH_URL = `${BASE_URL}/?s=`
const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
}

const absoluteUrl = (value: string) => new URL(value, BASE_URL).href
const cleanImageUrl = (value: string) => absoluteUrl(value).replace(/-\d+x\d+(\.[a-z]+)(\?.*)?$/i, "$1$2")

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim()
  const maxProducts = Math.min(Math.max(Number(request.nextUrl.searchParams.get("maxProducts")) || 8, 1), 20)
  const maxImages = Math.min(Math.max(Number(request.nextUrl.searchParams.get("maxImages")) || 8, 1), 15)

  if (!query) return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })

  try {
    const searchResponse = await fetch(`${SEARCH_URL}${encodeURIComponent(query)}&post_type=product`, { headers, next: { revalidate: 300 } })
    if (!searchResponse.ok) throw new Error(`Avechi search failed: ${searchResponse.status}`)
    const searchHtml = await searchResponse.text()
    const productUrls: string[] = []
    const seenProducts = new Set<string>()
    const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
    for (const match of searchHtml.matchAll(linkPattern)) {
      const href = absoluteUrl(match[1]).split("?")[0]
      if (!href.includes("/product/") || href.replace(/\/$/, "").endsWith("/product") || seenProducts.has(href)) continue
      seenProducts.add(href)
      productUrls.push(href)
      if (productUrls.length >= maxProducts) break
    }

    const products = await Promise.all(productUrls.map(async (url) => {
      const response = await fetch(url, { headers, next: { revalidate: 3600 } })
      if (!response.ok) return null
      const html = await response.text()
      const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() || url.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Avechi product"
      const imageUrls: string[] = []
      const addImage = (value?: string) => {
        if (!value || !value.includes("/wp-content/uploads/") || /logo/i.test(value)) return
        const image = cleanImageUrl(value.replace(/&amp;/g, "&"))
        if (!imageUrls.includes(image)) imageUrls.push(image)
      }
      addImage(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1])
      const imagePattern = /<(?:img|source)[^>]+(?:data-large_image|data-src|src|srcset)=["']([^"']+)["'][^>]*>/gi
      for (const match of html.matchAll(imagePattern)) {
        for (const candidate of match[1].split(",")) addImage(candidate.trim().split(/\s+/)[0])
        if (imageUrls.length >= maxImages) break
      }
      return { title, url, images: imageUrls.slice(0, maxImages) }
    }))

    return NextResponse.json({ query, products: products.filter(Boolean) })
  } catch (error) {
    console.error("Avechi image search error:", error)
    return NextResponse.json({ error: "Unable to search Avechi right now" }, { status: 502 })
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

