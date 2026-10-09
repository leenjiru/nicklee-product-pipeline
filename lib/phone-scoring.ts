export interface SpecItem { name: string; value: string }
export interface ScorablePhone {
  name: string
  img: string
  quickSpec?: SpecItem[]
  detailSpec?: { category: string; specifications: SpecItem[] }[]
}

export type CategoryKey = "performance" | "display" | "camera" | "battery" | "storage" | "extras"

export const CATEGORIES: { key: CategoryKey; label: string; weight: number }[] = [
  { key: "performance", label: "Performance", weight: 30 },
  { key: "camera", label: "Camera", weight: 20 },
  { key: "battery", label: "Battery & charging", weight: 20 },
  { key: "display", label: "Display", weight: 15 },
  { key: "storage", label: "Storage", weight: 8 },
  { key: "extras", label: "Connectivity & extras", weight: 7 },
]

interface Row { category: string; name: string; value: string }
interface MetricDef {
  key: string
  label: string
  category: CategoryKey
  weight: number
  /** Returns the display text and a 0-100 score, or null when the spec isn't available. */
  read: (ctx: Ctx) => { display: string; score: number; raw?: number } | null
}
interface Ctx { name: string; rows: Row[]; all: string }

export interface MetricResult { key: string; label: string; category: CategoryKey; display: string; score: number | null; raw: number | null; best: boolean }
export interface PhoneResult {
  phone: ScorablePhone
  overall: number
  categories: Record<CategoryKey, number | null>
  metrics: MetricResult[]
  strengths: string[]
  weaknesses: string[]
  /** Number of specs where this phone is the clear leader. */
  wins: number
  /** Share of the scoring weight that had real data behind it (0-1). */
  coverage: number
}
export interface Comparison { ranked: PhoneResult[]; verdict: string; categoryWinners: Partial<Record<CategoryKey, number>> }

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n))
const num = (s?: string) => (s ? Number.parseFloat(s) : Number.NaN)

function rowsOf(phone: ScorablePhone): Row[] {
  const rows: Row[] = []
  for (const group of phone.detailSpec || []) for (const spec of group.specifications) rows.push({ category: group.category, name: spec.name, value: spec.value })
  for (const spec of phone.quickSpec || []) if (spec.value) rows.push({ category: "Quick", name: spec.name, value: spec.value })
  return rows
}

/** First row whose category and name match; empty strings in the pattern mean "any". */
function find(ctx: Ctx, cat: RegExp | null, name: RegExp | null): string {
  return ctx.rows.find((r) => (!cat || cat.test(r.category)) && (!name || name.test(r.name)) && r.value)?.value || ""
}

