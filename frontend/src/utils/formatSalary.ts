export function formatSalary(min: number, max: number): string {
  return `₹${min} - ${max} LPA`
}

export function parseSalary(salaryString: string): { min: number; max: number } {
  const match = salaryString.replace(/[^\d-]/g, "").split("-")
  if (match.length === 2) {
    return {
      min: parseInt(match[0], 10) || 0,
      max: parseInt(match[1], 10) || 0,
    }
  }
  return { min: 0, max: 0 }
}
export default formatSalary
