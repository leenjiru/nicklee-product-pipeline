import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const imageUrl = searchParams.get("url")

  if (!imageUrl) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
  }

  try {
    const parsedUrl = new URL(imageUrl)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Unsupported image URL" }, { status: 400 })
    }

    const response = await fetch(parsedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }

    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") || "image/jpeg"

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error("Proxy image error:", error)
    return NextResponse.json({ error: "Failed to proxy image" }, { status: 500 })
  }
}
