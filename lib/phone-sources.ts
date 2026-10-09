import * as cheerio from "cheerio"

export interface PhoneSearchResult { id: string; name: string; img: string; description: string; source: "gsmarena" | "avechi" }
export interface SpecItem { name: string; value: string }
export interface PhoneDetails { name: string; img: string; quickSpec: SpecItem[]; detailSpec: { category: string; specifications: SpecItem[] }[]; source: string }

const GSM = "https://www.gsmarena.com"
const AVECHI = "https://avechi.co.ke"
const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
}

async function fetchHtml(url: string, attempts = 2): Promise<string> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) })
      if (response.ok) return await response.text()
      lastError = new Error(`${url} responded ${response.status}`)
    } catch (error) { lastError = error }
    await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)))
  }
  throw lastError
}

const text = (value?: string) => (value || "").replace(/\s+/g, " ").trim()
const abs = (value: string, base: string) => { try { return new URL(value, base).href } catch { return "" } }

// ---------- GSMArena ----------

/** Progressively looser versions of the query so "Samsung Galaxy S24 Ultra 5G" still finds something. */
function queryVariants(query: string) {
  const words = query.replace(/[^\w\s+.-]/g, " ").split(/\s+/).filter(Boolean)
  const variants = [words.join(" ")]
  const noNoise = words.filter((w) => !/^(5g|4g|lte|dual|sim|smartphone|phone|mobile)$/i.test(w))
  if (noNoise.length && noNoise.join(" ") !== variants[0]) variants.push(noNoise.join(" "))
  for (let n = noNoise.length - 1; n >= 2; n--) variants.push(noNoise.slice(0, n).join(" "))
  if (noNoise.length > 2) variants.push(noNoise.slice(1).join(" "))
  return [...new Set(variants.filter(Boolean))]
}

function parseGsmList(html: string): PhoneSearchResult[] {
  const $ = cheerio.load(html)
  const results: PhoneSearchResult[] = []
  $(".makers li").each((_, el) => {
    const href = $(el).find("a").attr("href")
    if (!href) return
    const img = $(el).find("img")
    results.push({
      id: href.replace(/\.php$/, ""),
      name: text($(el).find("span").text()) || text(img.attr("alt")),
      img: abs(img.attr("src") || img.attr("data-src") || "", GSM),
      description: text(img.attr("title")),
      source: "gsmarena",
    })
  })
  return results
}

export async function searchGsmarena(query: string): Promise<PhoneSearchResult[]> {
  for (const variant of queryVariants(query)) {
    const html = await fetchHtml(`${GSM}/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(variant)}`)
    const results = parseGsmList(html)
    if (results.length) return results.slice(0, 24)
  }
  return []
}

export async function getGsmarenaDevice(id: string): Promise<PhoneDetails> {
  if (!/^[\w-]+$/.test(id)) throw new Error("Invalid phone id")
  const $ = cheerio.load(await fetchHtml(`${GSM}/${id}.php`))
  const name = text($(".specs-phone-name-title").text())
  if (!name) throw new Error("GSMArena page had no phone data")
  const quickSpec: SpecItem[] = [
    ["Display size", $("span[data-spec=displaysize-hl]").text()],
    ["Display resolution", $("div[data-spec=displayres-hl]").text()],
    ["Camera pixels", $(".accent-camera").text()],
    ["Video pixels", $("div[data-spec=videopixels-hl]").text()],
    ["RAM size", $(".accent-expansion").text()],
    ["Chipset", $("div[data-spec=chipset-hl]").text()],
    ["Battery size", $(".accent-battery").text()],
    ["Battery type", $("div[data-spec=battype-hl]").text()],
  ].map(([n, v]) => ({ name: n, value: text(v) }))

  const detailSpec: PhoneDetails["detailSpec"] = []
  const tables = $("#specs-list table").length ? $("#specs-list table") : $("table")
  tables.each((_, table) => {
    const category = text($(table).find("th").first().text()) || "Specifications"
    const specifications: SpecItem[] = []
    let lastName = ""
    $(table).find("tr").each((__, row) => {
      const ttl = text($(row).find("td.ttl").text())
      const nfo = text($(row).find("td.nfo").text())
      if (!nfo) return
      // GSMArena leaves the title blank for continuation rows (e.g. extra camera lines)
      specifications.push({ name: ttl || lastName, value: nfo })
      if (ttl) lastName = ttl
    })
    detailSpec.push({ category, specifications })
  })
  // Safety net: GSMArena tags every spec cell with a data-spec attribute. If the table pass found almost nothing
  // (markup change, odd page variant), rebuild the rows from those cells instead.
  if (detailSpec.reduce((n, g) => n + g.specifications.length, 0) < 5) {
    const byCategory = new Map<string, SpecItem[]>()
    $("td.nfo[data-spec]").each((_, cell) => {
      const value = text($(cell).text())
      if (!value) return
      const row = $(cell).closest("tr")
      const name = text(row.find("td.ttl").first().text()) || ($(cell).attr("data-spec") || "")
      const category = text($(cell).closest("table").find("th").first().text()) || "Specifications"
      byCategory.set(category, [...(byCategory.get(category) || []), { name, value }])
    })
    detailSpec.length = 0
    byCategory.forEach((specifications, category) => detailSpec.push({ category, specifications }))
  }
  return { name, img: abs($(".specs-photo-main img").attr("src") || "", GSM), quickSpec, detailSpec, source: "GSMArena" }
}

