import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Phone ID is required" }, { status: 400 })
  }

  try {
    // Import the gsmarena-api package dynamically
    const gsmarena = await import("gsmarena-api")

    // Get detailed phone specifications
    const details = await gsmarena.catalog.getDevice(id)

    return NextResponse.json(details)
  } catch (error) {
    console.error("Details error:", error)
    return NextResponse.json({ error: "Failed to get phone details" }, { status: 500 })
  }
}
