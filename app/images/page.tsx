"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy, Download, ImageIcon, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ImageItem { url: string; filename: string }
interface SpecItem { name: string; value: string }
interface SpecGroup { category: string; specifications: SpecItem[] }
interface Product { title: string; url: string; images: ImageItem[] }
interface DetailsResponse {
  product: { name: string; sku: string; description: string; descriptionHtml: string; detailSpec: SpecGroup[]; features: string[]; fullDescription: string; specImages: string[] }
  gsmarena: { name: string; quickSpec: SpecItem[]; detailSpec: SpecGroup[] } | null
}

const proxied = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`
const clean = (value: string) => value.replace(/avechi/gi, "").replace(/\s+/g, " ").trim()
const cleanName = (filename: string) => filename.replace(/avechi/gi, "").replace(/[-_]{2,}/g, "-").replace(/^[-_]+|[-_]+$/g, "") || "product-image.jpg"
const groupText = (group: SpecGroup) => `${group.category}\n${group.specifications.map((spec) => `${spec.name}: ${spec.value}`).join("\n")}`

function CopyButton({ value, label, icon = false, html }: { value: string | (() => string); label: string; icon?: boolean; html?: () => string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    const plain = typeof value === "function" ? value() : value
    try {
      if (html && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html()], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) })])
      } else {
        await navigator.clipboard.writeText(plain)
      }
    } catch {
      const area = document.createElement("textarea")
      area.value = plain; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove()
    }
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={label} className="flex items-center gap-2">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {!icon && (copied ? "Copied!" : label)}
    </Button>
  )
}

function ProductDetail({ product, onBack }: { product: Product; onBack: () => void }) {
  const [data, setData] = useState<DetailsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const descRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setData(null); setError(null); setActiveImage(0)
    fetch(`/api/net-details?url=${encodeURIComponent(product.url)}&title=${encodeURIComponent(product.title)}`)
      .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error || "Failed to load details"); if (!cancelled) setData(json) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load details") })
    return () => { cancelled = true }
  }, [product.url, product.title])

  const title = clean(data?.product.name || product.title)
  const image = product.images[activeImage]
  const p = data?.product
  const gsm = data?.gsmarena
  const quickSpec = (gsm?.quickSpec || []).filter((spec) => spec.value)
  const detailGroups: SpecGroup[] = [
    ...(p?.detailSpec || []),
    ...(p && p.features.length ? [{ category: "Features", specifications: p.features.map((value) => ({ name: "•", value })) }] : []),
    ...(gsm?.detailSpec || []).map((group) => ({ ...group, category: `${group.category} (GSMArena)` })),
  ]
  const everything = [title, p?.sku && `SKU: ${p.sku}`, p?.description, ...detailGroups.map(groupText)].filter(Boolean).join("\n\n")
  const nothing = data && detailGroups.length === 0 && quickSpec.length === 0 && !p?.fullDescription && !p?.description && p?.specImages.length === 0

  return (
    <div className="mx-auto mt-6 max-w-6xl space-y-6">
      <Button variant="outline" onClick={onBack}>← Back to Results</Button>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-3xl capitalize">{title}</CardTitle>
            <div className="flex gap-2">
              <CopyButton value={title} label="Copy Name" />
              {data && <CopyButton value={everything} label="Copy All" />}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              {image && <div className="mx-auto aspect-square max-w-md overflow-hidden rounded-lg bg-muted"><img src={proxied(image.url)} alt={title} className="h-full w-full object-contain" onError={(e) => { e.currentTarget.src = "/modern-smartphone.png" }} /></div>}
              {product.images.length > 1 && <div className="flex flex-wrap justify-center gap-2">{product.images.map((img, index) => <button key={img.url} type="button" onClick={() => setActiveImage(index)} className={`h-16 w-16 overflow-hidden rounded-md border-2 bg-muted ${index === activeImage ? "border-blue-600" : "border-transparent"}`} aria-label={`Show image ${index + 1}`}><img src={proxied(img.url)} alt="" className="h-full w-full object-contain" loading="lazy" /></button>)}</div>}
              <div className="flex flex-wrap justify-center gap-3">
                {image && <a href={proxied(image.url)} download={cleanName(image.filename)} target="_blank" rel="noreferrer"><Button variant="outline" className="flex items-center gap-2"><Download className="h-4 w-4" /> Download Image</Button></a>}
                {image && <CopyButton value={image.url} label="Copy Image Link" />}
              </div>
            </div>

            <div className="space-y-6">
              {!data && !error && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading product details...</p>}
              {error && <p className="text-destructive">{error}</p>}
              {p?.sku && <div><h3 className="mb-3 text-xl font-semibold">Product SKU</h3><div className="flex items-center gap-2 rounded-lg bg-muted p-3"><code className="flex-1 font-mono text-lg font-semibold text-blue-600 dark:text-blue-400">{p.sku}</code><CopyButton value={p.sku} label="Copy SKU" /></div></div>}
              {p?.descriptionHtml && (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-xl font-semibold">Description</h3><CopyButton label="Copy Description" value={() => descRef.current?.innerText || p.fullDescription} html={() => descRef.current?.innerHTML || p.descriptionHtml} /></div>
                  <div ref={descRef} className="space-y-3 text-sm leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:font-bold [&_h4]:font-bold [&_h5]:font-bold [&_h6]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_th]:text-left [&_tr:nth-child(odd)]:bg-muted/50 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: p.descriptionHtml }} />
                </div>
              )}
              {quickSpec.length > 0 && <div><h3 className="mb-3 text-xl font-semibold">Key Specifications</h3><div className="grid gap-2">{quickSpec.map((spec) => <div key={spec.name} className="flex items-center justify-between border-b py-2"><span className="font-medium">{spec.name}</span><Badge variant="secondary">{spec.value}</Badge></div>)}</div></div>}
              {detailGroups.length > 0 && (
                <div>
                  <h3 className="mb-4 text-xl font-semibold">Detailed Specifications</h3>
                  <div className="space-y-6">
                    {detailGroups.map((group, index) => (
                      <div key={group.category}>
                        <div className="mb-3 flex items-center justify-between gap-2"><h4 className="text-lg font-medium text-blue-600 dark:text-blue-400">{group.category}</h4><CopyButton value={groupText(group)} label={`Copy ${group.category}`} icon /></div>
                        <div className="space-y-2">{group.specifications.map((spec, i) => <div key={`${spec.name}-${i}`} className="grid grid-cols-3 gap-4 border-b py-2"><span className="font-medium">{spec.name}</span><span className="col-span-2 text-muted-foreground">{spec.value}</span></div>)}</div>
                        {index < detailGroups.length - 1 && <Separator className="mt-4" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data && detailGroups.length === 0 && quickSpec.length === 0 && p?.fullDescription && <div><div className="mb-3 flex items-center justify-between"><h3 className="text-xl font-semibold">Description</h3><CopyButton value={p.fullDescription} label="Copy Description" icon /></div><p className="whitespace-pre-line text-sm text-muted-foreground">{p.fullDescription}</p></div>}
              {p && p.specImages.length > 0 && <div><h3 className="mb-3 text-xl font-semibold">Spec Sheet</h3><div className="space-y-2">{p.specImages.map((src) => <img key={src} src={proxied(src)} alt="Specification sheet" className="w-full rounded-md border" loading="lazy" />)}</div></div>}
              {nothing && <p className="text-muted-foreground">No specifications could be read from this product page.</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NetImagesPage() {
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true); setError(null); setSelected(null)
    try {
      const response = await fetch(`/api/net-images?query=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Search failed")
      setProducts(data.products || []); setSearched(true)
    } catch (err) { setError(err instanceof Error ? err.message : "Search failed") } finally { setLoading(false) }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl pt-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white"><ImageIcon /></div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Net image search</h1>
        <p className="mt-3 text-muted-foreground">Find products, then click one to see its details and images.</p>
        <form className="mt-7 flex gap-2" onSubmit={(event) => { event.preventDefault(); search() }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products, e.g. Samsung Galaxy" aria-label="Search net products" />
          <Button type="submit" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Search />}<span className="hidden sm:inline">Search</span></Button>
        </form>
      </div>
      {error && <p className="mx-auto mt-8 max-w-3xl rounded-lg bg-destructive/10 p-4 text-center text-destructive">{error}</p>}

      {selected ? <ProductDetail product={selected} onBack={() => setSelected(null)} /> : products.length > 0 && (
        <div className="mx-auto mt-12 max-w-4xl">
          <h2 className="mb-4 text-2xl font-semibold">Search Results</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card key={product.url} className="cursor-pointer transition-shadow hover:shadow-lg" onClick={() => setSelected(product)}>
                <CardContent className="p-4">
                  <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-muted">
                    <img src={product.images[0] ? proxied(product.images[0].url) : "/modern-smartphone.png"} alt={clean(product.title)} className="h-full w-full object-contain" loading="lazy" onError={(e) => { e.currentTarget.src = "/modern-smartphone.png" }} />
                  </div>
                  <h3 className="text-lg font-semibold capitalize">{clean(product.title)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{product.images.length} image{product.images.length === 1 ? "" : "s"} · Click for details</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {!loading && searched && products.length === 0 && !error && <p className="mt-16 text-center text-muted-foreground">No products found. Try a broader search.</p>}
    </main>
  )
}