// ---- memory / storage ----
function memory(ctx: Ctx): { ram: number | null; storage: number | null } {
  // The product name usually carries the exact variant being compared: "Galaxy A17 4G 8GB 256GB".
  const sizes = [...ctx.name.matchAll(/(\d+)\s*(GB|TB)/gi)].map((m) => Number(m[1]) * (m[2].toUpperCase() === "TB" ? 1024 : 1))
  if (sizes.length >= 2) return { ram: Math.min(...sizes), storage: Math.max(...sizes) }
  let ram: number | null = null
  let storage: number | null = null
  if (sizes.length === 1) sizes[0] <= 24 ? (ram = sizes[0]) : (storage = sizes[0])

  const internal = find(ctx, /memory/i, /internal/i) || ctx.all
  const pairs = [...internal.matchAll(/(\d+)\s*(GB|TB)\s+(\d+)\s*GB\s*RAM/gi)]
  if (pairs.length) {
    ram ??= Math.max(...pairs.map((m) => Number(m[3])))
    storage ??= Math.max(...pairs.map((m) => Number(m[1]) * (m[2].toUpperCase() === "TB" ? 1024 : 1)))
  }
  if (ram === null) { const m = [...ctx.all.matchAll(/(\d+)\s*GB\s*RAM/gi)].map((x) => Number(x[1])); if (m.length) ram = Math.max(...m) }
  if (storage === null) {
    const m = [...internal.matchAll(/(\d+)\s*(GB|TB)/gi)].map((x) => Number(x[1]) * (x[2].toUpperCase() === "TB" ? 1024 : 1)).filter((v) => v >= 8)
    if (m.length) storage = Math.max(...m)
  }
  return { ram, storage }
}
const fmtGb = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`)

// ---- chipset tiers (rough, but ordered correctly across brands) ----
export function chipsetScore(chipset: string): number | null {
  const s = chipset.toLowerCase()
  let m: RegExpMatchArray | null
  if ((m = s.match(/apple a(\d+)/))) { const a = Number(m[1]); return a >= 19 ? 99 : a >= 18 ? 97 : a >= 17 ? 95 : a >= 16 ? 90 : a >= 15 ? 85 : a >= 14 ? 78 : a >= 13 ? 72 : 60 }
  if (/snapdragon 8 elite/.test(s)) return 98
  if ((m = s.match(/snapdragon 8s? gen\s*(\d)/))) { const g = Number(m[1]); const sMod = /8s/.test(s); return sMod ? 80 + g * 2 : [0, 82, 88, 92, 96][g] || 90 }
  if (/snapdragon 8\+/.test(s)) return 84
  if (/snapdragon 7/.test(s) && /gen/.test(s)) return /gen\s*3|7s gen\s*[34]/.test(s) ? 68 : 62
  if (/snapdragon 6/.test(s) && /gen/.test(s)) return 48
  if (/snapdragon 4/.test(s) && /gen/.test(s)) return 30
  if ((m = s.match(/snapdragon\s*(\d)(\d{2})/))) return ({ 8: 75, 7: 55, 6: 40, 4: 22 } as Record<number, number>)[Number(m[1])] ?? null
  if ((m = s.match(/dimensity\s*(\d{3,4})/))) {
    const n = Number(m[1])
    if (n >= 9400) return 97; if (n >= 9300) return 92; if (n >= 9200) return 88; if (n >= 9000) return 82
    if (n >= 8000) return 70; if (n >= 7000) return 56; if (n >= 6000) return 42
    if (n >= 1000) return 68; if (n >= 800) return 45; return 35
  }
  if ((m = s.match(/exynos\s*(\d{3,4})/))) {
    const n = Number(m[1])
    if (n >= 2500) return 94; if (n >= 2400) return 90; if (n >= 2200) return 80; if (n >= 2100) return 76
    if (n >= 1500) return 60; if (n >= 1300) return 52; if (n <= 900) return 25; return 45
  }
  if ((m = s.match(/tensor g(\d)/))) return ({ 1: 65, 2: 72, 3: 80, 4: 85, 5: 92 } as Record<number, number>)[Number(m[1])] ?? 80
  if (/helio g(\d)/.test(s)) { const g = Number(s.match(/helio g(\d)/)![1]); return g >= 9 ? 38 : g >= 8 ? 28 : 15 }
  if (/helio/.test(s)) return 30
  if (/kirin\s*9/.test(s)) return 85; if (/kirin\s*8/.test(s)) return 60; if (/kirin/.test(s)) return 48
  if (/unisoc|spreadtrum|tiger|\bt[67]\d\d\b/.test(s)) return 20
  return null
}

const METRICS: MetricDef[] = [
  { key: "chipset", label: "Chipset", category: "performance", weight: 20, read: (c) => {
    const v = find(c, null, /^(chipset|processor|cpu)$/i) || find(c, null, /chipset|processor/i)
    const score = v ? chipsetScore(v) : null
    return score === null ? null : { display: v.replace(/\s*\(.*?\)\s*$/, "").trim(), score }
  } },
  { key: "ram", label: "RAM", category: "performance", weight: 10, read: (c) => {
    const { ram } = memory(c)
    return ram ? { raw: ram, display: `${ram}GB`, score: clamp((Math.log2(ram / 2) / 3) * 100) } : null
  } },

  { key: "screen", label: "Screen size", category: "display", weight: 3, read: (c) => {
    const v = find(c, /display/i, /^size$/i) || find(c, null, /display size|screen size/i)
    const inches = num(v.match(/(\d+(?:\.\d+)?)\s*(?:inches|"|'|in\b)/i)?.[1] || v.match(/(\d+(?:\.\d+)?)/)?.[1])
    return inches ? { raw: inches, display: `${inches}"`, score: clamp(((inches - 5.5) / 1.4) * 100) } : null
  } },
  { key: "panel", label: "Panel type", category: "display", weight: 5, read: (c) => {
    const v = find(c, /display/i, /^type$/i) || find(c, null, /display type|screen type/i)
    if (!v) return null
    const t = v.toLowerCase()
    const score = /ltpo/.test(t) ? 100 : /amoled|oled|dynamic 2x/.test(t) ? 90 : /ips|lcd|pls/.test(t) ? 55 : /tft|tn/.test(t) ? 30 : 50
    return { display: v.split(",")[0].trim(), score }
  } },
  { key: "refresh", label: "Refresh rate", category: "display", weight: 4, read: (c) => {
    const hz = Math.max(0, ...[...(find(c, /display/i, /^type$/i) + " " + c.all).matchAll(/(\d{2,3})\s*Hz/gi)].map((m) => Number(m[1])))
    return hz ? { raw: hz, display: `${hz}Hz`, score: hz >= 144 ? 100 : hz >= 120 ? 90 : hz >= 90 ? 55 : 20 } : null
  } },
  { key: "brightness", label: "Peak brightness", category: "display", weight: 2, read: (c) => {
    const nits = Math.max(0, ...[...find(c, /display/i, /^type$/i).matchAll(/(\d{3,5})\s*nits/gi)].map((m) => Number(m[1])))
    return nits ? { raw: nits, display: `${nits} nits`, score: clamp(((nits - 400) / 2600) * 100) } : null
  } },
  { key: "resolution", label: "Resolution", category: "display", weight: 3, read: (c) => {
    const v = find(c, /display/i, /^resolution$/i) || find(c, null, /display resolution/i)
    const m = v.match(/(\d{3,4})\s*x\s*(\d{3,4})/i)
    if (!m) return null
    const short = Math.min(Number(m[1]), Number(m[2]))
    return { display: `${m[1]}×${m[2]}`, score: short >= 1400 ? 100 : short >= 1000 ? 75 : short >= 700 ? 40 : 20 }
  } },

  { key: "mainMp", label: "Main camera", category: "camera", weight: 6, read: (c) => {
    const v = find(c, /main camera/i, /^(single|dual|triple|quad|penta)$/i) || find(c, /main camera/i, null) || find(c, null, /^(primary|rear camera)/i)
    const mp = num(v.match(/(\d+(?:\.\d+)?)\s*MP/i)?.[1])
    return mp ? { raw: mp, display: `${mp}MP`, score: clamp(35 + 15 * Math.log2(mp / 8)) } : null
  } },
  { key: "lenses", label: "Rear cameras", category: "camera", weight: 3, read: (c) => {
    const row = c.rows.find((r) => /main camera/i.test(r.category) && /^(single|dual|triple|quad|penta)$/i.test(r.name))
    const count = row ? ({ single: 1, dual: 2, triple: 3, quad: 4, penta: 5 } as Record<string, number>)[row.name.toLowerCase()] : (find(c, /main camera/i, null).match(/\d+\s*MP/gi) || []).length
    return count ? { raw: count, display: `${count}`, score: ({ 1: 20, 2: 45, 3: 75 } as Record<number, number>)[count] ?? 100 } : null
  } },
  { key: "ois", label: "Optical stabilisation", category: "camera", weight: 3, read: (c) => {
    const text = c.rows.filter((r) => /main camera/i.test(r.category)).map((r) => r.value).join(" ")
    return text ? (/ois/i.test(text) ? { display: "Yes", score: 100 } : { display: "No", score: 40 }) : null
  } },
  { key: "video", label: "Video recording", category: "camera", weight: 3, read: (c) => {
    const v = c.rows.filter((r) => /main camera/i.test(r.category) && /video/i.test(r.name)).map((r) => r.value).join(" ")
    if (!v) return null
    return /8K/i.test(v) ? { display: "8K", score: 100 } : /4K/i.test(v) ? { display: "4K", score: 80 } : /1080p/i.test(v) ? { display: "1080p", score: 50 } : { display: "720p or less", score: 25 }
  } },
  { key: "selfie", label: "Selfie camera", category: "camera", weight: 1, read: (c) => {
    const v = c.rows.find((r) => /selfie/i.test(r.category) && /MP/i.test(r.value))?.value || ""
    const mp = num(v.match(/(\d+(?:\.\d+)?)\s*MP/i)?.[1])
    return mp ? { raw: mp, display: `${mp}MP`, score: clamp(25 + 12 * Math.log2(mp / 5)) } : null
  } },

  { key: "battery", label: "Battery capacity", category: "battery", weight: 8, read: (c) => {
    const mah = num((find(c, /battery/i, /^type$/i) + " " + c.all).match(/(\d{4,5})\s*mAh/i)?.[1])
    return mah ? { raw: mah, display: `${mah} mAh`, score: clamp(20 + ((mah - 3000) / 3500) * 80) } : null
  } },
  { key: "charging", label: "Wired charging", category: "battery", weight: 5, read: (c) => {
    const v = find(c, /battery/i, /^charging$/i) || find(c, null, /charging/i)
    const watts = Math.max(0, ...[...v.matchAll(/(\d{1,3}(?:\.\d+)?)\s*W\b/g)].map((m) => Number(m[1])))
    return watts ? { raw: watts, display: `${watts}W`, score: clamp(15 + 85 * Math.log10(watts / 10)) } : null
  } },
  { key: "wireless", label: "Wireless charging", category: "battery", weight: 1, read: (c) => {
    const v = find(c, /battery/i, /^charging$/i) || find(c, null, /charging/i)
    return v ? (/wireless/i.test(v) ? { display: "Yes", score: 100 } : { display: "No", score: 0 }) : null
  } },

  { key: "storage", label: "Storage", category: "storage", weight: 1, read: (c) => {
    const { storage } = memory(c)
    return storage ? { raw: storage, display: fmtGb(storage), score: clamp((Math.log2(storage / 32) / 5) * 100) } : null
  } },

  { key: "5g", label: "5G", category: "extras", weight: 3, read: (c) => {
    const net = find(c, /network/i, /technology/i)
    const has = /5g/i.test(net) || /\b5g\b/i.test(c.name) || (!net && /5g/i.test(find(c, null, /network|technology/i)))
    return net || /5g/i.test(c.name) ? { display: has ? "Yes" : "No", score: has ? 100 : 0 } : null
  } },
  { key: "nfc", label: "NFC", category: "extras", weight: 2, read: (c) => {
    const v = find(c, /comms|connect/i, /nfc/i)
    return v ? (/^(no|-)/i.test(v) ? { display: "No", score: 0 } : { display: "Yes", score: 100 }) : null
  } },
  { key: "ip", label: "Water & dust resistance", category: "extras", weight: 2, read: (c) => {
    const m = c.all.match(/\bIP(\d)(\d)\b/i)
    if (!m) return c.rows.length ? { display: "None listed", score: 0 } : null
    const [dust, water] = [Number(m[1]), Number(m[2])]
    return { display: `IP${dust}${water}`, score: water >= 8 ? 100 : water === 7 ? 85 : dust >= 6 ? 70 : 55 }
  } },
  { key: "wifi", label: "Wi-Fi", category: "extras", weight: 1, read: (c) => {
    const v = find(c, /comms|connect/i, /wlan|wi-?fi/i)
    if (!v) return null
    return /wi-?fi 7|be\b/i.test(v) ? { display: "Wi-Fi 7", score: 100 } : /6e/i.test(v) ? { display: "Wi-Fi 6E", score: 85 } : /wi-?fi 6|ax\b/i.test(v) ? { display: "Wi-Fi 6", score: 75 } : /wi-?fi 5|\bac\b/i.test(v) ? { display: "Wi-Fi 5", score: 40 } : { display: "Wi-Fi 4 or older", score: 20 }
  } },
]

