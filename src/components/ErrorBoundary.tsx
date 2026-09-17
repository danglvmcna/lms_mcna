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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-2xl p-6 shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">
                {props.fallbackTitle || "Đã xảy ra lỗi hiển thị"}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hệ thống gặp sự cố khi hiển thị nội dung này. Vui lòng thử tải lại trang hoặc quay lại danh sách.
              </p>
            </div>
            {state.error?.message && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 text-left overflow-x-auto max-h-24">
                {state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return props.children;
  }
}

const ErrorBoundary = ErrorBoundaryInternal as unknown as React.ComponentType<Props>;
export default ErrorBoundary;
