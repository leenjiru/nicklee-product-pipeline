"use client"

import { useState } from "react"
import { Check, ChevronLeft, ChevronRight, Copy, Download, Eye, ExternalLink, Heart, Instagram, Layers, Loader2, Play, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface InstagramPost { shortcode: string; permalink: string; caption: string; date: string; owner: string; source: string; images: string[]; isVideo: boolean; likes: number; views: number }

const proxied = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`
const compact = (n: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
const fileName = (query: string, post: InstagramPost, index: number) => `${query.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "instagram"}-${post.shortcode}${post.images.length > 1 ? `-${index + 1}` : ""}.jpg`

function PostCard({ post, query }: { post: InstagramPost; query: string }) {
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const image = post.images[index]
  const many = post.images.length > 1
  const step = (delta: number) => setIndex((i) => (i + delta + post.images.length) % post.images.length)

  async function copyCaption() {
    try { await navigator.clipboard.writeText(post.caption); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch (err) { console.error("Copy failed:", err) }
  }

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="p-0">
        <div className="group relative aspect-[3/4] overflow-hidden bg-muted">
          <img src={proxied(image)} alt={post.caption.slice(0, 80) || "Instagram image"} className="h-full w-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.src = "/placeholder.svg" }} />
          <div className="absolute right-2 top-2 flex gap-1">
            {post.isVideo && <Badge className="bg-black/60 text-white"><Play className="h-3 w-3" />Video</Badge>}
            {many && <Badge className="bg-black/60 text-white"><Layers className="h-3 w-3" />{index + 1}/{post.images.length}</Badge>}
          </div>
          {many && (
            <>
              <button type="button" onClick={() => step(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white" aria-label="Previous image"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" onClick={() => step(1)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white" aria-label="Next image"><ChevronRight className="h-5 w-5" /></button>
            </>
          )}
          {(post.views > 0 || post.likes > 0) && (
            <p className="absolute bottom-2 left-2 flex items-center gap-1 text-sm font-semibold text-white drop-shadow">
              {post.views > 0 ? <Eye className="h-4 w-4" /> : <Heart className="h-4 w-4" />}{compact(post.views || post.likes)}
            </p>
          )}
        </div>
        <div className="space-y-2 p-3">
          <p className="truncate text-sm font-medium">{post.owner ? `@${post.owner}` : post.source}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground" title={post.caption}>{post.caption || "No caption"}</p>
          <div className="flex flex-wrap gap-1.5">
            <a href={proxied(image)} download={fileName(query, post, index)}><Button variant="outline" size="sm" type="button" aria-label="Download image"><Download className="h-3.5 w-3.5" />Save</Button></a>
            <Button variant="outline" size="sm" onClick={copyCaption} disabled={!post.caption} aria-label="Copy caption">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button>
            <a href={post.permalink} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" type="button" aria-label="Open post on Instagram"><ExternalLink className="h-3.5 w-3.5" /></Button></a>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function InstagramPage() {
  const [query, setQuery] = useState("")
  const [searchedFor, setSearchedFor] = useState("")
  const [posts, setPosts] = useState<InstagramPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])

  async function search() {
    const q = query.trim()
    if (!q) return
    setLoading(true); setError(null); setNotes([]); setPosts([])
    try {
      const response = await fetch(`/api/instagram-images?query=${encodeURIComponent(q)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Instagram search failed")
      setPosts(data.posts || []); setNotes(data.errors || []); setSearchedFor(q)
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
      {notes.length > 0 && <p className="mx-auto mt-8 max-w-3xl rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">{notes.join(" · ")}</p>}

      {posts.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-2xl font-semibold">{posts.length} post{posts.length === 1 ? "" : "s"} for &ldquo;{searchedFor}&rdquo;</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {posts.map((post) => <PostCard key={post.shortcode} post={post} query={searchedFor} />)}
          </div>
        </div>
      )}
      {!loading && searchedFor && posts.length === 0 && !error && <p className="mt-16 text-center text-muted-foreground">No Instagram posts found. Try a shorter search.</p>}
    </main>
  )
}
