import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const filters = [
  "Remote",
  "Hybrid",
  "Flexible Hours",
  "Full Time",
  "Part Time",
  "Women Returnship",
]

export function QuickFilters() {
  const [selectedFilters, setSelectedFilters] = useState<string[]>([
    "Remote",
    "Hybrid",
    "Flexible Hours",
    "Full Time",
  ])

  const toggleFilter = (filter: string) => {
    setSelectedFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter]
    )
  }

  return (
    <section className="rounded-xl border border-slate-200/70 bg-white px-4 py-3 shadow-[0_8px_28px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/72">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-2 text-sm font-extrabold text-slate-950 dark:text-white">
          Quick Filters
        </h2>
        {filters.map((filter) => {
          const isSelected = selectedFilters.includes(filter)

          return (
            <button
              key={filter}
              type="button"
              onClick={() => toggleFilter(filter)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]",
                isSelected
                  ? "bg-[#6B2C91] text-white shadow-sm hover:bg-[#5a237b]"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-[#6B2C91] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-violet-500/10 dark:hover:text-pink-100"
              )}
              aria-pressed={isSelected}
            >
              <span
                className={cn(
                  "flex size-3.5 items-center justify-center rounded-[4px] ring-1",
                  isSelected
                    ? "bg-white text-[#6B2C91] ring-white"
                    : "bg-white text-transparent ring-slate-300 dark:bg-slate-900 dark:ring-slate-700"
                )}
              >
                <Check className="size-3" />
              </span>
              {filter}
            </button>
          )
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7 text-xs text-[#6B2C91] dark:text-pink-200"
          onClick={() => setSelectedFilters([])}
        >
          Clear All
        </Button>
      </div>
    </section>
  )
}
