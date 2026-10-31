import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught an unhandled rendering error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.state = { hasError: false, error: null };
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReturnToLibrary = () => {
    this.setState({ hasError: false, error: null });
    this.state = { hasError: false, error: null };
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.hash = '#/';
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          data-testid="error-boundary-fallback"
          className="p-8 max-w-lg mx-auto my-12 bg-surface border border-rose-500/30 rounded-3xl text-center shadow-2xl animate-in fade-in duration-200"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500 mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2
            data-testid="error-boundary-title"
            className="text-lg font-bold text-text-primary tracking-tight"
          >
            {this.props.fallbackTitle || 'Error loading title data'}
          </h2>
          <p
            data-testid="error-boundary-message"
            className="text-xs text-text-secondary mt-2 leading-relaxed"
          >
            {this.props.fallbackMessage ||
              this.state.error?.message ||
              'A rendering issue occurred while displaying this content. You can try refreshing or return to your library.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              data-testid="error-boundary-retry-button"
              className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-xs font-semibold text-text-primary transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-accent" />
              <span>Try Again</span>
            </button>
            <button
              onClick={this.handleReturnToLibrary}
              data-testid="error-boundary-return-button"
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background text-xs font-bold transition-all shadow flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Library</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