// ---------- Avechi (fallback) ----------

const AVECHI_PREFIX = "avechi:"
const isAvechiProduct = (url: string) => { try { const u = new URL(url); return u.origin === AVECHI && u.pathname.includes("/product/") } catch { return false } }

export async function searchAvechi(query: string): Promise<PhoneSearchResult[]> {
  const html = await fetchHtml(`${AVECHI}/?s=${encodeURIComponent(query)}&post_type=product`)
  const $ = cheerio.load(html)
  const seen = new Set<string>()
  const results: PhoneSearchResult[] = []
  $("a[href*='/product/']").each((_, a) => {
    const href = abs($(a).attr("href") || "", AVECHI).split("?")[0]
    if (!isAvechiProduct(href) || href.replace(/\/$/, "").endsWith("/product") || seen.has(href)) return
    const card = $(a).closest("li, article, .product")
    const title = text(card.find(".woocommerce-loop-product__title, h2, h3").first().text()) || text($(a).attr("title")) || text($(a).text())
    if (!title) return
    seen.add(href)
    const img = card.find("img").first()
    results.push({
      id: AVECHI_PREFIX + encodeURIComponent(href),
      name: title.replace(/avechi/gi, "").trim() || title,
      img: abs(img.attr("data-src") || img.attr("src") || "", AVECHI).replace(/-\d+x\d+(\.[a-z]+)$/i, "$1"),
      description: "Specs from product listing",
      source: "avechi",
    })
  })
  return results.slice(0, 20)
}

const ALLOWED_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "span", "a", "div", "hr"])

/** The product's description tab as safe HTML: formatting tags kept, every attribute and unknown element stripped. */
function sanitizedDescriptionHtml($: cheerio.CheerioAPI): string {
  const panel = $("#tab-description, .woocommerce-Tabs-panel--description").first().clone()
  if (!panel.length) return ""
  panel.find("script, style, iframe, noscript, form, button, img, picture, svg, video").remove()
  panel.find("h2").filter((_, el) => /^description$/i.test(text($(el).text()))).remove()
  panel.find("*").each((_, el) => {
    const node = $(el)
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() || ""
    if (!ALLOWED_TAGS.has(tag)) { node.replaceWith(node.contents()); return }
    const href = node.attr("href")
    for (const name of Object.keys((el as { attribs?: Record<string, string> }).attribs || {})) node.removeAttr(name)
    if (tag === "a" && href && /^https?:/i.test(href)) node.attr("href", href).attr("target", "_blank").attr("rel", "noreferrer noopener")
  })
  return (panel.html() || "").replace(/<(p|div|span|strong|b|em|i|li)>\s*(?:&nbsp;|\s)*<\/\1>/gi, "").trim().slice(0, 30000)
}

