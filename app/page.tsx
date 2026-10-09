"use client"

import type React from "react"
import Link from "next/link"
import { Laptop } from "lucide-react"

import { useState } from "react"
import { Search, Smartphone, Loader2, Copy, Check, Download, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

interface PhoneSearchResult {
  id: string
  name: string
  img: string
  description: string
}

interface PhoneDetail {
  name: string
  img: string
  quickSpec: Array<{
    name: string
    value: string
  }>
  detailSpec: Array<{
    category: string
    specifications: Array<{
      name: string
      value: string
    }>
  }>
}

export default function PhoneLookup() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<PhoneSearchResult[]>([])
  const [selectedPhone, setSelectedPhone] = useState<PhoneDetail | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [copiedItems, setCopiedItems] = useState<{ [key: string]: boolean }>({})

  const searchPhones = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setError(null)
    setSelectedPhone(null)

    try {
      const response = await fetch(`/api/search-phones?query=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) {
        throw new Error("Failed to search phones")
      }
      const results = await response.json()
      setSearchResults(results)
    } catch (err) {
      setError("Failed to search phones. Please try again.")
      console.error("Search error:", err)
    } finally {
      setIsSearching(false)
    }
  }

  const getPhoneDetails = async (phoneId: string) => {
    setIsLoadingDetails(true)
    setError(null)

    try {
      const response = await fetch(`/api/phone-details?id=${encodeURIComponent(phoneId)}`)
      if (!response.ok) {
        throw new Error("Failed to get phone details")
      }
      const details = await response.json()
      setSelectedPhone(details)
    } catch (err) {
      setError("Failed to load phone details. Please try again.")
      console.error("Details error:", err)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchPhones()
    }
  }

  const generateEcommerceSummary = (phone: PhoneDetail): string => {
    const getSpecValue = (specName: string): string => {
      const quickSpec = phone.quickSpec?.find((spec) => spec.name.toLowerCase().includes(specName.toLowerCase()))
      if (quickSpec) return quickSpec.value

      for (const category of phone.detailSpec || []) {
        const spec = category.specifications.find((spec) => spec.name.toLowerCase().includes(specName.toLowerCase()))
        if (spec) return spec.value
      }
      return ""
    }

    const launchDate = getSpecValue("announced") || getSpecValue("launch") || "2024"
    const storage = getSpecValue("internal") || getSpecValue("storage") || ""
    const ram = getSpecValue("memory") || getSpecValue("ram") || ""
    const display = getSpecValue("size") || getSpecValue("display") || ""
    const camera = getSpecValue("primary") || getSpecValue("camera") || ""
    const battery = getSpecValue("battery") || ""
    const os = getSpecValue("os") || getSpecValue("android") || ""

    const estimatedPrice = "41,499"

    let summary = `${phone.name} Price at NickLee starts at Kes ${estimatedPrice}. `

    if (launchDate) {
      const year = launchDate.match(/\d{4}/)?.[0] || "2024"
      summary += `Launched in ${year}. `
    }

    summary += "Comes with 2 years warranty. "

    const specs = []
    if (display) specs.push(`${display} display`)
    if (ram && storage) specs.push(`${ram} RAM with ${storage} storage`)
    else if (storage) specs.push(`${storage} storage`)
    if (camera) specs.push(`${camera} camera system`)
    if (battery) specs.push(`${battery} battery`)
    if (os) specs.push(`runs ${os}`)

    if (specs.length > 0) {
      summary += `Features include ${specs.join(", ")}. `
    }

    summary += `This ${phone.name} offers excellent performance and reliability, making it perfect for both personal and professional use. Available at NickLee with fast delivery across Kenya and comprehensive after-sales support.`

    return summary
  }

  const generateSKU = (phone: PhoneDetail): string => {
    const getSpecValue = (specName: string): string => {
      const quickSpec = phone.quickSpec?.find((spec) => spec.name.toLowerCase().includes(specName.toLowerCase()))
      if (quickSpec) return quickSpec.value

      for (const category of phone.detailSpec || []) {
        const spec = category.specifications.find((spec) => spec.name.toLowerCase().includes(specName.toLowerCase()))
        if (spec) return spec.value
      }
      return ""
    }

    // Extract phone details
    const phoneName = phone.name.toLowerCase().trim()
    const ram = getSpecValue("memory") || getSpecValue("ram") || "8gb"
    const storage = getSpecValue("internal") || getSpecValue("storage") || "256gb"
    
    // Determine device type (tablet vs smartphone)
    const isTablet = phoneName.includes("pad") || 
                    phoneName.includes("tablet") || 
                    phoneName.includes("tab ") ||
                    phoneName.includes("matebook") ||
                    phoneName.includes("surface")
    
    const deviceType = isTablet ? "TB" : "SP"
    
    // Extract connectivity (4G/5G)
    const connectivity = phoneName.includes("5g") ? "5G" : "4G"
    
    // Extract RAM amount
    const ramMatch = ram.match(/(\d+)/i)
    const ramAmount = ramMatch ? `R${ramMatch[1]}` : "R8"

    // Extract storage amount
    const storageMatch = storage.match(/(\d+)/i)
    const storageAmount = storageMatch ? `S${storageMatch[1]}` : "S256"

    let sku = ""

    // Xiaomi brand handling
    if (phoneName.includes("xiaomi") || phoneName.includes("redmi") || phoneName.includes("poco")) {
      if (phoneName.includes("poco")) {
        // Xiaomi Poco F7 -> XPCF7
        const brandCode = "XPC"
        const modelMatch = phoneName.match(/poco\s+([a-z]+)(\d+)/i)
        if (modelMatch) {
          const modelLetter = modelMatch[1].charAt(0).toUpperCase() // F
          const modelNumber = modelMatch[2] // 7
          sku = `${brandCode}${modelLetter}${modelNumber}`
        } else {
          sku = "XPCF"
        }
      } else if (phoneName.includes("redmi")) {
        // Xiaomi Redmi Note 15 Pro+ -> XRDN15PP, Xiaomi Redmi Pad 2 -> XRDP
        const brandCode = "XRD"
        if (phoneName.includes("pad")) {
          // Handle Redmi Pad specifically
          const padMatch = phoneName.match(/redmi\s+pad\s+(\d+)?/i)
          if (padMatch) {
            const padNumber = padMatch[1] || ""
            sku = `${brandCode}P${padNumber}`
          } else {
            sku = "XRDP"
          }
        } else if (phoneName.includes("note")) {
          const noteMatch = phoneName.match(/redmi\s+note\s+(\d+)(?:\s+pro)?(\+)?/i)
          if (noteMatch) {
            const noteNumber = noteMatch[1] // 15
            const isProPlus = phoneName.includes("pro+") || phoneName.includes("pro +")
            const isPro = phoneName.includes("pro") && !isProPlus
            
            let suffix = ""
            if (isProPlus) suffix = "PP"
            else if (isPro) suffix = "P"
            
            sku = `${brandCode}N${noteNumber}${suffix}`
          } else {
            sku = "XRDNOTE"
          }
        } else {
          // Regular Redmi without Note or Pad
          const modelMatch = phoneName.match(/redmi\s+(\w+)?(\d+)?/i)
          if (modelMatch) {
            const modelName = modelMatch[1] || ""
            const modelNumber = modelMatch[2] || ""
            sku = `${brandCode}${modelName.charAt(0).toUpperCase()}${modelNumber}`
          } else {
            sku = "XRD"
          }
        }
      } else {
        // Regular Xiaomi
        const brandCode = "XMI"
        const modelMatch = phoneName.match(/xiaomi\s+(\w+)?\s*(\d+)?/i)
        if (modelMatch) {
          const modelName = modelMatch[1] || ""
          const modelNumber = modelMatch[2] || ""
          sku = `${brandCode}${modelName.charAt(0).toUpperCase()}${modelNumber}`
        } else {
          sku = "XMI"
        }
      }
    }
    
    // Tecno brand handling
    else if (phoneName.includes("tecno")) {
      // Tecno Camon 40 Pro -> TC40P
      const brandCode = "T"
      if (phoneName.includes("camon")) {
        const camonMatch = phoneName.match(/camon\s+(\d+)(?:\s+pro)?/i)
        if (camonMatch) {
          const modelNumber = camonMatch[1] // 40
          const isPro = phoneName.includes("pro")
          const suffix = isPro ? "P" : ""
          sku = `${brandCode}C${modelNumber}${suffix}`
        } else {
          sku = "TC"
        }
      } else if (phoneName.includes("spark")) {
        const sparkMatch = phoneName.match(/spark\s+(\d+)(?:\s+pro)?/i)
        if (sparkMatch) {
          const modelNumber = sparkMatch[1]
          const isPro = phoneName.includes("pro")
          const suffix = isPro ? "P" : ""
          sku = `${brandCode}S${modelNumber}${suffix}`
        } else {
          sku = "TS"
        }
      } else {
        // Generic Tecno
        const modelMatch = phoneName.match(/tecno\s+(\w+)(\d+)?/i)
        if (modelMatch) {
          const modelLetter = modelMatch[1].charAt(0).toUpperCase()
          const modelNumber = modelMatch[2] || ""
          sku = `${brandCode}${modelLetter}${modelNumber}`
        } else {
          sku = "T"
        }
      }
    }
    
    // Vivo brand handling
    else if (phoneName.includes("vivo")) {
      // Vivo V60 -> VV60
      const brandCode = "V"
      const modelMatch = phoneName.match(/vivo\s+([a-z])(\d+)/i)
      if (modelMatch) {
        const modelLetter = modelMatch[1].toUpperCase() // V
        const modelNumber = modelMatch[2] // 60
        sku = `${brandCode}${modelLetter}${modelNumber}`
      } else {
        // Try to extract just numbers
        const numberMatch = phoneName.match(/vivo\s+.*?(\d+)/i)
        if (numberMatch) {
          sku = `V${numberMatch[1]}`
        } else {
          sku = "V"
        }
      }
    }
    
    // Samsung brand handling
    else if (phoneName.includes("samsung")) {
      const brandCode = "S"
      if (phoneName.includes("galaxy")) {
        // Samsung Galaxy S24 Ultra -> SGS24U, Samsung Galaxy A16 -> SGA16, Samsung Galaxy Tab S9 -> SGT9
        if (phoneName.includes("tab")) {
          // Handle Galaxy Tab specifically
          const tabMatch = phoneName.match(/galaxy\s+tab\s+([a-z]+)(\d+)(?:\s+(ultra|plus|\+))?/i)
          if (tabMatch) {
            const series = tabMatch[1].charAt(0).toUpperCase() // S, A
            const modelNumber = tabMatch[2] // 9
            const variant = tabMatch[3]
            
            let suffix = ""
            if (variant) {
              if (variant.toLowerCase() === "ultra") suffix = "U"
              else if (variant.toLowerCase() === "plus" || variant === "+") suffix = "P"
            }
            
            sku = `${brandCode}GT${series}${modelNumber}${suffix}`
          } else {
            sku = "SGT"
          }
        } else {
          const galaxyMatch = phoneName.match(/galaxy\s+([a-z]+)(\d+)(?:\s+(ultra|plus|\+))?/i)
          if (galaxyMatch) {
            const series = galaxyMatch[1].charAt(0).toUpperCase() // S, A, Note -> N
            const modelNumber = galaxyMatch[2] // 24, 16
            const variant = galaxyMatch[3]
            
            let suffix = ""
            if (variant) {
              if (variant.toLowerCase() === "ultra") suffix = "U"
              else if (variant.toLowerCase() === "plus" || variant === "+") suffix = "P"
            }
            
            sku = `${brandCode}G${series}${modelNumber}${suffix}`
          } else {
            sku = "SG"
          }
        }
      } else {
        sku = "S"
      }
    }
    
    // Apple brand handling
    else if (phoneName.includes("iphone") || phoneName.includes("apple")) {
      // iPhone 15 Pro Max -> AI15PM
      const brandCode = "A"
      const iphoneMatch = phoneName.match(/iphone\s+(\d+)(?:\s+(pro|plus|mini))?(?:\s+(max))?/i)
      if (iphoneMatch) {
        const modelNumber = iphoneMatch[1] // 15
        const variant1 = iphoneMatch[2] // pro, plus, mini
        const variant2 = iphoneMatch[3] // max
        
        let suffix = ""
        if (variant1) {
          if (variant1.toLowerCase() === "pro") suffix += "P"
          else if (variant1.toLowerCase() === "plus") suffix += "P"
          else if (variant1.toLowerCase() === "mini") suffix += "M"
        }
        if (variant2 && variant2.toLowerCase() === "max") suffix += "M"
        
        sku = `${brandCode}I${modelNumber}${suffix}`
      } else {
        sku = "AI"
      }
    }
    
    // Oppo brand handling
    else if (phoneName.includes("oppo")) {
      // Oppo Reno 12 Pro -> OR12P
      const brandCode = "O"
      if (phoneName.includes("reno")) {
        const renoMatch = phoneName.match(/reno\s+(\d+)(?:\s+pro)?/i)
        if (renoMatch) {
          const modelNumber = renoMatch[1]
          const isPro = phoneName.includes("pro")
          const suffix = isPro ? "P" : ""
          sku = `${brandCode}R${modelNumber}${suffix}`
        } else {
          sku = "OR"
        }
      } else if (phoneName.includes("find")) {
        const findMatch = phoneName.match(/find\s+([a-z]+)(\d+)?/i)
        if (findMatch) {
          const series = findMatch[1].charAt(0).toUpperCase()
          const number = findMatch[2] || ""
          sku = `${brandCode}F${series}${number}`
        } else {
          sku = "OF"
        }
      } else {
        const modelMatch = phoneName.match(/oppo\s+([a-z]+)(\d+)?/i)
        if (modelMatch) {
          const modelLetter = modelMatch[1].charAt(0).toUpperCase()
          const modelNumber = modelMatch[2] || ""
          sku = `${brandCode}${modelLetter}${modelNumber}`
        } else {
          sku = "O"
        }
      }
    }
    
    // OnePlus brand handling
    else if (phoneName.includes("oneplus")) {
      // OnePlus 12 Pro -> OP12P
      const brandCode = "OP"
      const modelMatch = phoneName.match(/oneplus\s+(\d+)(?:\s+pro)?/i)
      if (modelMatch) {
        const modelNumber = modelMatch[1]
        const isPro = phoneName.includes("pro")
        const suffix = isPro ? "P" : ""
        sku = `${brandCode}${modelNumber}${suffix}`
      } else {
        sku = "OP"
      }
    }
    
    // Google Pixel brand handling
    else if (phoneName.includes("pixel") || phoneName.includes("google")) {
      // Google Pixel 8 Pro -> GP8P
      const brandCode = "GP"
      const pixelMatch = phoneName.match(/pixel\s+(\d+)(?:\s+pro)?/i)
      if (pixelMatch) {
        const modelNumber = pixelMatch[1]
        const isPro = phoneName.includes("pro")
        const suffix = isPro ? "P" : ""
        sku = `${brandCode}${modelNumber}${suffix}`
      } else {
        sku = "GP"
      }
    }
    
    // Huawei brand handling
    else if (phoneName.includes("huawei")) {
      // Huawei P60 Pro -> HP60P
      const brandCode = "H"
      const modelMatch = phoneName.match(/huawei\s+([a-z]+)(\d+)(?:\s+pro)?/i)
      if (modelMatch) {
        const series = modelMatch[1].charAt(0).toUpperCase() // P, Mate -> M
        const modelNumber = modelMatch[2]
        const isPro = phoneName.includes("pro")
        const suffix = isPro ? "P" : ""
        sku = `${brandCode}${series}${modelNumber}${suffix}`
      } else {
        sku = "H"
      }
    }
    
    // Realme brand handling
    else if (phoneName.includes("realme")) {
      // Realme GT 7 Pro -> RGT7P
      const brandCode = "R"
      if (phoneName.includes("gt")) {
        const gtMatch = phoneName.match(/gt\s+(\d+)(?:\s+pro)?/i)
        if (gtMatch) {
          const modelNumber = gtMatch[1]
          const isPro = phoneName.includes("pro")
          const suffix = isPro ? "P" : ""
          sku = `${brandCode}GT${modelNumber}${suffix}`
        } else {
          sku = "RGT"
        }
      } else if (phoneName.includes("note")) {
        const noteMatch = phoneName.match(/note\s+(\d+)(?:\s+pro)?/i)
        if (noteMatch) {
          const modelNumber = noteMatch[1]
          const isPro = phoneName.includes("pro")
          const suffix = isPro ? "P" : ""
          sku = `${brandCode}N${modelNumber}${suffix}`
        } else {
          sku = "RN"
        }
      } else {
        // Generic Realme with number
        const numberMatch = phoneName.match(/realme\s+(\d+)(?:\s+pro)?/i)
        if (numberMatch) {
          const modelNumber = numberMatch[1]
          const isPro = phoneName.includes("pro")
          const suffix = isPro ? "P" : ""
          sku = `${brandCode}${modelNumber}${suffix}`
        } else {
          sku = "R"
        }
      }
    }
    
    // Generic fallback for unknown brands
    else {
      const words = phoneName.split(/\s+/).filter(word => word.length > 0)
      if (words.length >= 2) {
        // Take first letter of first word and first letter + numbers from second word
        const brandLetter = words[0].charAt(0).toUpperCase()
        const modelPart = words[1]
        const modelLetter = modelPart.charAt(0).toUpperCase()
        const numberMatch = modelPart.match(/(\d+)/)
        const number = numberMatch ? numberMatch[1] : ""
        
        sku = `${brandLetter}${modelLetter}${number}`
      } else if (words.length === 1) {
        sku = words[0].slice(0, 3).toUpperCase()
      } else {
        sku = "UNK"
      }
    }

    // Add device type, connectivity, RAM, and Storage at the end
    return `${sku}${deviceType}${connectivity}${ramAmount}${storageAmount}`
  }

  const copyToClipboard = async (text: string, itemKey = "default") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems((prev) => ({ ...prev, [itemKey]: true }))
      setTimeout(() => {
        setCopiedItems((prev) => ({ ...prev, [itemKey]: false }))
      }, 2000)

      // Keep legacy support for main copy button
      if (itemKey === "default") {
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      }
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const downloadImage = async (imageUrl: string, phoneName: string) => {
    try {
      // Create a proxy URL to handle CORS issues
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`

      // Try direct download first, fallback to proxy if CORS fails
      let response
      try {
        response = await fetch(imageUrl, { mode: "cors" })
        if (!response.ok) throw new Error("Direct fetch failed")
      } catch {
        response = await fetch(proxyUrl)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${phoneName.replace(/\s+/g, "-").toLowerCase()}-image.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download image:", error)
      // Fallback: open image in new tab
      window.open(imageUrl, "_blank")
    }
  }

  const buyOnNickLee = (phoneName: string) => {
    const searchQuery = phoneName.toLowerCase().replace(/\s+/g, "+")
    const url = `https://nicklee.co.ke/gadget?text=${searchQuery}`
    window.open(url, "_blank")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Smartphone className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Tech Specs Hub</h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Search for smartphones and laptops to get detailed specifications, HD images, and technical details
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <Link href="/compare">
              <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                <Smartphone className="h-4 w-4" />
                Compare Phones
              </Button>
            </Link>
            <Link href="/laptops">
              <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                <Laptop className="h-4 w-4" />
                Search Laptops
              </Button>
            </Link>
          </div>
        </div>

        {/* Search Section */}
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Phones
            </CardTitle>
            <CardDescription>
              Enter a phone name or model (e.g., "iPhone 15", "Samsung Galaxy S24", "Pixel 8")
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter phone name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button onClick={searchPhones} disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="max-w-2xl mx-auto mb-8 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
            <CardContent className="pt-6">
              <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && !selectedPhone && (
          <div className="max-w-4xl mx-auto mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Search Results</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((phone) => (
                <Card key={phone.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardContent className="p-4" onClick={() => getPhoneDetails(phone.id)}>
                    <div className="aspect-square mb-3 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                      <img
                        src={phone.img ? `/api/proxy-image?url=${encodeURIComponent(phone.img)}` : "/modern-smartphone.png"}
                        alt={phone.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = "/modern-smartphone.png"
                        }}
                      />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{phone.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{phone.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Phone Details */}
        {isLoadingDetails && (
          <Card className="max-w-4xl mx-auto">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span className="text-lg">Loading phone details...</span>
            </CardContent>
          </Card>
        )}

        {selectedPhone && (
          <div className="max-w-6xl mx-auto space-y-6">
            <Button variant="outline" onClick={() => setSelectedPhone(null)} className="mb-6">
              ← Back to Results
            </Button>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-3xl">{selectedPhone.name}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(selectedPhone.name, "phoneName")}
                    className="flex items-center gap-2"
                  >
                    {copiedItems.phoneName ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Name
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid lg:grid-cols-2 gap-8">
                  {/* Phone Image */}
                  <div className="space-y-4">
                    <div className="aspect-square max-w-md mx-auto overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                      <img
                        src={selectedPhone.img ? `/api/proxy-image?url=${encodeURIComponent(selectedPhone.img)}` : "/modern-smartphone.png"}
                        alt={selectedPhone.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = "/modern-smartphone.png"
                        }}
                      />
                    </div>

                    <div className="flex gap-3 justify-center">
                      <Button
                        variant="outline"
                        onClick={() => downloadImage(selectedPhone.img || "/modern-smartphone.png", selectedPhone.name)}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download Image
                      </Button>
                      <Button
                        onClick={() => buyOnNickLee(selectedPhone.name)}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Buy on NickLee
                      </Button>
                    </div>
                  </div>

                  {/* Specifications */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Product SKU</h3>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <code className="flex-1 font-mono text-lg font-semibold text-blue-600 dark:text-blue-400">
                          {generateSKU(selectedPhone)}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(generateSKU(selectedPhone), "sku")}
                          className="flex items-center gap-2"
                        >
                          {copiedItems.sku ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy SKU
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Quick Specs */}
                    {selectedPhone.quickSpec && selectedPhone.quickSpec.length > 0 && (
                      <div>
                        <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Key Specifications</h3>
                        <div className="grid gap-2">
                          {selectedPhone.quickSpec.map((spec, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700"
                            >
                              <span className="font-medium text-gray-700 dark:text-gray-300">{spec.name}</span>
                              <Badge variant="secondary">{spec.value}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed Specs */}
                    {selectedPhone.detailSpec && selectedPhone.detailSpec.length > 0 && (
                      <div>
                        <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                          Detailed Specifications
                        </h3>
                        <div className="space-y-6">
                          {selectedPhone.detailSpec.map((category, categoryIndex) => (
                            <div key={categoryIndex}>
                              <h4 className="text-lg font-medium mb-3 text-blue-600 dark:text-blue-400">
                                {category.category}
                              </h4>
                              <div className="space-y-2">
                                {category.specifications.map((spec, specIndex) => (
                                  <div
                                    key={specIndex}
                                    className="grid grid-cols-3 gap-4 py-2 border-b border-gray-100 dark:border-gray-800"
                                  >
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{spec.name}</span>
                                    <span className="col-span-2 text-gray-600 dark:text-gray-400">{spec.value}</span>
                                  </div>
                                ))}
                              </div>
                              {categoryIndex < selectedPhone.detailSpec.length - 1 && <Separator className="mt-4" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SEO-friendly ecommerce summary section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Copy className="h-5 w-5" />
                  Ecommerce Product Summary
                </CardTitle>
                <CardDescription>SEO-optimized product description ready for your ecommerce site</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    value={generateEcommerceSummary(selectedPhone)}
                    readOnly
                    className="min-h-[200px] text-sm leading-relaxed"
                  />
                  <Button
                    onClick={() => copyToClipboard(generateEcommerceSummary(selectedPhone))}
                    className="w-full"
                    variant={isCopied ? "default" : "outline"}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Summary
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* No Results */}
        {searchResults.length === 0 && !isSearching && searchQuery && !selectedPhone && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="text-center py-12">
              <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No phones found</h3>
              <p className="text-gray-600 dark:text-gray-300">Try searching with a different phone name or model</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
