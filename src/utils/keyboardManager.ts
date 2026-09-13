/**
 * Platform-independent global input dismissal and keyboard management engine.
 * 
 * Features:
 * - Outside tap/click detection that dismisses active inputs and virtual keyboards.
 * - Desktop Escape key handler to blur active inputs/textareas.
 * - Scroll and viewport height restoration when the keyboard closes on iOS/Android.
 * - Distinguishes between intentional taps and scroll/drag gestures so scrolling is never interrupted.
 * - Preserves button clicks, submit actions, copy/paste, text selection, and form interactions.
 * - Works universally across iOS, Android, Windows, macOS, and modern browsers.
 */

let isInitialized = false;

// Track touch start coordinates to differentiate taps from scroll/swipe gestures
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isScrollingGesture = false;

/**
 * Checks whether an element is an active text input, textarea, or editable element
 */
export function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'input') {
    const type = (element as HTMLInputElement).type?.toLowerCase();
    // Exclude non-textual input controls
    const nonTextTypes = ['checkbox', 'radio', 'range', 'file', 'color', 'button', 'submit', 'reset', 'image', 'hidden'];
    return !nonTextTypes.includes(type);
  }
  if (tagName === 'textarea') return true;
  if (element.getAttribute('contenteditable') === 'true') return true;
  if ((element as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Checks whether a target element is considered a control that belongs to or interacts with the input
 * (e.g. submit button, clear button, eye password toggle, attachment button, picker)
 */
function isInputInteractiveControl(target: Element, activeEl: Element): boolean {
  // If target is inside the active element itself
  if (activeEl === target || activeEl.contains(target)) {
    return true;
  }

  // Explicit bypass flag via data-attribute
  if (target.closest('[data-keep-focus="true"]') || target.closest('[data-input-control="true"]')) {
    return true;
  }

  // If the target is another input/textarea, let the browser naturally switch focus
  if (isEditableElement(target) || isEditableElement(target.closest('input, textarea, [contenteditable="true"]'))) {
    return true;
  }

  // If target is a button inside the exact same form/input-wrapper
  const form = activeEl.closest('form');
  if (form && form.contains(target)) {
    const button = target.closest('button, [role="button"], input[type="submit"], label');
    if (button) return true;
  }

  // If target is inside the immediate parent container of the active input (e.g. pill wrapper with clear/send buttons)
  const inputContainer = activeEl.parentElement;
  if (inputContainer && inputContainer.contains(target)) {
    const button = target.closest('button, [role="button"], label, svg');
    if (button) return true;
  }

  return false;
}

/**
 * Global manual dismissal helper
 */
export function dismissKeyboard(): void {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (isEditableElement(active) && active instanceof HTMLElement) {
    active.blur();
  }
  restoreViewport();
}

/**
 * Restores the document scroll position and viewport state when keyboard is closed
 */
export function restoreViewport(): void {
  if (typeof window === 'undefined') return;

  // Small timeout to allow the virtual keyboard to begin retracting
  setTimeout(() => {
    // If no editable element is currently focused, reset any scroll displacement
    if (!isEditableElement(document.activeElement)) {
      if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0 || document.body.scrollTop !== 0) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }
    }
  }, 60);
}

/**
 * Initializes global event listeners for keyboard dismissal and viewport stabilization
 */
export function initKeyboardDismissalManager(): () => void {
  if (isInitialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  isInitialized = true;

  // 1. Touch start tracking
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      isScrollingGesture = false;
    }
  };

  // 2. Touch move tracking (if finger moved > 10px, mark as scroll gesture)
  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
      if (deltaX > 10 || deltaY > 10) {
        isScrollingGesture = true;
      }
    }
  };

  // 3. Touch end handler for mobile outside-tap dismissal
  const handleTouchEnd = (e: TouchEvent) => {
    // If the gesture was a scroll/swipe or multi-touch, do not dismiss
    if (isScrollingGesture || (e.changedTouches && e.changedTouches.length > 1)) {
      return;
    }

    const activeEl = document.activeElement;
    if (!isEditableElement(activeEl)) {
      return;
    }

    const target = (e.target as Element) || null;
    if (!target) return;

    // Check if the tap is inside the active element or its interactive controls
    if (isInputInteractiveControl(target, activeEl!)) {
      return;
    }

    // Check if user is currently selecting text
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().length > 0) {
      return;
    }

    // Intentional tap outside: blur the active input to dismiss the keyboard
    if (activeEl instanceof HTMLElement) {
      activeEl.blur();
      restoreViewport();
    }
  };

  // 4. Mouse click handler for desktop outside-click dismissal
  const handleClick = (e: MouseEvent) => {
    // Ignore synthetic touch clicks (already handled by touchend)
    if (Date.now() - touchStartTime < 350) {
      return;
    }

    const activeEl = document.activeElement;
    if (!isEditableElement(activeEl)) {
      return;
    }

    const target = (e.target as Element) || null;
    if (!target) return;

    if (isInputInteractiveControl(target, activeEl!)) {
      return;
    }

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().length > 0) {
      return;
    }

    if (activeEl instanceof HTMLElement) {
      activeEl.blur();
      restoreViewport();
    }
  };

  // 5. Desktop Escape key handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      const activeEl = document.activeElement;
      if (isEditableElement(activeEl) && activeEl instanceof HTMLElement) {
        e.preventDefault();
        activeEl.blur();
        restoreViewport();
      }
    }
  };

  // 6. Focusout / blur viewport cleanup
  const handleFocusOut = (e: FocusEvent) => {
    const target = e.target as Element;
    if (isEditableElement(target)) {
      // Delay check so if focus moved to another input, we don't trigger unnecessary scroll reset
      setTimeout(() => {
        if (!isEditableElement(document.activeElement)) {
          restoreViewport();
        }
      }, 80);
    }
  };

  // 7. Visual Viewport resize handler (detects mobile virtual keyboard collapse)
  const handleVisualViewportResize = () => {
    if (!isEditableElement(document.activeElement)) {
      restoreViewport();
    }
  };

  // Register all listeners with passive / capture where appropriate
  window.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: true, capture: true });
  window.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
  window.addEventListener('click', handleClick, { capture: true });
  window.addEventListener('keydown', handleKeyDown, { capture: true });
  window.addEventListener('focusout', handleFocusOut, { passive: true, capture: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleVisualViewportResize);
    window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
  }

  return () => {
    window.removeEventListener('touchstart', handleTouchStart, { capture: true });
    window.removeEventListener('touchmove', handleTouchMove, { capture: true });
    window.removeEventListener('touchend', handleTouchEnd, { capture: true });
    window.removeEventListener('click', handleClick, { capture: true });
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
    window.removeEventListener('focusout', handleFocusOut, { capture: true });

    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
      window.visualViewport.removeEventListener('scroll', handleVisualViewportResize);
    }
    isInitialized = false;
  };
}
