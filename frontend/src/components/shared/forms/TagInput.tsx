import React, { useState } from "react"
import { Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface TagInputProps {
  label?: string
  placeholder?: string
  tags: string[]
  onChange: (tags: string[]) => void
  error?: string
}

export function TagInput({ label, placeholder = "Add keyword...", tags, onChange, error }: TagInputProps) {
  const [input, setInput] = useState("")

  const handleAdd = () => {
    const trimmed = input.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
      setInput("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleRemove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className="space-y-1.5 w-full col-span-2">
      {label && (
        <label className="text-xs font-black text-slate-800 dark:text-slate-200">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus-visible:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-extrabold cursor-pointer"
        >
          <Plus className="size-4" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1.5">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] font-bold py-0.5 pl-2 pr-1.5 gap-1 select-none"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                className="hover:text-red-500 rounded-full shrink-0 cursor-pointer"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {error && <span className="text-[10px] font-bold text-red-500">{error}</span>}
    </div>
  )
}
export default TagInput
