import type { ReactNode } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type ColumnDef<T> = {
  header: string
  accessorKey?: keyof T
  cell?: (row: T) => ReactNode
  className?: string
}

type DataTableProps<T> = {
  columns: ColumnDef<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No records found.",
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto select-none", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-950/45 dark:hover:bg-slate-950/45 border-slate-100 dark:border-slate-800">
            {columns.map((col, idx) => (
              <TableHead
                key={idx}
                className={cn(
                  "text-xs font-black text-slate-500 uppercase tracking-wider dark:text-slate-400 py-3",
                  col.className
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length > 0 ? (
            data.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-slate-100 dark:border-slate-800 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/20"
                )}
              >
                {columns.map((col, idx) => {
                  const content = col.cell
                    ? col.cell(row)
                    : col.accessorKey
                    ? (row[col.accessorKey] as ReactNode)
                    : null

                  return (
                    <TableCell
                      key={idx}
                      className={cn(
                        "text-xs font-semibold text-slate-800 dark:text-slate-200 py-3.5",
                        col.className
                      )}
                    >
                      {content}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-xs font-bold text-slate-400 dark:text-slate-500"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
