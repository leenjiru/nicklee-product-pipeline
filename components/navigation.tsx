"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Smartphone, Laptop, BarChart3, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    {
      href: "/",
      label: "Phone Search",
      icon: Smartphone,
      active: pathname === "/",
    },
    {
      href: "/compare",
      label: "Compare Phones",
      icon: BarChart3,
      active: pathname === "/compare",
    },
    {
      href: "/laptops",
      label: "Laptop Search",
      icon: Laptop,
      active: pathname === "/laptops",
    },
    {
      href: "/images",
      label: "Net Images",
      icon: ImageIcon,
      active: pathname === "/images",
    },
  ]

  return (
    <nav className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-full border border-gray-200 dark:border-gray-700 p-2 shadow-lg">
        <div className="flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={item.active ? "default" : "ghost"}
                  size="sm"
                  className={`flex items-center gap-2 rounded-full ${
                    item.active
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
