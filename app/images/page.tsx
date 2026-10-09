"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Copy, Download, ExternalLink, ImageIcon, Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

interface ImageItem { url: string; filename: string }
interface SpecItem { name: string; value: string }
interface SpecGroup { category: string; specifications: SpecItem[] }
interface DetailsResponse {
  product: { name: string; price: string; description: string; detailSpec: SpecGroup[]; features: string[]; fullDescription: string; specImages: string[] }
  gsmarena: { name: string; quickSpec: SpecItem[]; detailSpec: SpecGroup[] } | null
}
interface Product { title: string; url: string; price?: string; description?: string; specs?: SpecGroup[]; images: ImageItem[] }

const proxied = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`
const cleanName = (filename: string) => filename.replace(/avechi/gi, "").replace(/[-_]{2,}/g, "-").replace(/^[-_]+|[-_]+$/g, "") || "product-image.jpg"

const clean = (value: string) => value.replace(/avechi/gi, "").trim()
const groupText = (group: SpecGroup) => `${group.category}\n${group.specifications.map((spec) => `${spec.name}: ${spec.value}`).join("\n")}`
function CopyButton({ value, label, size = "sm" }: { value: string; label: string; size?: "sm" | "icon" }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const area = document.createElement("textarea")
      area.value = value; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove()
    }
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={label}>{copied ? <Check /> : <Copy />}{size === "icon" ? null : <span>{copied ? "Copied" : label}</span>}</Button>
}

function DetailsPanel({ product }: { product: Product }) {
  const [data, setData] = useState<DetailsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setData(null); setError(null)
    fetch(`/api/net-details?url=${encodeURIComponent(product.url)}&title=${encodeURIComponent(product.title)}`)
      .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error || "Failed"); if (!cancelled) setData(json) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load details") })
    return () => { cancelled = true }
  }, [product.url, product.title])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Loading details…</p>

  const { product: p, gsmarena } = data
  const groups: SpecGroup[] = [...p.detailSpec, ...(gsmarena ? gsmarena.detailSpec.map((g) => ({ ...g, category: `${g.category} (GSMArena)` })) : [])]
  if (p.features.length) groups.push({ category: "Features", specifications: p.features.map((f) => ({ name: "•", value: f })) })
  const everything = [clean(p.name || product.title), p.price, p.description, ...groups.map(groupText)].filter(Boolean).join("\n\n")
  const empty = groups.length === 0 && !p.description && !p.fullDescription

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>{p.price && <p className="text-lg font-semibold">{p.price}</p>}{p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}</div>
        {!empty && <CopyButton value={everything} label="Copy all" />}
      </div>
      {gsmarena && gsmarena.quickSpec.some((q) => q.value) && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{gsmarena.quickSpec.filter((q) => q.value).map((q) => <div key={q.name} className="rounded-md bg-muted p-2"><p className="text-xs text-muted-foreground">{q.name}</p><p className="text-sm font-medium">{q.value}</p></div>)}</div>}
      {groups.map((group) => (
        <div key={group.category}>
          <div className="mb-1 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{group.category}</h3><CopyButton value={groupText(group)} label={`Copy ${group.category}`} size="icon" /></div>
          <dl className="divide-y rounded-md border text-sm">{group.specifications.map((spec, i) => <div key={`${spec.name}-${i}`} className="grid grid-cols-[2fr_3fr] gap-2 px-3 py-1.5"><dt className="text-muted-foreground">{spec.name}</dt><dd>{spec.value}</dd></div>)}</dl>
        </div>
      ))}
      {groups.length === 0 && p.fullDescription && <div><div className="mb-1 flex items-center justify-between"><h3 className="text-sm font-semibold">Description</h3><CopyButton value={p.fullDescription} label="Copy description" size="icon" /></div><p className="whitespace-pre-line text-sm">{p.fullDescription}</p></div>}
      {p.specImages.length > 0 && <div><h3 className="mb-1 text-sm font-semibold">Spec sheet images</h3><div className="space-y-2">{p.specImages.map((src) => <img key={src} src={proxied(src)} alt="Product specification sheet" className="w-full rounded-md border" loading="lazy" />)}</div></div>}
      {empty && p.specImages.length === 0 && <p className="text-sm text-muted-foreground">No specifications could be read from this product page.</p>}
    </div>
  )
}

export default function NetImagesPage() {
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<{ image: ImageItem; title: string; product: Product } | null>(null)

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
      {products.length > 0 && <div className="mt-12 space-y-10">{products.map((product) => <section key={product.url}><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold capitalize">{product.title.replace(/avechi/gi, "")}</h2><Link href={product.url} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">View product <ExternalLink /></Button></Link></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{product.images.map((image, index) => { const filename = cleanName(image.filename); return <Card key={`${image.url}-${index}`} className="overflow-hidden"><CardContent className="p-2"><button type="button" className="block w-full cursor-zoom-in text-left" onClick={() => setSelectedImage({ image: { ...image, filename }, title: product.title, product })} aria-label={`View ${filename}`}><div className="aspect-square overflow-hidden rounded-md bg-muted"><img src={proxied(image.url)} alt={`${product.title.replace(/avechi/gi, "")} ${filename}`} className="h-full w-full object-contain" loading="lazy" onError={(e) => { e.currentTarget.src = "/modern-smartphone.png" }} /></div><p className="mt-2 truncate text-xs text-muted-foreground" title={filename}>Filename: {filename}</p></button></CardContent></Card> })}</div></section>)}</div>}
      {!loading && query && products.length === 0 && !error && <p className="mt-16 text-center text-muted-foreground">No product images found. Try a broader search.</p>}
      {selectedImage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Product details" onClick={() => setSelectedImage(null)}><div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-background p-4 sm:p-6" onClick={(event) => event.stopPropagation()}><button type="button" className="absolute right-3 top-3 z-10 rounded-full bg-background/90 p-2" onClick={() => setSelectedImage(null)} aria-label="Close details"><X /></button><h2 className="pr-10 text-xl font-semibold capitalize">{clean(selectedImage.title)}</h2><div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"><div className="md:sticky md:top-0 md:self-start"><img src={proxied(selectedImage.image.url)} alt={`${selectedImage.title} ${selectedImage.image.filename}`} className="mx-auto max-h-[50vh] w-full object-contain" /><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 truncate text-xs font-medium">{selectedImage.image.filename}</p><div className="flex gap-2"><CopyButton value={selectedImage.image.url} label="Copy link" /><a href={proxied(selectedImage.image.url)} download={selectedImage.image.filename} target="_blank" rel="noreferrer"><Button size="sm"><Download /> Download</Button></a></div></div></div><DetailsPanel product={selectedImage.product} /></div></div></div>}
    </main>
  )
}
