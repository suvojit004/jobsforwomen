import { useState, useMemo } from "react"

export function useSearch<T>(items: T[], searchFields: Array<keyof T>) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const query = searchQuery.toLowerCase()

    return items.filter((item) => {
      return searchFields.some((field) => {
        const val = item[field]
        if (val === null || val === undefined) return false
        return String(val).toLowerCase().includes(query)
      })
    })
  }, [items, searchQuery, searchFields])

  return {
    searchQuery,
    setSearchQuery,
    filteredItems,
  }
}
export default useSearch
