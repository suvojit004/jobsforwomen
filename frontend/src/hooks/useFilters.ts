import { useState, useCallback } from "react"

export function useFilters<T extends Record<string, any>>(initialFilters: T) {
  const [filters, setFilters] = useState<T>(initialFilters)

  const updateFilter = useCallback((key: keyof T, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(initialFilters)
  }, [initialFilters])

  return {
    filters,
    updateFilter,
    resetFilters,
    setFilters,
  }
}
export default useFilters
