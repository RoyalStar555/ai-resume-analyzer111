import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SectionErrorBoundary${this.props.label ? ` · ${this.props.label}` : ""}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <h4 className="font-display text-sm font-semibold text-destructive">
              Data unavailable for this section
            </h4>
            <p className="mt-1 text-xs text-foreground/80 break-words">
              {this.props.label
                ? `We couldn't render "${this.props.label}".`
                : "Something went wrong rendering this section."}{" "}
              The rest of your analysis is still available.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
