export function formatExperience(years: number): string {
  if (years === 0) return "Fresher"
  if (years === 1) return "1 Year"
  return `${years}+ Years`
}
export default formatExperience
