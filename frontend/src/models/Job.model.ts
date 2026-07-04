export type JobLogoTone = "purple" | "green" | "blue" | "pink"

export interface IJob {
  id: string
  title: string
  company: string
  companyCode: string
  logoTone: JobLogoTone
  salary: string
  location: string
  experience: string
  type: string
  workMode: "Remote" | "Hybrid" | "On-site"
  postedAt: string
}

export class JobModel implements IJob {
  id: string
  title: string
  company: string
  companyCode: string
  logoTone: JobLogoTone
  salary: string
  location: string
  experience: string
  type: string
  workMode: "Remote" | "Hybrid" | "On-site"
  postedAt: string

  constructor(data: Partial<IJob>) {
    this.id = data.id || ""
    this.title = data.title || ""
    this.company = data.company || ""
    this.companyCode = data.companyCode || ""
    this.logoTone = data.logoTone || "purple"
    this.salary = data.salary || ""
    this.location = data.location || ""
    this.experience = data.experience || ""
    this.type = data.type || "Full Time"
    this.workMode = data.workMode || "Remote"
    this.postedAt = data.postedAt || new Date().toLocaleDateString("en-GB")
  }

  static fromDTO(dto: any): JobModel {
    return new JobModel({
      id: dto.id || dto.job_id,
      title: dto.title || dto.job_title,
      company: dto.company || dto.company_name,
      companyCode: dto.companyCode || dto.company_code || "TN",
      logoTone: dto.logoTone || dto.logo_tone || "purple",
      salary: dto.salary || dto.salary_range,
      location: dto.location || dto.job_location,
      experience: dto.experience || dto.required_experience,
      type: dto.type || dto.job_type,
      workMode: dto.workMode || dto.work_mode || "Remote",
      postedAt: dto.postedAt || dto.posted_at,
    })
  }

  toDTO(): any {
    return {
      job_id: this.id,
      job_title: this.title,
      company_name: this.company,
      company_code: this.companyCode,
      logo_tone: this.logoTone,
      salary_range: this.salary,
      job_location: this.location,
      required_experience: this.experience,
      job_type: this.type,
      work_mode: this.workMode,
      posted_at: this.postedAt,
    }
  }
}
export default JobModel
