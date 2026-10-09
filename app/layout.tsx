import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import Navigation from "@/components/navigation"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "Phone Specs Finder",
  description: "Search phone specifications and product images from Avechi.",
  generator: "v0.app",
}

const geistSans = Geist({ subsets: ["latin"] })
const geistMono = Geist_Mono({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <Suspense fallback={<div>Loading...</div>}>
          <Navigation />
          <div className="pt-20">{children}</div>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
