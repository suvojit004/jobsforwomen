import { Component, type ErrorInfo, type ReactNode } from "react"
import { ShieldAlert, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children?: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 select-none">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center shadow-xl space-y-5 animate-fadeIn">
            <div className="size-12 rounded-full bg-red-100 dark:bg-red-950/20 text-red-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Something went wrong</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                An unexpected error occurred in the application rendering view. We have logged this diagnostic incident.
              </p>
              {this.state.error && (
                <div className="mt-2 text-[10px] font-mono text-red-600 bg-red-50 dark:bg-red-950/10 p-2.5 rounded-lg border border-red-100 dark:border-red-950/20 overflow-x-auto text-left max-h-24">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="pt-2 flex justify-center">
              <Button
                onClick={this.handleReset}
                className="bg-[#6B2C91] hover:bg-[#5a237b] text-white font-extrabold text-xs h-9 px-4 gap-1.5 cursor-pointer dark:bg-pink-600 dark:hover:bg-pink-700"
              >
                <RefreshCw className="size-3.5" />
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
export default ErrorBoundary