export const METRIC_LABELS = METRICS.map(({ key, label, category }) => ({ key, label, category }))

function weightedAverage(items: { score: number; weight: number }[]) {
  const total = items.reduce((sum, i) => sum + i.weight, 0)
  return total ? items.reduce((sum, i) => sum + i.score * i.weight, 0) / total : null
}

export function comparePhones(phones: ScorablePhone[]): Comparison {
  const scored = phones.map((phone) => {
    const rows = rowsOf(phone)
    const ctx: Ctx = { name: phone.name, rows, all: rows.map((r) => r.value).join(" | ") }
    const metrics = METRICS.map((def) => {
      let read: ReturnType<MetricDef["read"]> = null
      try { read = def.read(ctx) } catch { read = null }
      return { def, read }
    })
    return { phone, metrics }
  })

  const results: PhoneResult[] = scored.map(({ phone, metrics }) => {
    const categories = {} as Record<CategoryKey, number | null>
    for (const cat of CATEGORIES) {
      categories[cat.key] = weightedAverage(metrics.filter((m) => m.def.category === cat.key && m.read).map((m) => ({ score: m.read!.score, weight: m.def.weight })))
    }
    // Categories with no data are left out and the remaining weights are rescaled, so missing data isn't punished as a zero.
    const present = CATEGORIES.filter((c) => categories[c.key] !== null)
    const overall = weightedAverage(present.map((c) => ({ score: categories[c.key]!, weight: c.weight }))) ?? 0
    const coverage = metrics.filter((m) => m.read).reduce((s, m) => s + m.def.weight, 0) / METRICS.reduce((s, m) => s + m.weight, 0)
    return {
      phone, overall: Math.round(overall), categories, coverage, strengths: [], weaknesses: [], wins: 0,
      metrics: metrics.map((m) => ({ key: m.def.key, label: m.def.label, category: m.def.category, display: m.read?.display ?? "—", score: m.read?.score ?? null, raw: m.read?.raw ?? null, best: false })),
    }
  })

  // Mark the best value per metric (only when it genuinely beats the field) and derive strengths / weaknesses from it.
  METRICS.forEach((def, i) => {
    const values = results.map((r) => r.metrics[i].score)
    const real = values.filter((v): v is number => v !== null)
    if (real.length < 2) return
    const max = Math.max(...real), min = Math.min(...real)
    if (max - min < 8) return
    const raws = results.map((r) => r.metrics[i].raw)
    results.forEach((r, idx) => {
      const score = values[idx]
      if (score === max) {
        r.metrics[i].best = true; r.wins++
        if (max - min >= 15) {
          const others = raws.filter((v, k): v is number => k !== idx && v !== null && v > 0)
          const mine = raws[idx]
          const second = others.length ? Math.max(...others) : null
          const pct = mine !== null && second ? Math.round(((mine - second) / second) * 100) : 0
          r.strengths.push(pct >= 5 ? `${pct}% higher ${def.label.toLowerCase()} (${r.metrics[i].display})` : `Best ${def.label.toLowerCase()} (${r.metrics[i].display})`)
        }
      } else if (score === min && max - min >= 25) {
        const mine = raws[idx]
        const top = Math.max(...raws.filter((v): v is number => v !== null))
        const pct = mine !== null && mine > 0 && top ? Math.round(((top - mine) / mine) * 100) : 0
        r.weaknesses.push(pct >= 10 ? `${def.label} is ${pct}% lower than the best (${r.metrics[i].display})` : `Lowest ${def.label.toLowerCase()} (${r.metrics[i].display})`)
      }
    })
  })
  for (const r of results) {
    for (const cat of CATEGORIES) {
      const v = r.categories[cat.key]
      if (v === null) continue
      if (v >= 80 && !r.strengths.some((s) => s.startsWith("Excellent"))) r.strengths.unshift(`Excellent ${cat.label.toLowerCase()}`)
      if (v <= 35) r.weaknesses.unshift(`Weak ${cat.label.toLowerCase()}`)
    }
    r.strengths = r.strengths.slice(0, 5); r.weaknesses = r.weaknesses.slice(0, 5)
  }

  const categoryWinners: Partial<Record<CategoryKey, number>> = {}
  for (const cat of CATEGORIES) {
    const vals = results.map((r) => r.categories[cat.key])
    const real = vals.filter((v): v is number => v !== null)
    if (real.length < 2 || Math.max(...real) - Math.min(...real) < 5) continue
    categoryWinners[cat.key] = vals.indexOf(Math.max(...real))
  }

  const order = results.map((_, i) => i).sort((a, b) => results[b].overall - results[a].overall)
  const ranked = order.map((i) => results[i])
  const winnerOriginal = order[0]
  const remapped: Partial<Record<CategoryKey, number>> = {}
  for (const [k, idx] of Object.entries(categoryWinners)) remapped[k as CategoryKey] = order.indexOf(idx as number)

  const [first, second] = ranked
  let verdict = ""
  if (second) {
    const gap = first.overall - second.overall
    const lead = CATEGORIES.filter((c) => (first.categories[c.key] ?? 0) - (second.categories[c.key] ?? 0) >= 10).map((c) => c.label.toLowerCase())
    verdict = gap < 3
      ? `${first.phone.name} and ${second.phone.name} are almost level (${first.overall} vs ${second.overall}) — pick on the categories that matter most to you.`
      : `${first.phone.name} comes out ahead by ${gap} points${lead.length ? `, mainly on ${lead.slice(0, 3).join(", ")}` : ""}.`
  }
  void winnerOriginal
  return { ranked, verdict, categoryWinners: remapped }
}
