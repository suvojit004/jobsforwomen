export interface IApplication {
  id: string
  company: string
  companyCode: string
  job: string
  appliedDate: string
  status: string
  interviewDate?: string
  recruiter?: string
}

export class ApplicationModel implements IApplication {
  id: string
  company: string
  companyCode: string
  job: string
  appliedDate: string
  status: string
  interviewDate?: string
  recruiter?: string

  constructor(data: Partial<IApplication>) {
    this.id = data.id || ""
    this.company = data.company || ""
    this.companyCode = data.companyCode || ""
    this.job = data.job || ""
    this.appliedDate = data.appliedDate || new Date().toLocaleDateString("en-GB")
    this.status = data.status || "Applied"
    this.interviewDate = data.interviewDate
    this.recruiter = data.recruiter
  }

  static fromDTO(dto: any): ApplicationModel {
    return new ApplicationModel({
      id: dto.id || dto.application_id,
      company: dto.company || dto.company_name,
      companyCode: dto.companyCode || dto.company_code,
      job: dto.job || dto.job_title,
      appliedDate: dto.appliedDate || dto.applied_date,
      status: dto.status || dto.application_status || "Applied",
      interviewDate: dto.interviewDate || dto.interview_date,
      recruiter: dto.recruiter || dto.recruiter_name,
    })
  }

  toDTO(): any {
    return {
      application_id: this.id,
      company_name: this.company,
      company_code: this.companyCode,
      job_title: this.job,
      applied_date: this.appliedDate,
      application_status: this.status,
      interview_date: this.interviewDate,
      recruiter_name: this.recruiter,
    }
  }
}
export default ApplicationModel
