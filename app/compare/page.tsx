"use client"

import type React from "react"
import { useState } from "react"
import { Search, Smartphone, Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

interface ComparisonScore {
  phone: PhoneDetail
  score: number
  strengths: string[]
  weaknesses: string[]
}

export default function PhoneComparison() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<PhoneSearchResult[]>([])
  const [selectedPhones, setSelectedPhones] = useState<PhoneDetail[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comparisonScores, setComparisonScores] = useState<ComparisonScore[]>([])

  const searchPhones = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setError(null)

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

  const addPhoneToComparison = async (phoneId: string) => {
    if (selectedPhones.length >= 3) {
      setError("You can compare up to 3 phones at a time")
      return
    }

    try {
      const response = await fetch(`/api/phone-details?id=${encodeURIComponent(phoneId)}`)
      if (!response.ok) {
        throw new Error("Failed to get phone details")
      }
      const details = await response.json()

      // Check if phone is already selected
      if (selectedPhones.some((phone) => phone.name === details.name)) {
        setError("This phone is already in comparison")
        return
      }

      setSelectedPhones((prev) => [...prev, details])
      setSearchResults([])
      setSearchQuery("")
      setError(null)
    } catch (err) {
      setError("Failed to add phone to comparison")
      console.error("Add phone error:", err)
    }
  }

  const removePhoneFromComparison = (index: number) => {
    setSelectedPhones((prev) => prev.filter((_, i) => i !== index))
    setComparisonScores([])
  }

  const calculateComparisonScores = () => {
    if (selectedPhones.length < 2) return

    const scores: ComparisonScore[] = selectedPhones.map((phone) => {
      let score = 0
      const strengths: string[] = []
      const weaknesses: string[] = []

      // Get key specs for scoring
      const getSpecValue = (specName: string): string => {
        const quickSpec = phone.quickSpec?.find((spec) => spec.name.toLowerCase().includes(specName.toLowerCase()))
        if (quickSpec) return quickSpec.value

        for (const category of phone.detailSpec || []) {
          const spec = category.specifications.find((spec) => spec.name.toLowerCase().includes(specName.toLowerCase()))
          if (spec) return spec.value
        }
        return ""
      }

      // Score based on various factors
      const ram = getSpecValue("memory") || getSpecValue("ram")
      const storage = getSpecValue("internal") || getSpecValue("storage")
      const camera = getSpecValue("primary") || getSpecValue("camera")
      const battery = getSpecValue("battery")
      const display = getSpecValue("size") || getSpecValue("display")

      // RAM scoring
      if (ram) {
        const ramValue = Number.parseInt(ram.match(/\d+/)?.[0] || "0")
        if (ramValue >= 12) {
          score += 25
          strengths.push("High RAM (12GB+)")
        } else if (ramValue >= 8) {
          score += 20
          strengths.push("Good RAM (8GB+)")
        } else if (ramValue >= 6) {
          score += 15
        } else if (ramValue < 4) {
          weaknesses.push("Low RAM")
        }
      }

      // Storage scoring
      if (storage) {
        const storageValue = Number.parseInt(storage.match(/\d+/)?.[0] || "0")
        if (storageValue >= 512) {
          score += 20
          strengths.push("Large Storage (512GB+)")
        } else if (storageValue >= 256) {
          score += 15
          strengths.push("Good Storage (256GB+)")
        } else if (storageValue >= 128) {
          score += 10
        } else if (storageValue < 64) {
          weaknesses.push("Limited Storage")
        }
      }

      // Camera scoring
      if (camera) {
        const cameraValue = Number.parseInt(camera.match(/\d+/)?.[0] || "0")
        if (cameraValue >= 108) {
          score += 20
          strengths.push("Excellent Camera (108MP+)")
        } else if (cameraValue >= 64) {
          score += 15
          strengths.push("Good Camera (64MP+)")
        } else if (cameraValue >= 48) {
          score += 10
        } else if (cameraValue < 12) {
          weaknesses.push("Basic Camera")
        }
      }

      // Battery scoring
      if (battery) {
        const batteryValue = Number.parseInt(battery.match(/\d+/)?.[0] || "0")
        if (batteryValue >= 5000) {
          score += 20
          strengths.push("Large Battery (5000mAh+)")
        } else if (batteryValue >= 4000) {
          score += 15
          strengths.push("Good Battery (4000mAh+)")
        } else if (batteryValue >= 3000) {
          score += 10
        } else if (batteryValue < 3000) {
          weaknesses.push("Small Battery")
        }
      }

      // Display scoring
      if (display) {
        const displaySize = Number.parseFloat(display.match(/\d+\.?\d*/)?.[0] || "0")
        if (displaySize >= 6.7) {
          score += 15
          strengths.push('Large Display (6.7"+)')
        } else if (displaySize >= 6.1) {
          score += 10
        } else if (displaySize < 5.5) {
          weaknesses.push("Small Display")
        }
      }

      return { phone, score, strengths, weaknesses }
    })

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score)
    setComparisonScores(scores)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchPhones()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Smartphone className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Phone Comparison</h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Compare up to 3 phones side by side and get intelligent rankings
          </p>
        </div>

        {/* Selected Phones */}
        {selectedPhones.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Selected Phones ({selectedPhones.length}/3)
              </h2>
              {selectedPhones.length >= 2 && (
                <Button onClick={calculateComparisonScores} className="bg-green-600 hover:bg-green-700">
                  Compare & Rank
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {selectedPhones.map((phone, index) => (
                <Card key={index} className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 z-10"
                    onClick={() => removePhoneFromComparison(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <CardContent className="p-4">
                    <div className="aspect-square mb-3 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                      <img
                        src={phone.img || "/modern-smartphone.png"}
                        alt={phone.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{phone.name}</h3>
                    {phone.quickSpec && (
                      <div className="space-y-1">
                        {phone.quickSpec.slice(0, 3).map((spec, specIndex) => (
                          <div key={specIndex} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{spec.name}</span>
                            <span className="text-gray-900 dark:text-white font-medium">{spec.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Comparison Results */}
        {comparisonScores.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Comparison Results</h2>
            <div className="space-y-4">
              {comparisonScores.map((result, index) => (
                <Card
                  key={index}
                  className={`${index === 0 ? "border-green-500 bg-green-50 dark:bg-green-900/20" : ""}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {index === 0 && <Badge className="bg-green-600">Winner</Badge>}
                        {index === 1 && <Badge variant="secondary">2nd Place</Badge>}
                        {index === 2 && <Badge variant="outline">3rd Place</Badge>}
                        {result.phone.name}
                      </CardTitle>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        Score: {result.score}/100
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">Strengths</h4>
                        <ul className="space-y-1">
                          {result.strengths.map((strength, i) => (
                            <li key={i} className="text-sm text-gray-600 dark:text-gray-300">
                              • {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">Areas for Improvement</h4>
                        <ul className="space-y-1">
                          {result.weaknesses.length > 0 ? (
                            result.weaknesses.map((weakness, i) => (
                              <li key={i} className="text-sm text-gray-600 dark:text-gray-300">
                                • {weakness}
                              </li>
                            ))
                          ) : (
                            <li className="text-sm text-gray-600 dark:text-gray-300">• No major weaknesses found</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Search Section */}
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Add Phone to Comparison
            </CardTitle>
            <CardDescription>Search and add phones to compare (up to 3 phones)</CardDescription>
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
        {searchResults.length > 0 && (
          <div className="max-w-4xl mx-auto mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Search Results</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((phone) => (
                <Card key={phone.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="aspect-square mb-3 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                      <img
                        src={phone.img || "/placeholder.svg"}
                        alt={phone.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = "/modern-smartphone.png"
                        }}
                      />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{phone.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-3">{phone.description}</p>
                    <Button
                      onClick={() => addPhoneToComparison(phone.id)}
                      className="w-full"
                      disabled={selectedPhones.length >= 3}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Compare
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {selectedPhones.length === 0 && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="text-center py-12">
              <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Start Comparing Phones</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Search and add phones above to start comparing their specifications
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
