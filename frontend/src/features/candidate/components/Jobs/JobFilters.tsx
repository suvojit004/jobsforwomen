import { Search, RotateCcw, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/dashboard/DashboardCard"

export type FilterState = {
  search: string
  workMode: string
  jobType: string
  experience: string
  location: string
  womenReturnship: boolean
  menstrualLeaveChampion: boolean
}

type JobFiltersProps = {
  filters: FilterState
  onFilterChange: (filters: Partial<FilterState>) => void
  onClear: () => void
}

export function JobFilters({ filters, onFilterChange, onClear }: JobFiltersProps) {
  return (
    <DashboardCard className="p-4 md:p-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 dark:border-slate-800">
        <h3 className="text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-[#6B2C91] dark:text-pink-300" />
          Filter Opportunities
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 px-2 text-xs text-[#6B2C91] hover:text-[#5a237b] dark:text-pink-200"
        >
          <RotateCcw className="mr-1 size-3" />
          Reset Filters
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {/* Search */}
        <div className="flex flex-col gap-1.5 xl:col-span-2">
          <label htmlFor="search" className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              id="search"
              type="text"
              placeholder="Title, company, skills..."
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2C91]/30 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="location-filter" className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
            Location
          </label>
          <select
            id="location-filter"
            value={filters.location}
            onChange={(e) => onFilterChange({ location: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          >
            <option value="All">All Locations</option>
            <option value="Remote">Remote</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Pune">Pune</option>
            <option value="Hyderabad">Hyderabad</option>
          </select>
        </div>

        {/* Work Mode */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="workMode" className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
            Work Mode
          </label>
          <select
            id="workMode"
            value={filters.workMode}
            onChange={(e) => onFilterChange({ workMode: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          >
            <option value="All">All Modes</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="On-site">On-site</option>
          </select>
        </div>

        {/* Job Type */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="jobType" className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
            Job Type
          </label>
          <select
            id="jobType"
            value={filters.jobType}
            onChange={(e) => onFilterChange({ jobType: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          >
            <option value="All">All Types</option>
            <option value="Full Time">Full Time</option>
            <option value="Part Time">Part Time</option>
          </select>
        </div>

        {/* Experience */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="experience-filter" className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
            Experience Level
          </label>
          <select
            id="experience-filter"
            value={filters.experience}
            onChange={(e) => onFilterChange({ experience: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          >
            <option value="All">All Levels</option>
            <option value="Freshers">Freshers</option>
            <option value="1+ Year">1+ Year</option>
            <option value="2+ Years">2+ Years</option>
            <option value="3+ Years">3+ Years</option>
            <option value="4+ Years">4+ Years</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 border-t border-dashed border-slate-100 pt-3 dark:border-slate-800">
        {/* Women Returnship */}
        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={filters.womenReturnship}
            onChange={(e) => onFilterChange({ womenReturnship: e.target.checked })}
            className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950"
          />
          Women Returnship Support
        </label>

        {/* Menstrual Leave Champion */}
        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={filters.menstrualLeaveChampion}
            onChange={(e) => onFilterChange({ menstrualLeaveChampion: e.target.checked })}
            className="rounded border-slate-300 text-[#6B2C91] focus:ring-[#6B2C91] dark:border-slate-700 dark:bg-slate-950"
          />
          Menstrual Leave Champion
        </label>
      </div>
    </DashboardCard>
  )
}
