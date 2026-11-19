import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  onReset?: () => void;
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SafeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[SafeErrorBoundary] Handled runtime error gracefully:', error?.message || error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.inline) {
        return (
          <div className="p-3 my-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3">
            <span className="truncate">{this.state.error?.message || "Render error safely prevented."}</span>
            <button
              onClick={this.handleReset}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] transition-all cursor-pointer flex-shrink-0"
            >
              Retry
            </button>
          </div>
        );
      }

      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#09090b] text-white select-none">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400 shadow-inner">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h2 className="text-base font-semibold mb-1 text-white tracking-wide">
            {this.props.fallbackTitle || "Chat Screen Recovered"}
          </h2>
          <p className="text-xs text-white/50 max-w-sm mb-5 leading-relaxed">
            {this.props.fallbackSubtitle || "A temporary issue in the world scene was safely contained. You can continue chatting seamlessly."}
          </p>
          <button
            onClick={this.handleReset}
            className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs shadow-lg hover:bg-white/90 active:scale-95 transition-all cursor-pointer"
          >
            Continue Chat
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
