# 15. UI Component Library

The frontend features a reusable, accessible, and responsive component library designed with Tailwind CSS, HSL design tokens, and Framer Motion.

---

## 15.1 Core Shared Components

### 1. `DashboardCard` (`DashboardCard.tsx`)
* **Purpose**: Uniform wrapper card used across recruiter, candidate, and admin dashboard panels.
* **Props**:
  * `children: React.ReactNode`
  * `className?: string` (custom Tailwind overrides)
* **Usage**:
  ```tsx
  import { DashboardCard } from "@/components/shared/DashboardCard"
  
  export function ProfileSection() {
    return (
      <DashboardCard className="p-6">
        <h3>Profile Info</h3>
      </DashboardCard>
    )
  }
  ```

### 2. `CompanyLogo` (`CompanyLogo.tsx`)
* **Purpose**: Generates a stylized placeholder logo based on the company's name or code (e.g. "JW"), using dynamic HSL backgrounds based on character hashes.
* **Props**:
  * `code: string` (e.g., "TN", "BF")
  * `tone?: "purple" | "green" | "blue" | "pink"`
  * `url?: string` (Optional URL to render the company's uploaded logo instead of a placeholder)

### 3. `MenstrualLeaveChampionBadge` (`MenstrualLeaveChampionBadge.tsx`)
* **Purpose**: A stylized badge displaying paid menstrual leave benefits.
* **Usage**: Renders on job cards and detail views to highlight certified progressive employers.

### 4. `StatusBadge` (`StatusBadge.tsx`)
* **Purpose**: Standardized badge helper for rendering user, company, or application statuses with context-based color coding.
* **Props**:
  * `status: string`
  * `type: "user" | "company" | "job" | "application"`

### 5. `EmptyState` (`EmptyState.tsx`)
* **Purpose**: Displayed when list queries (jobs, applicants, notifications) return empty.
* **Props**:
  * `icon: LucideIcon` (Icon from lucide-react)
  * `title: string`
  * `description: string`
  * `actionLabel?: string`
  * `onActionClick?: () => void`

### 6. `Pagination` (`Pagination.tsx`)
* **Purpose**: Consistent footer component for page controls across tables and lists.
* **Props**:
  * `currentPage: number`
  * `totalPages: number`
  * `onPageChange: (page: number) => void`

### 7. `DataTable` (`DataTable.tsx`)
* **Purpose**: Tabular data component equipped with column mappings, custom row cell rendering, and pagination wrappers.
* **Props**:
  * `columns: Array<{ header: string, accessor: string, render?: (val: any) => React.ReactNode }>`
  * `data: any[]`
  * `isLoading?: boolean`
