import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register PWA Service Worker for mobile & browser installability
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Registration successful
        console.log('Shagufta POS Service Worker registered, scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('Shagufta POS Service Worker registration failed:', err);
      });
  });
}

