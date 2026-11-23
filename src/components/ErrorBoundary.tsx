import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorText: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorText: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        readable = `خطأ في صلاحيات أو اتصال Firestore (${parsed.operationType} على ${parsed.path}): ${parsed.error}`;
      }
    } catch {
      // Keep original message
    }
    return { hasError: true, errorText: readable };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Edkawi ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#10192D] flex items-center justify-center p-6">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl max-w-lg w-full p-6 text-center space-y-4">
            <AlertTriangle
              className="w-10 h-10 text-[#FF7100] mx-auto"
              aria-hidden="true"
            />
            <h1 className="text-xl font-bold text-[#F8FAFC]">
              حدث خطأ أثناء معالجة العملية
            </h1>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              {this.state.errorText}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="py-2.5 px-5 rounded-2xl bg-[#FF7100] hover:bg-[#E66600] text-[#F8FAFC] text-sm font-bold cursor-pointer"
            >
              إعادة تحميل التطبيق
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
