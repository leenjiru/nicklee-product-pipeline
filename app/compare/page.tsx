"use client"

import type React from "react"
import { useMemo, useRef, useState } from "react"
import { Check, Crown, Loader2, Plus, Scale, Search, Smartphone, ThumbsDown, ThumbsUp, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CATEGORIES, METRIC_LABELS, comparePhones, type CategoryKey, type PhoneResult, type ScorablePhone } from "@/lib/phone-scoring"

interface PhoneSearchResult { id: string; name: string; img: string; description: string }

const MAX_PHONES = 3
const proxied = (url: string) => (url ? `/api/proxy-image?url=${encodeURIComponent(url)}` : "/modern-smartphone.png")
const PHONE_COLORS = ["bg-blue-500", "bg-violet-500", "bg-amber-500"]
const PHONE_TEXT = ["text-blue-600 dark:text-blue-400", "text-violet-600 dark:text-violet-400", "text-amber-600 dark:text-amber-400"]
const scoreColor = (score: number) => (score >= 75 ? "#16a34a" : score >= 55 ? "#2563eb" : score >= 40 ? "#d97706" : "#dc2626")

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={8} className="stroke-gray-200 dark:stroke-gray-700" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={8} strokeLinecap="round" stroke={scoreColor(score)} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none"><span className="text-xl font-bold">{score}</span><span className="text-[10px] text-muted-foreground">/100</span></div>
    </div>
  )
}

