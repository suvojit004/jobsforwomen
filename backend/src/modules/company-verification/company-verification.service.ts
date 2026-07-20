import prisma from "../../shared/database/db"
import EventBus from "../../shared/eventBus/eventBus"
import { uploadToCloudinary } from "../../shared/utils/cloudinary"
import { AllowedDocumentCategories } from "../recruiter/recruiter.validator"

// Public, unauthenticated resubmission flow (Part 3 of the recruiter
// onboarding/approval spec). A recruiter reaches this via the secure,
// single-use, expiring link mailed by email.listener.ts's
// CompanyInfoRequested handler -- there is no login involved, so every
// method here re-validates the token itself rather than relying on any
// auth middleware.
export class CompanyVerificationService {
  private async findValidByToken(token: string) {
    const company = await prisma.company.findUnique({
      where: { verificationToken: token },
      include: { industry: true },
    })

    // Deliberately generic: whether the token never existed, was already
    // consumed by a prior resubmission, or simply expired all look
    // identical to the caller. Leaking which one it was would let someone
    // fish for valid-but-expired tokens.
    if (!company || !company.verificationTokenExpiresAt || company.verificationTokenExpiresAt < new Date()) {
      throw new Error("This verification link is invalid or has expired.")
    }

    return company
  }

  async getByToken(token: string) {
    const company = await this.findValidByToken(token)
    return {
      companyName: company.name,
      website: company.website,
      location: company.location,
      industryName: company.industry.name,
      status: company.status,
      feedback: company.feedback,
      verificationDocuments: Array.isArray(company.verificationDocuments) ? company.verificationDocuments : [],
      recruiterResubmissionComment: company.recruiterResubmissionComment,
      resubmittedAt: company.resubmittedAt,
    }
  }

  async resubmit(
    token: string,
    data: { companyName?: string; website?: string; industryName?: string; location?: string; comment: string }
  ) {
    const company = await this.findValidByToken(token)

    const updateData: any = {
      recruiterResubmissionComment: data.comment,
      resubmittedAt: new Date(),
      status: "under_review",
      // Single-use: the token is consumed the instant resubmission succeeds.
      // If the admin needs another round of changes, verifyCompany() mints a
      // brand new token on the next info-request.
      verificationToken: null,
      verificationTokenExpiresAt: null,
    }

    if (data.website) updateData.website = data.website
    if (data.location) updateData.location = data.location

    if (data.companyName && data.companyName !== company.name) {
      const existing = await prisma.company.findUnique({ where: { name: data.companyName } })
      if (existing && existing.id !== company.id) {
        throw new Error("A company with this name already exists")
      }
      updateData.name = data.companyName
    }

    if (data.industryName) {
      const industry = await prisma.industry.upsert({
        where: { name: data.industryName },
        update: {},
        create: { name: data.industryName },
      })
      updateData.industryId = industry.id
    }

    const updated = await prisma.company.update({
      where: { id: company.id },
      data: updateData,
    })

    // Part 11 requires admins get a realtime notification for "Company
    // Resubmission" -- notification.listener.ts subscribes to this and
    // fans out to notifyActiveAdmins + an audit log entry.
    EventBus.publish("CompanyVerificationResubmitted", {
      companyId: company.id,
      companyName: updated.name,
      comment: data.comment,
      resubmittedAt: updated.resubmittedAt?.toISOString(),
    })

    return { companyName: updated.name, status: updated.status }
  }

  async addDocument(
    token: string,
    category: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string }
  ) {
    if (!AllowedDocumentCategories.includes(category)) {
      throw new Error(`Invalid document category. Allowed categories: ${AllowedDocumentCategories.join(", ")}`)
    }

    const company = await this.findValidByToken(token)

    const result = await uploadToCloudinary(
      file.buffer,
      "jfw/company-verification",
      `${company.id}_${category}_${Date.now()}`,
      true,
      file.originalname
    )

    const existingDocs: any[] = Array.isArray(company.verificationDocuments) ? (company.verificationDocuments as any[]) : []
    const version = existingDocs.filter((d) => d.category === category).length + 1

    const newDoc = {
      url: result.secureUrl,
      publicId: result.publicId,
      size: result.size,
      mimetype: file.mimetype,
      category,
      originalFilename: file.originalname,
      format: result.format,
      uploadedAt: new Date().toISOString(),
      version,
    }

    // Append, never replace -- Part 13 requires upload history to be
    // maintained, so every prior version of a re-uploaded document category
    // stays visible to both the recruiter and admin, not just the latest one.
    const updatedDocs = [...existingDocs, newDoc]

    await prisma.company.update({
      where: { id: company.id },
      data: { verificationDocuments: updatedDocs },
    })

    // this previously fired no event at all, so a recruiter
    // uploading a requested document (without also clicking "Resubmit
    // Verification" in the same visit) gave admins zero signal -- Part 11
    // explicitly lists "Recruiter Uploaded Additional Documents" as its own
    // realtime admin-notification trigger, distinct from the full
    // resubmission (CompanyVerificationResubmitted).
    EventBus.publish("CompanyDocumentUploaded", {
      companyId: company.id,
      companyName: company.name,
      category,
      uploadedAt: newDoc.uploadedAt,
    })

    return newDoc
  }
}

export default CompanyVerificationService
