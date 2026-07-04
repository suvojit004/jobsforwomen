import { Route, Routes, Navigate } from "react-router-dom"

export function AuthRoutes() {
  return (
    <Routes>
      <Route index element={<div className="p-6 text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Authentication Portal - Placeholder</div>} />
      <Route path="login" element={<div className="p-6 text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Login Screen - Placeholder</div>} />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  )
}
export default AuthRoutes