function CategoryBars({ result, winners, rank }: { result: PhoneResult; winners: Partial<Record<CategoryKey, number>>; rank: number }) {
  return (
    <div className="space-y-2.5">
      {CATEGORIES.map((cat) => {
        const value = result.categories[cat.key]
        return (
          <div key={cat.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">{cat.label}{winners[cat.key] === rank && <Crown className="h-3 w-3 text-amber-500" aria-label="Best in category" />}</span>
              <span className="font-medium tabular-nums">{value === null ? "n/a" : Math.round(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              {value !== null && <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: scoreColor(value) }} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function PhoneComparison() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<PhoneSearchResult[]>([])
  const [selectedPhones, setSelectedPhones] = useState<ScorablePhone[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const comparison = useMemo(() => (selectedPhones.length >= 2 ? comparePhones(selectedPhones) : null), [selectedPhones])

  const searchPhones = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true); setError(null)
    try {
      const response = await fetch(`/api/search-phones?query=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) throw new Error("Failed to search phones")
      setSearchResults(await response.json()); setHasSearched(true)
    } catch (err) {
      setError("Failed to search phones. Please try again.")
      console.error("Search error:", err)
    } finally { setIsSearching(false) }
  }

  const addPhone = async (phone: PhoneSearchResult) => {
    if (selectedPhones.length >= MAX_PHONES) { setError(`You can compare up to ${MAX_PHONES} phones at a time`); return }
    setAddingId(phone.id); setError(null)
    try {
      const response = await fetch(`/api/phone-details?id=${encodeURIComponent(phone.id)}`)
      if (!response.ok) throw new Error("Failed to get phone details")
      const details = await response.json()
      // Keep the name the user picked (it carries the RAM/storage variant) and fall back to the search image.
      const added: ScorablePhone = { ...details, name: phone.name || details.name, img: details.img || phone.img }
      if (selectedPhones.some((p) => p.name === added.name)) { setError("This phone is already in the comparison"); return }
      setSelectedPhones((prev) => [...prev, added])
      setSearchResults([]); setSearchQuery(""); setHasSearched(false)
    } catch (err) {
      setError("Couldn't load that phone's specs. Try another result.")
      console.error("Add phone error:", err)
    } finally { setAddingId(null) }
  }

  const removePhone = (index: number) => setSelectedPhones((prev) => prev.filter((_, i) => i !== index))
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === "Enter") searchPhones() }
  const colorOf = (phone: ScorablePhone) => selectedPhones.findIndex((p) => p.name === phone.name)

  const winner = comparison?.ranked[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 text-center sm:mb-8">
          <div className="mb-2 flex items-center justify-center gap-2 sm:gap-3">
            <Scale className="h-7 w-7 text-blue-600 sm:h-8 sm:w-8" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-4xl">Compare Phones</h1>
          </div>
          <p className="mx-auto max-w-xl text-sm text-gray-600 dark:text-gray-300 sm:text-base">Pick 2–{MAX_PHONES} phones. They&apos;re scored on performance, camera, battery, display, storage and extras, and ranked automatically.</p>
        </header>

        {/* Slots */}
        <section aria-label="Phones to compare" className="mb-4 grid gap-2 sm:grid-cols-3 sm:gap-3">
          {Array.from({ length: MAX_PHONES }).map((_, index) => {
            const phone = selectedPhones[index]
            return phone ? (
              <div key={phone.name} className="relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-2 pr-9 shadow-sm">
                <span className={`absolute inset-y-0 left-0 w-1 ${PHONE_COLORS[index]}`} />
                <div className="ml-1 h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted"><img src={proxied(phone.img)} alt="" className="h-full w-full object-contain" onError={(e) => { e.currentTarget.src = "/modern-smartphone.png" }} /></div>
                <h3 className="line-clamp-2 min-w-0 text-sm font-semibold leading-tight">{phone.name}</h3>
                <button type="button" onClick={() => removePhone(index)} className="absolute right-1.5 top-1.5 rounded-full p-1.5 hover:bg-muted" aria-label={`Remove ${phone.name}`}><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <button key={`empty-${index}`} type="button" onClick={() => searchRef.current?.focus()} className="flex h-[74px] items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-sm text-muted-foreground transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-600">
                <Plus className="h-4 w-4" />Add phone {index + 1}{index < 2 && <span className="text-[10px] opacity-70">(required)</span>}
              </button>
            )
          })}
        </section>

        {/* Search */}
        {selectedPhones.length < MAX_PHONES && (
          <Card className="mx-auto mb-5 max-w-2xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex gap-2">
                <Input ref={searchRef} placeholder="Search a phone, e.g. Galaxy A26" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={handleKeyPress} className="flex-1" aria-label="Search phones" />
                <Button onClick={searchPhones} disabled={isSearching || !searchQuery.trim()} aria-label="Search">{isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="hidden sm:inline">Search</span></Button>
              </div>
              {error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-2 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
              {searchResults.length > 0 && (
                <ul className="mt-3 max-h-[26rem] divide-y overflow-y-auto rounded-lg border">
                  {searchResults.map((phone) => (
                    <li key={phone.id} className="flex items-center gap-3 p-2.5">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted"><img src={proxied(phone.img)} alt="" className="h-full w-full object-contain" loading="lazy" onError={(e) => { e.currentTarget.src = "/modern-smartphone.png" }} /></div>
                      <p className="min-w-0 flex-1 text-sm font-medium leading-tight">{phone.name}</p>
                      <Button size="sm" onClick={() => addPhone(phone)} disabled={addingId !== null} aria-label={`Add ${phone.name}`}>{addingId === phone.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}<span className="hidden sm:inline">Add</span></Button>
                    </li>
                  ))}
                </ul>
              )}
              {hasSearched && searchResults.length === 0 && !isSearching && <p className="mt-3 text-center text-sm text-muted-foreground">No phones found. Try a shorter name.</p>}
            </CardContent>
          </Card>
        )}
        {selectedPhones.length >= MAX_PHONES && error && <p role="alert" className="mx-auto mb-5 max-w-2xl rounded-md bg-red-50 p-2 text-center text-sm text-red-600">{error}</p>}

        {/* Empty / waiting states */}
        {selectedPhones.length === 0 && (
          <Card className="mx-auto max-w-2xl"><CardContent className="py-10 text-center"><Smartphone className="mx-auto mb-3 h-10 w-10 text-gray-400" /><h2 className="mb-1 text-lg font-semibold">Start comparing</h2><p className="text-sm text-muted-foreground">Search and add at least two phones to see a ranking.</p></CardContent></Card>
        )}
        {selectedPhones.length === 1 && <p className="text-center text-sm text-muted-foreground">Add one more phone to see the comparison.</p>}

        {comparison && winner && (
          <div className="space-y-6">
            {/* Verdict */}
            <Card className="overflow-hidden border-green-500/60 bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-transparent">
              <CardContent className="flex flex-col items-center gap-4 p-4 text-center sm:flex-row sm:p-6 sm:text-left">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/70 sm:h-24 sm:w-24 dark:bg-white/10"><img src={proxied(winner.phone.img)} alt={winner.phone.name} className="h-full w-full object-contain" onError={(e) => { e.currentTarget.src = "/modern-smartphone.png" }} /></div>
                <div className="min-w-0 flex-1">
                  <Badge className="mb-2 bg-green-600"><Trophy className="mr-1 h-3 w-3" />Best overall</Badge>
                  <h2 className="text-xl font-bold sm:text-2xl">{winner.phone.name}</h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{comparison.verdict}</p>
                </div>
                <ScoreRing score={winner.overall} size={88} />
              </CardContent>
            </Card>

            {/* Ranking */}
            <section aria-label="Ranking">
              <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">Ranking</h2>
              <div className={`grid gap-3 sm:gap-4 ${comparison.ranked.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
                {comparison.ranked.map((result, rank) => (
                  <Card key={result.phone.name} className={rank === 0 ? "border-green-500/60" : ""}>
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${rank === 0 ? "bg-green-600" : rank === 1 ? "bg-gray-500" : "bg-amber-700"}`}>{rank + 1}</div>
                        <div className="min-w-0 flex-1"><h3 className={`text-sm font-semibold leading-tight ${PHONE_TEXT[colorOf(result.phone)] || ""}`}>{result.phone.name}</h3><p className="mt-0.5 text-[11px] text-muted-foreground">Leads in {result.wins} of {result.metrics.filter((m) => m.score !== null).length} specs</p>{result.coverage < 0.65 && <p className="mt-0.5 text-[11px] text-amber-600">Limited spec data — score is approximate</p>}</div>
                        <ScoreRing score={result.overall} size={60} />
                      </div>
                      <CategoryBars result={result} winners={comparison.categoryWinners} rank={rank} />
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        <div><h4 className="mb-1 flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400"><ThumbsUp className="h-3.5 w-3.5" />Strengths</h4>{result.strengths.length ? <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">{result.strengths.map((s) => <li key={s}>• {s}</li>)}</ul> : <p className="text-xs text-muted-foreground">Nothing stands out</p>}</div>
                        <div><h4 className="mb-1 flex items-center gap-1 text-sm font-semibold text-red-600 dark:text-red-400"><ThumbsDown className="h-3.5 w-3.5" />Weaknesses</h4>{result.weaknesses.length ? <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">{result.weaknesses.map((s) => <li key={s}>• {s}</li>)}</ul> : <p className="text-xs text-muted-foreground">No clear weaknesses</p>}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Spec table */}
            <section aria-label="Spec by spec">
              <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">Spec by spec</h2>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="sticky left-0 z-10 w-[34%] bg-muted p-2 text-left text-xs font-medium text-muted-foreground sm:p-3">Spec</th>
                        {comparison.ranked.map((r) => <th key={r.phone.name} className="p-2 text-left align-bottom text-xs font-semibold leading-tight sm:p-3 sm:text-sm">{r.phone.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {CATEGORIES.map((cat) => {
                        const rows = METRIC_LABELS.map((m, i) => ({ ...m, i })).filter((m) => m.category === cat.key && comparison.ranked.some((r) => r.metrics[m.i].score !== null))
                        if (!rows.length) return null
                        return (
                          <FragmentRows key={cat.key} label={cat.label} cols={comparison.ranked.length + 1}>
                            {rows.map((m) => (
                              <tr key={m.key} className="border-b last:border-0">
                                <th scope="row" className="sticky left-0 z-10 bg-background p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 sm:p-3 sm:text-sm">{m.label}</th>
                                {comparison.ranked.map((r) => {
                                  const cell = r.metrics[m.i]
                                  return <td key={r.phone.name} className={`p-2 align-top text-xs sm:p-3 sm:text-sm ${cell.best ? "bg-green-50 font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-400" : ""}`}><span className="inline-flex items-center gap-1">{cell.best && <Check className="h-3.5 w-3.5 shrink-0" aria-label="Best" />}{cell.display}</span></td>
                                })}
                              </tr>
                            ))}
                          </FragmentRows>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
              <p className="mt-2 text-center text-xs text-muted-foreground">Scores weigh performance 30%, camera 20%, battery 20%, display 15%, storage 8%, extras 7%. Missing specs are left out rather than counted as zero.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function FragmentRows({ label, cols, children }: { label: string; cols: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-muted/40"><th colSpan={cols} className="sticky left-0 p-2 text-left text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 sm:px-3">{label}</th></tr>
      {children}
    </>
  )
}
