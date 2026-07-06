export function calculateProfileCompletion(user: any): number {
  if (!user) return 0
  
  // Admin accounts are always 100% complete
  const isAdmin = user.roles && user.roles.some((ur: any) => 
    ["Admin", "Super Admin", "Moderator", "Support Executive"].includes(ur.role?.name || ur.roleName || "")
  )
  if (isAdmin) return 100

  let filled = 0
  let total = 0

  if (user.candidateProfile) {
    const profile = user.candidateProfile
    const fields = ["fullName", "title", "bio", "avatarUrl", "resumeUrl", "noticePeriod", "expectedSalary"]
    total = fields.length + 3 // fields + skills + experience + education
    fields.forEach((f) => {
      if (profile[f]) filled++
    })
    if (profile.skills && profile.skills.length > 0) filled++
    if (profile.experience && profile.experience.length > 0) filled++
    if (profile.education && profile.education.length > 0) filled++
  } else if (user.recruiterProfile) {
    const profile = user.recruiterProfile
    const fields = ["fullName", "phone"]
    total = fields.length + 3 // fields + company name + website + location
    fields.forEach((f) => {
      if (profile[f]) filled++
    })
    if (profile.company) {
      if (profile.company.name) filled++
      if (profile.company.website) filled++
      if (profile.company.location) filled++
    }
  }

  return total > 0 ? Math.round((filled / total) * 100) : 0
}

export default calculateProfileCompletion
