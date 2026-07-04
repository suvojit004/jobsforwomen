import { initialCandidateData as centralData } from "@/mock/candidate/candidateMock"
import type { ExtendedCandidate } from "../types/candidate"

export const initialCandidateData: ExtendedCandidate = {
  ...centralData,
  languages: ["English", "Hindi", "Kannada"],
  socialLinks: [
    { id: "s-1", platform: "LinkedIn", url: "https://linkedin.com/in/priyasharma" },
    { id: "s-2", platform: "GitHub", url: "https://github.com/priyasharma" },
    { id: "s-3", platform: "Portfolio", url: "https://priyasharma.dev" },
  ],
  careerBreak: {
    ...centralData.careerBreak,
  },
} as any
export default initialCandidateData
