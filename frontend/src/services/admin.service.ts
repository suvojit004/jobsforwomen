import {
  initialAdminData,
  mockCandidates,
  mockRecruiters,
  mockAdmins,
} from "@/mock/admin/adminMock"
import type {
  CandidateUser,
  RecruiterUser,
  AdminUser,
} from "@/mock/admin/adminMock"
import { mockJobs } from "@/mock/jobs/jobsMock"

export interface AdminJob {
  id: string
  title: string
  company: string
  salary: string
  location: string
  status: "approved" | "flagged"
  reported: boolean
  visibility: "visible" | "hidden"
  applicantsCount: number
}

export interface AdminCompany {
  id: string
  name: string
  website: string
  industry: string
  location: string
  claimedPerks: string[]
  status: "pending" | "approved" | "rejected" | "info_requested"
  feedback?: string
}

export interface AdminAuditLog {
  id: string
  timestamp: string
  operator: string
  category: "User Management" | "Job Moderation" | "Corporate Perks" | "Feature Flags" | "Security Settings"
  action: string
  ipAddress: string
}

export class AdminService {
  private static adminStats = { ...initialAdminData }
  private static candidatesList = [...mockCandidates]
  private static recruitersList = [...mockRecruiters]
  private static adminsList = [...mockAdmins]

  private static companiesList: AdminCompany[] = [
    {
      id: "comp-1",
      name: "TechNova Solutions",
      website: "www.technova.com",
      industry: "Software & Technology",
      location: "Bengaluru, Karnataka",
      claimedPerks: ["Paid Menstrual Leave Program", "Work From Home Support", "Flexible Shift Hours"],
      status: "pending",
    },
    {
      id: "comp-2",
      name: "Creative Minds Agency",
      website: "www.creativeminds.io",
      industry: "Design & Brand Marketing",
      location: "Mumbai, Maharashtra",
      claimedPerks: ["Flexible Onboarding Returnship", "Hybrid Workspace Policies"],
      status: "approved",
    },
    {
      id: "comp-3",
      name: "Cyberdyne Systems",
      website: "www.cyberdyne.co",
      industry: "Robotics & Artificial Intelligence",
      location: "Remote",
      claimedPerks: ["Paid Menstrual Leave Program", "Childcare Subsidy Assistance"],
      status: "pending",
    },
    {
      id: "comp-4",
      name: "Global Media Group",
      website: "www.globalmedia.org",
      industry: "Entertainment & Media",
      location: "Pune, Maharashtra",
      claimedPerks: ["Flexible Onboarding Returnship", "100% Work From Home Support"],
      status: "info_requested",
      feedback: "Please upload your paid leave HR policy document for verification.",
    },
    {
      id: "comp-5",
      name: "Omni Consumer Products",
      website: "www.ocp.org",
      industry: "Industrial Manufacturing",
      location: "Chennai, Tamil Nadu",
      claimedPerks: ["Childcare Subsidy Assistance"],
      status: "rejected",
      feedback: "Offered benefits do not meet the minimum inclusion guidelines for partner status.",
    },
  ]

