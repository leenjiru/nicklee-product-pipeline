"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight, Copy, Download, Eye, ExternalLink, Heart, Instagram, Layers, Loader2, Play, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface InstagramPost { id: string; shortcode: string; permalink: string; caption: string; date: string; owner: string; source: string; images: string[]; imageCount: number; isVideo: boolean; likes: number; views: number }

// Instagram's CDN refuses Vercel's servers but serves browsers directly (with CORS), so images load and download from there
const compact = (n: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
const slug = (query: string) => query.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "instagram"
const fileName = (query: string, post: InstagramPost, index: number) => `${slug(query)}-${post.owner || post.shortcode}${post.images.length > 1 ? `-${index + 1}` : ""}.jpg`
const countOf = (post: InstagramPost) => Math.max(post.imageCount || 0, post.images.length)

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url; link.download = name
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function fetchImage(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.blob()
}

// Each photo downloads as its own .jpg, spaced out a little; the browser asks once to allow multiple downloads
async function saveImages(post: InstagramPost, indexes: number[], query: string) {
  for (const [n, i] of indexes.entries()) {
    if (n > 0) await new Promise((resolve) => setTimeout(resolve, 400))
    const url = post.images[i]
    try { saveBlob(await fetchImage(url), fileName(query, post, i)) } catch (err) {
      console.error("Download failed:", err)
      if (indexes.length === 1) window.open(url, "_blank", "noopener")
      else throw err
    }
  }
}

function CopyCaption({ caption }: { caption: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch (err) { console.error("Copy failed:", err) }
  }
  return <Button variant="outline" size="sm" onClick={copy} disabled={!caption} aria-label="Copy caption">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button>
}

function OpenOnInstagram({ post }: { post: InstagramPost }) {
  return <a href={post.permalink} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" type="button" aria-label="Open post on Instagram"><ExternalLink className="h-3.5 w-3.5" /></Button></a>
}

function PostCard({ post, query, onOpen }: { post: InstagramPost; query: string; onOpen: () => void }) {
  const [saving, setSaving] = useState(false)
  const count = countOf(post)

  async function save() {
    setSaving(true)
    try { await saveImages(post, [0], query) } finally { setSaving(false) }
  }

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="p-0">
        <button type="button" onClick={onOpen} className="relative block aspect-[3/4] w-full overflow-hidden bg-muted" aria-label={`Open post by @${post.owner}`}>
          <img src={post.images[0]} referrerPolicy="no-referrer" alt={post.caption.slice(0, 80) || "Instagram image"} className="h-full w-full object-cover transition-transform hover:scale-[1.02]" loading="lazy" onError={(e) => { e.currentTarget.src = "/placeholder.svg" }} />
          <span className="absolute right-2 top-2 flex gap-1">
            {post.isVideo && <Badge className="bg-black/60 text-white"><Play className="h-3 w-3" />Video</Badge>}
            {count > 1 && <Badge className="bg-black/60 text-white"><Layers className="h-3 w-3" />{count} photos</Badge>}
          </span>
          {(post.views > 0 || post.likes > 0) && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 text-sm font-semibold text-white drop-shadow">
              {post.views > 0 ? <Eye className="h-4 w-4" /> : <Heart className="h-4 w-4" />}{compact(post.views || post.likes)}
            </span>
          )}
        </button>
        <div className="space-y-2 p-3">
          <p className="truncate text-sm font-medium">{post.owner ? `@${post.owner}` : post.source}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground" title={post.caption}>{post.caption || "No caption"}</p>
          <div className="flex flex-wrap gap-1.5">
            {count > 1
              ? <Button variant="outline" size="sm" onClick={onOpen}><Layers className="h-3.5 w-3.5" />View all</Button>
              : <Button variant="outline" size="sm" onClick={save} disabled={saving} aria-label="Download image">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Save</Button>}
            <CopyCaption caption={post.caption} />
            <OpenOnInstagram post={post} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PostViewer({ post, query, onClose, onLoaded }: { post: InstagramPost; query: string; onClose: () => void; onLoaded: (post: InstagramPost) => void }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const total = post.images.length
  const step = (delta: number) => setIndex((i) => (i + delta + total) % total)

  // search results only carry a carousel's first photo (and sometimes no caption); fetch the full post once
  useEffect(() => {
    if (!post.id || (countOf(post) <= post.images.length && post.caption)) return
    let cancelled = false
    setLoading(true); setError(null)
    fetch(`/api/instagram-post?id=${post.id}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Couldn't load the post"); if (!cancelled) onLoaded({ ...post, ...data, source: post.source }) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load the post") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [post.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1) }
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow }
  }) // re-bound each render so `step` sees the current photo count

  function toggle(i: number) {
    setSelected((current) => { const next = new Set(current); if (next.has(i)) next.delete(i); else next.add(i); return next })
  }

  async function save(kind: string, indexes: number[]) {
    setSaving(kind)
    try { await saveImages(post, indexes, query) } catch (err) { console.error("Download failed:", err); setError("Download failed, try again") } finally { setSaving(null) }
  }

  const all = post.images.map((_, i) => i)
  const picked = all.filter((i) => selected.has(i))
  const spinner = (kind: string, icon = <Download className="h-4 w-4" />) => (saving === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : icon)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-2 sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Post by @${post.owner}`}>
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-background shadow-2xl lg:flex-row" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          <img src={post.images[index]} referrerPolicy="no-referrer" alt={`Photo ${index + 1} of ${total}`} className="max-h-[55vh] w-full object-contain lg:max-h-[85vh]" />
          {total > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80" aria-label="Previous photo"><ChevronLeft className="h-6 w-6" /></button>
              <button type="button" onClick={() => step(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80" aria-label="Next photo"><ChevronRight className="h-6 w-6" /></button>
              <Badge className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white">{index + 1} / {total}</Badge>
            </>
          )}
          {loading && <Badge className="absolute left-3 top-3 bg-black/60 text-white"><Loader2 className="h-3 w-3 animate-spin" />Loading all {countOf(post)} photos...</Badge>}
        </div>

        <div className="flex w-full flex-col gap-3 overflow-y-auto p-4 lg:w-80">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{post.owner ? `@${post.owner}` : post.source}</p>
              {post.date && <p className="text-xs text-muted-foreground">{new Date(post.date).toLocaleDateString()}{post.likes > 0 && ` · ${compact(post.likes)} likes`}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></Button>
          </div>

          {total > 1 && (
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tick photos to save several</span>
                <button type="button" className="font-medium text-blue-600 hover:underline dark:text-blue-400" onClick={() => setSelected(picked.length === total ? new Set() : new Set(all))}>{picked.length === total ? "Clear" : "Select all"}</button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {post.images.map((url, i) => (
                  <div key={url} className={`relative aspect-square overflow-hidden rounded-md border-2 ${i === index ? "border-blue-600" : "border-transparent"}`}>
                    <button type="button" onClick={() => setIndex(i)} className="h-full w-full" aria-label={`Show photo ${i + 1}`}><img src={url} referrerPolicy="no-referrer" alt="" className="h-full w-full object-cover" loading="lazy" /></button>
                    <button type="button" onClick={() => toggle(i)} aria-label={`${selected.has(i) ? "Unselect" : "Select"} photo ${i + 1}`} aria-pressed={selected.has(i)}
                      className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded border-2 border-white shadow ${selected.has(i) ? "bg-blue-600" : "bg-black/30"}`}>
                      {selected.has(i) && <Check className="h-3 w-3 text-white" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={() => save("one", [index])} disabled={!!saving}>{spinner("one")}Save this photo</Button>
            {total > 1 && <Button variant="outline" onClick={() => save("picked", picked)} disabled={!!saving || picked.length === 0}>{spinner("picked")}Save selected ({picked.length})</Button>}
            {total > 1 && <Button variant="outline" onClick={() => save("all", all)} disabled={!!saving}>{spinner("all", <Layers className="h-4 w-4" />)}Save all {total} photos</Button>}
          </div>
          {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}

          <div className="border-t pt-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium">Caption</span><div className="flex gap-1.5"><CopyCaption caption={post.caption} /><OpenOnInstagram post={post} /></div></div>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{post.caption || (loading ? "Loading..." : "No caption")}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InstagramPage() {
  const [query, setQuery] = useState("")
  const [searchedFor, setSearchedFor] = useState("")
  const [posts, setPosts] = useState<InstagramPost[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [loginNeeded, setLoginNeeded] = useState(false)
  const open = posts.find((post) => post.shortcode === openId)

  async function search() {
    const q = query.trim()
    if (!q) return
    setLoading(true); setError(null); setNotes([]); setPosts([]); setOpenId(null); setLoginNeeded(false)
    try {
      const response = await fetch(`/api/instagram-images?query=${encodeURIComponent(q)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Instagram search failed")
      setPosts(data.posts || []); setSearchedFor(q)
      setLoginNeeded(!!data.loginNeeded); setNotes(data.loginNeeded ? [] : data.errors || [])
    } catch (err) { setError(err instanceof Error ? err.message : "Instagram search failed") } finally { setLoading(false) }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl pt-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 text-white"><Instagram /></div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Instagram image search</h1>
        <p className="mt-3 text-muted-foreground">Search a product and get photos other people have posted on Instagram.</p>
        <form className="mt-7 flex gap-2" onSubmit={(event) => { event.preventDefault(); search() }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products, e.g. hp 840 g3" aria-label="Search Instagram" />
          <Button type="submit" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Search />}<span className="hidden sm:inline">Search</span></Button>
        </form>
        {loading && <p className="mt-4 text-sm text-muted-foreground">Searching Instagram, this can take up to a minute...</p>}
      </div>
      {error && <p className="mx-auto mt-8 max-w-3xl rounded-lg bg-destructive/10 p-4 text-center text-destructive">{error}</p>}
      {loginNeeded && (
        <div className="mx-auto mt-8 max-w-3xl rounded-lg bg-amber-50 p-4 text-center text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="font-medium">Instagram has logged the search account out.</p>
          <p className="mt-1 text-sm">Paste a fresh login cookie and search works again: <Link href="/instagram/session" className="font-semibold underline">Update Instagram login</Link></p>
        </div>
      )}
      {notes.length > 0 && <p className="mx-auto mt-8 max-w-3xl rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">{notes.join(" · ")}</p>}

      {posts.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-2xl font-semibold">{posts.length} post{posts.length === 1 ? "" : "s"} for &ldquo;{searchedFor}&rdquo;</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {posts.map((post) => <PostCard key={post.shortcode} post={post} query={searchedFor} onOpen={() => setOpenId(post.shortcode)} />)}
          </div>
        </div>
      )}
      {!loading && searchedFor && posts.length === 0 && !error && !loginNeeded && <p className="mt-16 text-center text-muted-foreground">No Instagram posts found. Try a shorter search.</p>}

      {open && <PostViewer key={open.shortcode} post={open} query={searchedFor} onClose={() => setOpenId(null)} onLoaded={(full) => setPosts((list) => list.map((p) => (p.shortcode === full.shortcode ? full : p)))} />}
    </main>
  )
}
