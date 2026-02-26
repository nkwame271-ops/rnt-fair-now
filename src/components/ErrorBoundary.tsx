import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Human-readable name for the section (shown in fallback + console) */
  section?: string;
  /** Optional custom fallback — receives error + reset callback */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** If true the fallback is rendered inline at reduced opacity (default: true) */
  inline?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable React Error Boundary.
 *
 * Catches render-time errors inside its children, logs them, and shows a
 * graceful fallback UI with an optional "Retry" button that resets state so
 * the children re-mount.
 *
 * Usage:
 *   <ErrorBoundary section="Map">
 *     <PropertyLocationPicker … />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary] "${this.props.section || "Unknown"}" crashed`,
      {
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
      }
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback takes priority
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      const inline = this.props.inline !== false; // default true

      return (
        <div
          className={`rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3 ${
            inline ? "opacity-80" : ""
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-semibold text-destructive">
                {this.props.section
                  ? `"${this.props.section}" failed to load`
                  : "Something went wrong"}
              </h3>
              <p className="text-xs text-muted-foreground break-words">
                {this.state.error.message}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
