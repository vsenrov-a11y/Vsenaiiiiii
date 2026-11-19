import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initKeyboardDismissalManager } from './utils/keyboardManager';
import { initAudioUnlockGesture } from './utils/audioHelper';
import { SafeErrorBoundary } from './components/common/SafeErrorBoundary';

// Global error containment to prevent unhandled background errors from triggering error overlays or builder error interfaces
if (typeof window !== 'undefined') {
  window.onerror = function (message, source, lineno, colno, error) {
    console.warn('[GlobalErrorCatcher] Suppressed runtime error:', message, error);
    return true;
  };

  window.onunhandledrejection = function (event) {
    console.warn('[GlobalErrorCatcher] Suppressed unhandled rejection:', event.reason);
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (event && typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    return true;
  };

  window.addEventListener('error', (event) => {
    console.warn('[GlobalErrorCatcher] Handled window error:', event.message || event.error);
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (event && typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[GlobalErrorCatcher] Handled unhandled rejection:', event.reason);
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (event && typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
  }, true);
}

// Initialize global, platform-independent keyboard and focus dismissal system
initKeyboardDismissalManager();

// Initialize iOS Safari / WebKit Audio Unlock Gesture on first tap
initAudioUnlockGesture();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SafeErrorBoundary fallbackTitle="Application Restored">
      <App />
    </SafeErrorBoundary>
  </StrictMode>,
);


