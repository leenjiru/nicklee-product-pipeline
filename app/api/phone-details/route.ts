import { type NextRequest, NextResponse } from "next/server"
import { getAvechiDevice, getGsmarenaDevice, isAvechiId } from "@/lib/phone-sources"

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Phone ID is required" }, { status: 400 })

  try {
    const details = isAvechiId(id) ? await getAvechiDevice(id) : await getGsmarenaDevice(id)
    return NextResponse.json(details)
  } catch (error) {
    console.error("Details error:", error)
    return NextResponse.json({ error: "Failed to get phone details" }, { status: 502 })
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
