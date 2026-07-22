import { Toaster } from "sonner"
import { AppRouter } from "@/routes/AppRouter"
import { ErrorBoundary } from "@/components/shared/errors/ErrorBoundary"

function App() {
  return (
    <ErrorBoundary>
      <AppRouter />
      {/* Every toast.success()/toast.error() call in the app (45+ call
          sites, including login/auth failure messages) renders into this --
          without it mounted somewhere in the tree, those calls are silent
          no-ops: sonner queues the toast but there's no <Toaster/> to
          actually paint it on screen. */}
      <Toaster richColors position="top-right" closeButton />
    </ErrorBoundary>
  )
}

export default App

