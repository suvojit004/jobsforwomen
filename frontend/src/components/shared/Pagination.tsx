import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type PaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }).map((_, i) => i + 1)

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-6" aria-label="Pagination Navigation">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="h-8 gap-1 border-slate-200 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-800 text-xs font-bold"
        aria-label="Previous Page"
      >
        <ChevronLeft className="size-4" />
        Previous
      </Button>

      {pages.map((page) => (
        <Button
          key={page}
          type="button"
          onClick={() => onPageChange(page)}
          className={`h-8 w-8 text-xs font-bold rounded-lg transition-colors ${
            currentPage === page
              ? "bg-[#6B2C91] text-white hover:bg-[#5a237b]"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
          aria-label={`Page ${page}`}
          aria-current={currentPage === page ? "page" : undefined}
        >
          {page}
        </Button>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="h-8 gap-1 border-slate-200 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-800 text-xs font-bold"
        aria-label="Next Page"
      >
        Next
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  )
}
