import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initKeyboardDismissalManager } from './utils/keyboardManager';

// Initialize global, platform-independent keyboard and focus dismissal system
initKeyboardDismissalManager();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

