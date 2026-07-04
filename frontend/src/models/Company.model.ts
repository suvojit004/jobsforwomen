export interface ICompany {
  name: string
  website: string
  description: string
  employees: string
  industry: string
  location: string
  menstrualLeaveChampion: boolean
  workFromHome: boolean
  flexibleHours: boolean
  learningBudget: boolean
  childcareSupport: boolean
}

export class CompanyModel implements ICompany {
  name: string
  website: string
  description: string
  employees: string
  industry: string
  location: string
  menstrualLeaveChampion: boolean
  workFromHome: boolean
  flexibleHours: boolean
  learningBudget: boolean
  childcareSupport: boolean

  constructor(data: Partial<ICompany>) {
    this.name = data.name || ""
    this.website = data.website || ""
    this.description = data.description || ""
    this.employees = data.employees || "1-10 employees"
    this.industry = data.industry || ""
    this.location = data.location || ""
    this.menstrualLeaveChampion = data.menstrualLeaveChampion ?? false
    this.workFromHome = data.workFromHome ?? false
    this.flexibleHours = data.flexibleHours ?? false
    this.learningBudget = data.learningBudget ?? false
    this.childcareSupport = data.childcareSupport ?? false
  }

  static fromDTO(dto: any): CompanyModel {
    return new CompanyModel({
      name: dto.name || dto.company_name || "",
      website: dto.website || dto.company_website || "",
      description: dto.description || dto.company_description || "",
      employees: dto.employees || dto.company_size || "1-10 employees",
      industry: dto.industry || dto.company_sector || "",
      location: dto.location || dto.company_hq || "",
      menstrualLeaveChampion: dto.menstrualLeaveChampion ?? dto.menstrual_leave_champion ?? false,
      workFromHome: dto.workFromHome ?? dto.wfh_stipend ?? false,
      flexibleHours: dto.flexibleHours ?? dto.flexible_hours ?? false,
      learningBudget: dto.learningBudget ?? dto.learning_budget ?? false,
      childcareSupport: dto.childcareSupport ?? dto.childcare_support ?? false,
    })
  }

  toDTO(): any {
    return {
      company_name: this.name,
      company_website: this.website,
      company_description: this.description,
      company_size: this.employees,
      company_sector: this.industry,
      company_hq: this.location,
      menstrual_leave_champion: this.menstrualLeaveChampion,
      wfh_stipend: this.workFromHome,
      flexible_hours: this.flexibleHours,
      learning_budget: this.learningBudget,
      childcare_support: this.childcareSupport,
    }
  }
}
export default CompanyModel