  private static jobsList: AdminJob[] = mockJobs.map((j, idx) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    salary: j.salary,
    location: j.location,
    status: idx === 2 || idx === 7 ? "flagged" : "approved",
    reported: idx === 2 || idx === 7,
    visibility: "visible",
    applicantsCount: Math.floor(Math.random() * 20) + 2,
  }))

  private static auditLogsList: AdminAuditLog[] = [
    {
      id: "log-1",
      timestamp: "2026-07-04 14:24:12",
      operator: "SysAdmin Control",
      category: "Feature Flags",
      action: "Modified FEATURE_FLAGS.CHAT_SYSTEM status to Enabled",
      ipAddress: "192.168.1.104",
    },
    {
      id: "log-2",
      timestamp: "2026-07-04 12:10:05",
      operator: "Content Moderator",
      category: "Corporate Perks",
      action: "Approved company Creative Minds Agency credentials",
      ipAddress: "192.168.1.112",
    },
    {
      id: "log-3",
      timestamp: "2026-07-04 09:45:30",
      operator: "SysAdmin Control",
      category: "User Management",
      action: "Suspended recruiter Deepa Sen account",
      ipAddress: "192.168.1.104",
    },
  ]

  // Add audit log helper
  static addAuditLog(
    category: AdminAuditLog["category"],
    action: string
  ) {
    const newLog: AdminAuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      operator: "SysAdmin Control",
      category,
      action,
      ipAddress: "192.168.1.104",
    }
    this.auditLogsList = [newLog, ...this.auditLogsList]
  }

  static async getAuditLogs(): Promise<AdminAuditLog[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.auditLogsList), 50)
    })
  }

  static async getMetrics(): Promise<typeof initialAdminData.metrics> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.adminStats.metrics), 50)
    })
  }

  static async getCandidates(): Promise<CandidateUser[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.candidatesList), 50)
    })
  }

  static async getRecruiters(): Promise<RecruiterUser[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.recruitersList), 50)
    })
  }

  static async getAdmins(): Promise<AdminUser[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.adminsList), 50)
    })
  }

  static async toggleUserStatus(userId: string, role: "candidate" | "recruiter" | "admin"): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let name = ""
        let action = ""
        if (role === "candidate") {
          this.candidatesList = this.candidatesList.map((item) => {
            if (item.id === userId) {
              name = item.name
              action = item.status === "Active" ? "Suspended" : "Re-activated"
              return { ...item, status: item.status === "Active" ? "Blocked" : "Active" }
            }
            return item
          })
        } else if (role === "recruiter") {
          this.recruitersList = this.recruitersList.map((item) => {
            if (item.id === userId) {
              name = item.name
              action = item.status === "Active" ? "Suspended" : "Re-activated"
              return { ...item, status: item.status === "Active" ? "Blocked" : "Active" }
            }
            return item
          })
        } else {
          this.adminsList = this.adminsList.map((item) => {
            if (item.id === userId) {
              name = item.name
              action = item.status === "Active" ? "Suspended" : "Re-activated"
              return { ...item, status: item.status === "Active" ? "Blocked" : "Active" }
            }
            return item
          })
        }
        this.addAuditLog("User Management", `${action} ${role} account: ${name}`)
        resolve(true)
      }, 50)
    })
  }

  static async toggleUserVerification(userId: string, role: "candidate" | "recruiter"): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let name = ""
        let action = ""
        if (role === "candidate") {
          this.candidatesList = this.candidatesList.map((item) => {
            if (item.id === userId) {
              name = item.name
              action = item.verified ? "Revoked resume check verification for" : "Verified resume credentials for"
              return { ...item, verified: !item.verified }
            }
            return item
          })
        } else {
          this.recruitersList = this.recruitersList.map((item) => {
            if (item.id === userId) {
              name = item.name
              action = item.verified ? "Revoked corporate approval for" : "Approved corporate credentials for"
              return { ...item, verified: !item.verified }
            }
            return item
          })
        }
        this.addAuditLog("User Management", `${action} ${role}: ${name}`)
        resolve(true)
      }, 50)
    })
  }

  static async getJobs(): Promise<AdminJob[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.jobsList), 50)
    })
  }

  static async toggleJobVisibility(jobId: string): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let title = ""
        let company = ""
        let action = ""
        this.jobsList = this.jobsList.map((j) => {
          if (j.id === jobId) {
            title = j.title
            company = j.company
            action = j.visibility === "visible" ? "Hid" : "Restored visibility of"
            return { ...j, visibility: j.visibility === "visible" ? "hidden" : "visible" }
          }
          return j
        })
        this.addAuditLog("Job Moderation", `${action} job posting: "${title}" at ${company}`)
        resolve(true)
      }, 50)
    })
  }

  static async approveJob(jobId: string): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let title = ""
        let company = ""
        this.jobsList = this.jobsList.map((j) => {
          if (j.id === jobId) {
            title = j.title
            company = j.company
            return { ...j, status: "approved", reported: false }
          }
          return j
        })
        this.addAuditLog("Job Moderation", `Approved job posting & dismissed report tickets: "${title}" at ${company}`)
        resolve(true)
      }, 50)
    })
  }

  static async deleteJob(jobId: string): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const match = this.jobsList.find((j) => j.id === jobId)
        if (match) {
          this.jobsList = this.jobsList.filter((j) => j.id !== jobId)
          this.addAuditLog("Job Moderation", `Purged job posting: "${match.title}" at ${match.company}`)
        }
        resolve(true)
      }, 50)
    })
  }

  static async getCompanies(): Promise<AdminCompany[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.companiesList), 50)
    })
  }

  static async updateCompanyStatus(
    companyId: string,
    status: "pending" | "approved" | "rejected" | "info_requested",
    feedback?: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let name = ""
        let action = ""
        this.companiesList = this.companiesList.map((c) => {
          if (c.id === companyId) {
            name = c.name
            if (status === "approved") action = "Approved corporate perks champion credentials for"
            else if (status === "rejected") action = "Rejected partnership perks checklist for"
            else if (status === "info_requested") action = "Requested additional leave policy documentation for"
            else action = "Reset verification queue status to pending for"
            return { ...c, status, feedback }
          }
          return c
        })
        this.addAuditLog("Corporate Perks", `${action} ${name}${feedback ? ` (Note: "${feedback}")` : ""}`)
        resolve(true)
      }, 50)
    })
  }

  static async performUserAudit(_userId: string): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 50)
    })
  }

  static async updateSettings(values: any): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.addAuditLog(
          "Security Settings",
          `Updated administrator security configurations and timeout threshold to ${values.sessionTimeout}`
        )
        resolve(true)
      }, 50)
    })
  }
}
export default AdminService