/** Parse specs, price and description out of an Avechi product page. Never throws; groups may be empty. */
export function parseAvechiProduct(html: string) {
  const $ = cheerio.load(html)
  const name = (text($("h1").first().text()) || text($("meta[property='og:title']").attr("content"))).replace(/avechi/gi, "").trim()
  const img = abs($("meta[property='og:image']").attr("content") || "", AVECHI)
  const price = text($("p.price, .summary .price").first().text()) || text($("meta[property='product:price:amount']").attr("content"))
  const description = text($(".woocommerce-product-details__short-description").text())
  const sku = text($(".sku").first().text())

  const groups: PhoneDetails["detailSpec"] = []
  const collect = (category: string, specifications: SpecItem[]) => { if (specifications.length) groups.push({ category, specifications }) }

  // WooCommerce "Additional information" attributes
  const attributes: SpecItem[] = []
  $("table.woocommerce-product-attributes tr, table.shop_attributes tr").each((_, row) => {
    const n = text($(row).find("th").text()); const v = text($(row).find("td").text())
    if (n && v) attributes.push({ name: n, value: v })
  })
  collect("Product attributes", attributes)

  // "Key: value" lines from the short description / description tabs, and any spec tables inside them
  const blocks = $(".woocommerce-product-details__short-description, #tab-description, .woocommerce-Tabs-panel--description")
  const lines: SpecItem[] = []
  blocks.find("li, p").each((_, el) => {
    const m = text($(el).text()).match(/^([^:]{2,40}):\s*(.{1,300})$/)
    if (m) lines.push({ name: m[1], value: m[2] })
  })
  collect("Key features", lines)
  blocks.find("table").each((i, table) => {
    const rows: SpecItem[] = []
    $(table).find("tr").each((_, row) => {
      const cells = $(row).find("th, td").map((__, c) => text($(c).text())).get()
      if (cells.length >= 2 && cells[0] && cells[1]) rows.push({ name: cells[0], value: cells.slice(1).join(" ") })
    })
    collect(`Specifications${i ? ` ${i + 1}` : ""}`, rows)
  })

  // Pages that don't use tables or "Key: value" lines: keep bullet points, the full description text and any spec-sheet images
  const features: string[] = []
  blocks.find("li").each((_, el) => {
    const t = text($(el).text())
    if (t && t.length <= 200 && !/^[^:]{2,40}:\s/.test(t) && !features.includes(t)) features.push(t)
  })
  const descriptionHtml = sanitizedDescriptionHtml($)
  const fullDescription = text($("#tab-description, .woocommerce-Tabs-panel--description").first().text()).slice(0, 4000)
  const specImages: string[] = []
  blocks.find("img").each((_, el) => {
    const src = abs($(el).attr("data-src") || $(el).attr("data-lazy-src") || $(el).attr("src") || "", AVECHI).replace(/-\d+x\d+(\.[a-z]+)$/i, "$1")
    if (src.includes("/wp-content/uploads/") && !specImages.includes(src)) specImages.push(src)
  })
  return { name, img, price, sku, description, detailSpec: groups, features: features.slice(0, 40), fullDescription, descriptionHtml, specImages: specImages.slice(0, 6) }
}

export async function getAvechiDevice(id: string): Promise<PhoneDetails> {
  const url = decodeURIComponent(id.slice(AVECHI_PREFIX.length))
  if (!isAvechiProduct(url)) throw new Error("Invalid product url")
  const { name, img, detailSpec: groups } = parseAvechiProduct(await fetchHtml(url))
  if (!name || !groups.length) throw new Error("No specifications found on product page")
  const all = groups.flatMap((g) => g.specifications)
  const pick = (re: RegExp) => all.find((s) => re.test(s.name))?.value || ""
  const quickSpec: SpecItem[] = [
    ["Display size", pick(/display|screen/i)], ["Display resolution", pick(/resolution/i)],
    ["Camera pixels", pick(/camera/i)], ["Video pixels", pick(/video/i)],
    ["RAM size", pick(/ram|memory/i)], ["Chipset", pick(/chipset|processor|cpu/i)],
    ["Battery size", pick(/battery/i)], ["Battery type", ""],
  ].map(([n, v]) => ({ name: n, value: v }))
  return { name, img, quickSpec, detailSpec: groups, source: "Avechi" }
}

export const isAvechiId = (id: string) => id.startsWith(AVECHI_PREFIX)

/** Look up GSMArena specs for a product title; returns null if nothing matches or the site is unreachable. */
export async function findGsmarenaSpecs(title: string): Promise<PhoneDetails | null> {
  const query = title.replace(/avechi/gi, "").replace(/price in kenya|best price|buy|online|\|.*$/gi, "").replace(/\s+/g, " ").trim()
  if (!query) return null
  try {
    const [first] = await searchGsmarena(query)
    return first ? await getGsmarenaDevice(first.id) : null
  } catch (error) {
    console.error("GSMArena lookup failed:", error)
    return null
  }
}
