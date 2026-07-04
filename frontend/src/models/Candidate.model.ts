export interface ICandidate {
  fullName: string
  role: string
  email: string
  phone: string
  location: string
  experience: string
  currentCtc: string
  expectedCtc: string
  noticePeriod: string
  availability: string
  profileCompletion: number
  skills: string[]
  careerBreakReason: string
  careerBreakDuration: string
  careerBreakSummary: string
  resumeName: string
  resumeUploadDate: string
  resumeVerified: boolean
}

export class CandidateModel implements ICandidate {
  fullName: string
  role: string
  email: string
  phone: string
  location: string
  experience: string
  currentCtc: string
  expectedCtc: string
  noticePeriod: string
  availability: string
  profileCompletion: number
  skills: string[]
  careerBreakReason: string
  careerBreakDuration: string
  careerBreakSummary: string
  resumeName: string
  resumeUploadDate: string
  resumeVerified: boolean

  constructor(data: Partial<ICandidate>) {
    this.fullName = data.fullName || ""
    this.role = data.role || ""
    this.email = data.email || ""
    this.phone = data.phone || ""
    this.location = data.location || ""
    this.experience = data.experience || ""
    this.currentCtc = data.currentCtc || ""
    this.expectedCtc = data.expectedCtc || ""
    this.noticePeriod = data.noticePeriod || ""
    this.availability = data.availability || "Immediate"
    this.profileCompletion = data.profileCompletion || 0
    this.skills = data.skills || []
    this.careerBreakReason = data.careerBreakReason || ""
    this.careerBreakDuration = data.careerBreakDuration || ""
    this.careerBreakSummary = data.careerBreakSummary || ""
    this.resumeName = data.resumeName || ""
    this.resumeUploadDate = data.resumeUploadDate || ""
    this.resumeVerified = data.resumeVerified || false
  }

  static fromDTO(dto: any): CandidateModel {
    return new CandidateModel({
      fullName: dto.fullName || dto.full_name,
      role: dto.role || dto.target_role,
      email: dto.email,
      phone: dto.phone,
      location: dto.location,
      experience: dto.experience || dto.total_experience,
      currentCtc: dto.currentCtc || dto.current_ctc,
      expectedCtc: dto.expectedCtc || dto.expected_ctc,
      noticePeriod: dto.noticePeriod || dto.notice_period,
      availability: dto.availability,
      profileCompletion: dto.profileCompletion || dto.profile_completion_pct || 0,
      skills: dto.skills || [],
      careerBreakReason: dto.careerBreakReason || dto.career_break_reason || "",
      careerBreakDuration: dto.careerBreakDuration || dto.career_break_duration || "",
      careerBreakSummary: dto.careerBreakSummary || dto.career_break_summary || "",
      resumeName: dto.resumeName || dto.resume_name || "",
      resumeUploadDate: dto.resumeUploadDate || dto.resume_upload_date || "",
      resumeVerified: dto.resumeVerified ?? dto.resume_verified ?? false,
    })
  }

  toDTO(): any {
    return {
      full_name: this.fullName,
      target_role: this.role,
      email: this.email,
      phone: this.phone,
      location: this.location,
      total_experience: this.experience,
      current_ctc: this.currentCtc,
      expected_ctc: this.expectedCtc,
      notice_period: this.noticePeriod,
      availability: this.availability,
      profile_completion_pct: this.profileCompletion,
      skills: this.skills,
      career_break_reason: this.careerBreakReason,
      career_break_duration: this.careerBreakDuration,
      career_break_summary: this.careerBreakSummary,
      resume_name: this.resumeName,
      resume_upload_date: this.resumeUploadDate,
      resume_verified: this.resumeVerified,
    }
  }
}
export default CandidateModel
