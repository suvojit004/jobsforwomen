export function formatDate(dateString: string | Date): string {
  if (!dateString) return ""
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return String(dateString)

  const day = date.getDate()
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ]
  const month = monthNames[date.getMonth()]
  const year = date.getFullYear()

  return `${day} ${month} ${year}`
}

export function formatTimeAgo(timeString: string): string {
  // Pass-through if already a relative time string (e.g. "10 mins ago")
  if (timeString.includes("ago") || timeString.includes("Yesterday")) {
    return timeString
  }
  return timeString
}
export default formatDate
