import { Route, Routes, Navigate } from "react-router-dom"
import { Login } from "@/features/auth/pages/Login"
import { CandidateRegister } from "@/features/auth/pages/CandidateRegister"
import { RecruiterRegister } from "@/features/auth/pages/RecruiterRegister"
import { VerifyEmail } from "@/features/auth/pages/VerifyEmail"
import { ForgotPassword } from "@/features/auth/pages/ForgotPassword"
import { ResetPassword } from "@/features/auth/pages/ResetPassword"
import { AcceptInvitation } from "@/features/auth/pages/AcceptInvitation"

export function AuthRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="register/candidate" element={<CandidateRegister />} />
      <Route path="register/recruiter" element={<RecruiterRegister />} />
      <Route path="verify-email" element={<VerifyEmail />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route path="accept-invitation" element={<AcceptInvitation />} />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  )
}

export default AuthRoutes
