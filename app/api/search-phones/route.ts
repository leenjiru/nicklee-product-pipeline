import { type NextRequest, NextResponse } from "next/server"

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim()
  if (!query) return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })

  try {
    const gsmarena = await import("gsmarena-api")
    const results = await gsmarena.search.search(query)
    const normalized = Array.isArray(results) ? results.map((item: any) => ({
      ...item,
      name: item.name || item.title || query,
      url: item.url || (item.id ? `https://www.gsmarena.com/${item.id}.php` : `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(query)}`),
      img: typeof item.img === "string" && item.img.startsWith("http") ? item.img : "",
      description: item.description || `Search GSMArena for ${item.name || query}`,
    })).filter((item: any) => item.name && item.url).slice(0, 20) : []
    if (normalized.length > 0) return NextResponse.json(normalized)

    return NextResponse.json([{ id: slug(query), name: query, img: "", description: `Search GSMArena for ${query}`, url: `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(query)}` }])
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json([{ id: slug(query), name: query, img: "", description: `Search GSMArena for ${query}`, url: `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(query)}` }])
  }
}
