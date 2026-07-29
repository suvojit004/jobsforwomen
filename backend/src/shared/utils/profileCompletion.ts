export function calculateProfileCompletion(user: any): number {
  if (!user) return 0
  
  // Admin accounts are always 100% complete
  const isAdmin = user.roles && user.roles.some((ur: any) => 
    ["Admin", "Super Admin", "Moderator", "Support Executive"].includes(ur.role?.name || ur.roleName || "")
  )
  if (isAdmin) return 100

  let filled = 0
  let total = 0

  const isProfileDirect = !user.candidateProfile && !user.recruiterProfile && (user.fullName !== undefined)

  if (user.candidateProfile || (isProfileDirect && user.experience !== undefined)) {
    const profile = user.candidateProfile || user
    const fields = [
      "fullName",
      "title",
      "bio",
      "phone",
      "location",
      "totalExperience",
      "avatarUrl",
      "resumeUrl",
      "noticePeriod",
      "expectedSalary",
      "availability"
    ]
    total = fields.length + 4 // fields + skills + experience + education + careerBreak
    fields.forEach((f) => {
      if (profile[f]) filled++
    })
    if (profile.skills && profile.skills.length > 0) filled++
    if (profile.experience && profile.experience.length > 0) filled++
    if (profile.education && profile.education.length > 0) filled++
    // Bug: this used to only award the point when hasBreak === true, so a
    // candidate who has never taken a career break -- i.e. answered the
    // question "no" -- was structurally capped at 14/15 (93%) and could
    // never reach 100%, no matter how complete the rest of their profile
    // was. careerBreak is null only until the candidate's first profile
    // save (see useProfile.ts's mapProfileToState, which seeds a concrete
    // { hasBreak: false, ... } object from then on) -- so "has the
    // candidate touched this section at all" is what should count toward
    // completion, not which answer they gave.
    if (profile.careerBreak !== null && profile.careerBreak !== undefined) filled++
  } else if (user.recruiterProfile || (isProfileDirect && user.companyId !== undefined)) {
    const profile = user.recruiterProfile || user
    const fields = ["fullName", "phone"]
    total = fields.length + 3 // fields + company name + website + location
    fields.forEach((f) => {
      if (profile[f]) filled++
    })
    const company = profile.company
    if (company) {
      if (company.name) filled++
      if (company.website) filled++
      if (company.location) filled++
    }
  }

  return total > 0 ? Math.round((filled / total) * 100) : 0
}

export default calculateProfileCompletion
