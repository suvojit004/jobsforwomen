import type { Request, Response } from "express"
import { CompanyVerificationService } from "./company-verification.service"
import { sendSuccess, sendError } from "../../shared/utils/response"
import { resubmitCompanySchema } from "./company-verification.validator"

export class CompanyVerificationController {
  private service = new CompanyVerificationService()

  getByToken = async (req: Request, res: Response) => {
    const token = req.params.token as string
    const result = await this.service.getByToken(token)
    return sendSuccess(res, result, "Verification details fetched successfully.")
  }

  resubmit = async (req: Request, res: Response) => {
    const token = req.params.token as string
    const validated = resubmitCompanySchema.parse(req.body)
    const result = await this.service.resubmit(token, validated)
    return sendSuccess(res, result, "Verification resubmitted successfully.")
  }

  addDocument = async (req: Request, res: Response) => {
    const token = req.params.token as string
    const file = (req as any).file
    if (!file) {
      return sendError(res, "No file uploaded. Please attach a document.", null, 400)
    }
    const category = req.body?.category
    if (!category) {
      return sendError(res, "Document category is required.", null, 400)
    }

    const result = await this.service.addDocument(token, category, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    })
    return sendSuccess(res, result, "Document uploaded successfully.", 201)
  }
}

export default CompanyVerificationController
