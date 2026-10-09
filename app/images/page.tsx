"use client"

import { useState } from "react"
import Link from "next/link"
import { Download, ExternalLink, ImageIcon, Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

interface ImageItem { url: string; filename: string }
interface Product { title: string; url: string; images: ImageItem[] }

const proxied = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`
const cleanName = (filename: string) => filename.replace(/avechi/gi, "").replace(/[-_]{2,}/g, "-").replace(/^[-_]+|[-_]+$/g, "") || "product-image.jpg"

export default function NetImagesPage() {
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<{ image: ImageItem; title: string } | null>(null)

  async function search() {
    if (!query.trim()) return
    setLoading(true); setError(null)
    try {
      const response = await fetch(`/api/net-images?query=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Search failed")
      setProducts(data.products || [])
    } catch (err) { setError(err instanceof Error ? err.message : "Search failed") } finally { setLoading(false) }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl pt-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white"><ImageIcon /></div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Net image search</h1>
        <p className="mt-3 text-muted-foreground">Find product images matching your search.</p>
        <form className="mt-7 flex gap-2" onSubmit={(event) => { event.preventDefault(); search() }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products, e.g. Samsung Galaxy" aria-label="Search net products" />
          <Button type="submit" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Search />}<span className="hidden sm:inline">Search</span></Button>
        </form>
      </div>
      {error && <p className="mx-auto mt-8 max-w-3xl rounded-lg bg-destructive/10 p-4 text-center text-destructive">{error}</p>}
      {products.length > 0 && <div className="mt-12 space-y-10">{products.map((product) => <section key={product.url}><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold capitalize">{product.title.replace(/avechi/gi, "")}</h2><Link href={product.url} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">View product <ExternalLink /></Button></Link></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{product.images.map((image, index) => { const filename = cleanName(image.filename); return <Card key={`${image.url}-${index}`} className="overflow-hidden"><CardContent className="p-2"><button type="button" className="block w-full cursor-zoom-in text-left" onClick={() => setSelectedImage({ image: { ...image, filename }, title: product.title })} aria-label={`View ${filename}`}><div className="aspect-square overflow-hidden rounded-md bg-muted"><img src={proxied(image.url)} alt={`${product.title.replace(/avechi/gi, "")} ${filename}`} className="h-full w-full object-contain" loading="lazy" onError={(e) => { e.currentTarget.src = "/modern-smartphone.png" }} /></div><p className="mt-2 truncate text-xs text-muted-foreground" title={filename}>Filename: {filename}</p></button></CardContent></Card> })}</div></section>)}</div>}
      {!loading && query && products.length === 0 && !error && <p className="mt-16 text-center text-muted-foreground">No product images found. Try a broader search.</p>}
      {selectedImage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Image details" onClick={() => setSelectedImage(null)}><div className="relative max-h-[90vh] w-full max-w-3xl rounded-xl bg-background p-4" onClick={(event) => event.stopPropagation()}><button type="button" className="absolute right-3 top-3 rounded-full bg-background/90 p-2" onClick={() => setSelectedImage(null)} aria-label="Close image details"><X /></button><img src={proxied(selectedImage.image.url)} alt={`${selectedImage.title} ${selectedImage.image.filename}`} className="mx-auto max-h-[70vh] w-full object-contain" /><div className="mt-4 flex items-center justify-between gap-4"><p className="truncate text-sm font-medium">{selectedImage.image.filename}</p><a href={proxied(selectedImage.image.url)} download={selectedImage.image.filename} target="_blank" rel="noreferrer"><Button><Download /> Download</Button></a></div></div></div>}
    </main>
  )
}
