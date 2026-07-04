import { Check } from "lucide-react"

interface MultiSelectProps {
  label?: string
  options: Array<{ value: string; label: string }>
  selected: string[]
  onChange: (selected: string[]) => void
  error?: string
}

export function MultiSelect({ label, options, selected, onChange, error }: MultiSelectProps) {
  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((s) => s !== val))
    } else {
      onChange([...selected, val])
    }
  }

  return (
    <div className="space-y-1.5 w-full col-span-2">
      {label && (
        <span className="text-xs font-black text-slate-800 dark:text-slate-200">
          {label}
        </span>
      )}
      <div className="grid gap-2 sm:grid-cols-2 p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
        {options.map((opt) => {
          const isChecked = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleOption(opt.value)}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                isChecked
                  ? "border-[#6B2C91] bg-purple-50/20 text-[#6B2C91] dark:border-pink-500 dark:bg-pink-950/10 dark:text-pink-300 font-extrabold"
                  : "border-slate-100 hover:bg-slate-50 text-slate-600 dark:border-slate-850 dark:hover:bg-slate-850 dark:text-slate-400 font-semibold"
              }`}
            >
              <span>{opt.label}</span>
              {isChecked && <Check className="size-3.5 shrink-0" />}
            </button>
          )
        })}
      </div>
      {error && <span className="text-[10px] font-bold text-red-500">{error}</span>}
    </div>
  )
}
export default MultiSelect
