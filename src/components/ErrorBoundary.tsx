import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInternal extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught render error in ErrorBoundary:", error, errorInfo);
  }

  handleReset = (): void => {
    (this as any).setState({ hasError: false, error: null });
    window.location.href = window.location.pathname;
  };

  render(): ReactNode {
    const state = (this as any).state as State;
    const props = (this as any).props as Props;

    if (state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-canvas p-5">
          <div className="w-full max-w-md space-y-5 rounded-[1.75rem] bg-white p-7 text-center shadow-raised ring-1 ring-slate-200/70">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="h-7 w-7" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-slate-900">{props.fallbackTitle || "Đã có lỗi xảy ra"}</h2>
              <p className="text-[15px] leading-relaxed text-slate-500">Trang này gặp sự cố khi hiển thị. Tải lại trang thường sẽ giải quyết được.</p>
            </div>
            {state.error?.message && (
              <p className="max-h-24 overflow-auto rounded-2xl bg-canvas p-3 text-left font-mono text-xs text-slate-500">{state.error.message}</p>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-indigo-600 px-5 text-[15px] font-semibold text-white shadow-primary hover:bg-indigo-700"
            >
              <RefreshCw className="h-4 w-4" /> Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return props.children;
  }
}

const ErrorBoundary = ErrorBoundaryInternal as unknown as React.ComponentType<Props>;
export default ErrorBoundary;
