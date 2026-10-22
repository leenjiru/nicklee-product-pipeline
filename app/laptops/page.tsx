"use client"

import type React from "react"
import { useState } from "react"
import { Search, Laptop, Loader2, Copy, Check, Download, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

interface LaptopSearchResult {
  id: string
  name: string
  img: string
  description: string
  price?: string
  brand: string
}

interface LaptopDetail {
  name: string
  img: string
  brand: string
  price?: string
  specifications: {
    processor: string
    ram: string
    storage: string
    display: string
    graphics: string
    battery: string
    weight: string
    os: string
    ports: string[]
    features: string[]
  }
}

export default function LaptopLookup() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<LaptopSearchResult[]>([])
  const [selectedLaptop, setSelectedLaptop] = useState<LaptopDetail | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)

  // Mock laptop data for demonstration
  const mockLaptops: LaptopSearchResult[] = [
    {
      id: "macbook-pro-14",
      name: "MacBook Pro 14-inch M3",
      img: "/macbook-pro.png",
      description: "Apple MacBook Pro with M3 chip, 14-inch Liquid Retina XDR display",
      price: "Kes 280,000",
      brand: "Apple",
    },
    {
      id: "dell-xps-13",
      name: "Dell XPS 13 Plus",
      img: "/dell-xps-laptop.jpg",
      description: "Dell XPS 13 Plus with Intel Core i7, 13.4-inch OLED display",
      price: "Kes 180,000",
      brand: "Dell",
    },
    {
      id: "thinkpad-x1",
      name: "ThinkPad X1 Carbon Gen 11",
      img: "/thinkpad-laptop.jpg",
      description: "Lenovo ThinkPad X1 Carbon with Intel Core i7, 14-inch display",
      price: "Kes 220,000",
      brand: "Lenovo",
    },
    {
      id: "hp-spectre",
      name: "HP Spectre x360 14",
      img: "/hp-spectre-laptop.jpg",
      description: "HP Spectre x360 convertible laptop with Intel Core i7",
      price: "Kes 190,000",
      brand: "HP",
    },
  ]

  const mockLaptopDetails: { [key: string]: LaptopDetail } = {
    "macbook-pro-14": {
      name: "MacBook Pro 14-inch M3",
      img: "/macbook-pro.png",
      brand: "Apple",
      price: "Kes 280,000",
      specifications: {
        processor: "Apple M3 chip with 8-core CPU",
        ram: "16GB unified memory",
        storage: "512GB SSD",
        display: "14.2-inch Liquid Retina XDR display (3024 x 1964)",
        graphics: "10-core GPU",
        battery: "Up to 22 hours video playback",
        weight: "1.55 kg",
        os: "macOS Sonoma",
        ports: ["3x Thunderbolt 4", "HDMI", "SDXC card slot", "MagSafe 3"],
        features: ["Touch ID", "Force Touch trackpad", "Backlit keyboard", "1080p FaceTime HD camera"],
      },
    },
    "dell-xps-13": {
      name: "Dell XPS 13 Plus",
      img: "/dell-xps-laptop.jpg",
      brand: "Dell",
      price: "Kes 180,000",
      specifications: {
        processor: "Intel Core i7-1360P (12th Gen)",
        ram: "16GB LPDDR5",
        storage: "512GB PCIe NVMe SSD",
        display: "13.4-inch OLED touch display (3456 x 2160)",
        graphics: "Intel Iris Xe Graphics",
        battery: "Up to 12 hours",
        weight: "1.24 kg",
        os: "Windows 11 Home",
        ports: ["2x Thunderbolt 4", "USB-C to USB-A adapter"],
        features: ["Fingerprint reader", "Precision touchpad", "Backlit keyboard", "720p webcam"],
      },
    },
    "thinkpad-x1": {
      name: "ThinkPad X1 Carbon Gen 11",
      img: "/thinkpad-laptop.jpg",
      brand: "Lenovo",
      price: "Kes 220,000",
      specifications: {
        processor: "Intel Core i7-1365U (13th Gen)",
        ram: "16GB LPDDR5",
        storage: "512GB PCIe NVMe SSD",
        display: "14-inch WUXGA IPS display (1920 x 1200)",
        graphics: "Intel Iris Xe Graphics",
        battery: "Up to 15 hours",
        weight: "1.12 kg",
        os: "Windows 11 Pro",
        ports: ["2x Thunderbolt 4", "2x USB-A 3.2", "HDMI 2.0", "Audio jack"],
        features: ["TrackPoint", "Fingerprint reader", "Backlit keyboard", "IR camera with Windows Hello"],
      },
    },
    "hp-spectre": {
      name: "HP Spectre x360 14",
      img: "/hp-spectre-laptop.jpg",
      brand: "HP",
      price: "Kes 190,000",
      specifications: {
        processor: "Intel Core i7-1255U (12th Gen)",
        ram: "16GB DDR4",
        storage: "512GB PCIe NVMe SSD",
        display: "14-inch OLED touch display (2880 x 1800)",
        graphics: "Intel Iris Xe Graphics",
        battery: "Up to 13 hours",
        weight: "1.39 kg",
        os: "Windows 11 Home",
        ports: ["2x Thunderbolt 4", "USB-A 3.2", "MicroSD card reader", "Audio jack"],
        features: ["360-degree hinge", "HP Pen support", "Fingerprint reader", "Bang & Olufsen audio"],
      },
    },
  }

  const searchLaptops = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setError(null)
    setSelectedLaptop(null)

    try {
      // Simulate API call with mock data
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const filteredResults = mockLaptops.filter(
        (laptop) =>
          laptop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          laptop.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
          laptop.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )

      setSearchResults(filteredResults)
    } catch (err) {
      setError("Failed to search laptops. Please try again.")
      console.error("Search error:", err)
    } finally {
      setIsSearching(false)
    }
  }

  const getLaptopDetails = async (laptopId: string) => {
    setIsLoadingDetails(true)
    setError(null)

    try {
      // Simulate API call with mock data
      await new Promise((resolve) => setTimeout(resolve, 800))

      const details = mockLaptopDetails[laptopId]
      if (details) {
        setSelectedLaptop(details)
      } else {
        throw new Error("Laptop not found")
      }
    } catch (err) {
      setError("Failed to load laptop details. Please try again.")
      console.error("Details error:", err)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchLaptops()
    }
  }

  const generateEcommerceSummary = (laptop: LaptopDetail): string => {
    const price = laptop.price || "Contact for Price"

    let summary = `${laptop.name} Price at NickLee is ${price}. `
    summary += "Comes with 2 years warranty and free delivery within Nairobi. "

    const specs = []
    if (laptop.specifications.processor) specs.push(`${laptop.specifications.processor}`)
    if (laptop.specifications.ram) specs.push(`${laptop.specifications.ram} RAM`)
    if (laptop.specifications.storage) specs.push(`${laptop.specifications.storage} storage`)
    if (laptop.specifications.display) specs.push(`${laptop.specifications.display}`)
    if (laptop.specifications.weight) specs.push(`weighs ${laptop.specifications.weight}`)

    if (specs.length > 0) {
      summary += `Key features include ${specs.join(", ")}. `
    }

    if (laptop.specifications.features.length > 0) {
      summary += `Additional features: ${laptop.specifications.features.slice(0, 3).join(", ")}. `
    }

    summary += `This ${laptop.name} offers excellent performance for both professional work and personal use. Perfect for students, professionals, and creative work. Available at NickLee with comprehensive after-sales support and technical assistance.`

    return summary
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const downloadImage = async (imageUrl: string, laptopName: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${laptopName.replace(/\s+/g, "-").toLowerCase()}-image.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download image:", error)
    }
  }

  const buyOnNickLee = (laptopName: string) => {
    const searchQuery = laptopName.toLowerCase().replace(/\s+/g, "+")
    const url = `https://nicklee.co.ke/gadget?text=${searchQuery}`
    window.open(url, "_blank")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Laptop className="h-8 w-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Laptop Specs Finder</h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Search for any laptop to get detailed specifications, images, and technical details
          </p>
        </div>

        {/* Search Section */}
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Laptops
            </CardTitle>
            <CardDescription>
              Enter a laptop name or brand (e.g., "MacBook Pro", "Dell XPS", "ThinkPad")
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter laptop name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button onClick={searchLaptops} disabled={isSearching || !searchQuery.trim()}>
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
        {searchResults.length > 0 && !selectedLaptop && (
          <div className="max-w-4xl mx-auto mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Search Results</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((laptop) => (
                <Card key={laptop.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardContent className="p-4" onClick={() => getLaptopDetails(laptop.id)}>
                    <div className="aspect-video mb-3 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                      <img
                        src={laptop.img || "/placeholder.svg"}
                        alt={laptop.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{laptop.brand}</Badge>
                      {laptop.price && <Badge className="bg-green-600">{laptop.price}</Badge>}
                    </div>
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{laptop.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{laptop.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Laptop Details */}
        {isLoadingDetails && (
          <Card className="max-w-4xl mx-auto">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span className="text-lg">Loading laptop details...</span>
            </CardContent>
          </Card>
        )}

        {selectedLaptop && (
          <div className="max-w-6xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-3xl">{selectedLaptop.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedLaptop.brand}</Badge>
                    {selectedLaptop.price && (
                      <Badge className="bg-green-600 text-lg px-3 py-1">{selectedLaptop.price}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid lg:grid-cols-2 gap-8">
                  {/* Laptop Image */}
                  <div className="space-y-4">
                    <div className="aspect-video max-w-md mx-auto overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                      <img
                        src={selectedLaptop.img || "/placeholder.svg"}
                        alt={selectedLaptop.name}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="flex gap-3 justify-center">
                      <Button
                        variant="outline"
                        onClick={() => downloadImage(selectedLaptop.img, selectedLaptop.name)}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download Image
                      </Button>
                      <Button
                        onClick={() => buyOnNickLee(selectedLaptop.name)}
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
                      <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Specifications</h3>
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Processor</span>
                          <span className="col-span-2 text-gray-600 dark:text-gray-400">
                            {selectedLaptop.specifications.processor}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium text-gray-700 dark:text-gray-300">RAM</span>
                          <span className="col-span-2 text-gray-600 dark:text-gray-400">
                            {selectedLaptop.specifications.ram}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Storage</span>
                          <span className="col-span-2 text-gray-600 dark:text-gray-400">
                            {selectedLaptop.specifications.storage}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Display</span>
                          <span className="col-span-2 text-gray-600 dark:text-gray-400">
                            {selectedLaptop.specifications.display}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Graphics</span>
                          <span className="col-span-2 text-gray-600 dark:text-gray-400">
                            {selectedLaptop.specifications.graphics}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Battery</span>
                          <span className="col-span-2 text-gray-600 dark:text-gray-400">
                            {selectedLaptop.specifications.battery}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Weight</span>
                          <span className="col-span-2 text-gray-600 dark:text-gray-400">
                            {selectedLaptop.specifications.weight}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Operating System</span>
                          <span className="col-span-2 text-gray-600 dark:text-gray-400">
                            {selectedLaptop.specifications.os}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="text-lg font-medium mb-3 text-purple-600 dark:text-purple-400">
                        Ports & Connectivity
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedLaptop.specifications.ports.map((port, index) => (
                          <Badge key={index} variant="secondary">
                            {port}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-medium mb-3 text-purple-600 dark:text-purple-400">Key Features</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedLaptop.specifications.features.map((feature, index) => (
                          <Badge key={index} variant="outline">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
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
                    value={generateEcommerceSummary(selectedLaptop)}
                    readOnly
                    className="min-h-[200px] text-sm leading-relaxed"
                  />
                  <Button
                    onClick={() => copyToClipboard(generateEcommerceSummary(selectedLaptop))}
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
        {searchResults.length === 0 && !isSearching && searchQuery && !selectedLaptop && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="text-center py-12">
              <Laptop className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No laptops found</h3>
              <p className="text-gray-600 dark:text-gray-300">Try searching with a different laptop name or brand</p>
            </CardContent>
          </Card>
        )}

        {/* Default State */}
        {!searchQuery && searchResults.length === 0 && !selectedLaptop && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="text-center py-12">
              <Laptop className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Search for Laptops</h3>
              <p className="text-gray-600 dark:text-gray-300">Enter a laptop name or brand above to get started</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
