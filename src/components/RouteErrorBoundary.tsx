import React from "react";

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  routeName?: string;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  message?: string;
  stack?: string;
}

class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || "Unknown runtime error",
      stack: error?.stack,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[RouteErrorBoundary] Route crashed", {
      routeName: this.props.routeName,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-3xl rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive space-y-2">
          <h2 className="text-base font-semibold">This page hit a runtime error</h2>
          <p className="text-sm">Route: {this.props.routeName || "Unknown"}</p>
          <p className="text-sm break-words">{this.state.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
