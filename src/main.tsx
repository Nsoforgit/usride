import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Note: StrictMode is intentionally removed in this production build.
// It causes every component to render TWICE in development (to surface side effects),
// which on iOS with a large React tree causes 2× the JS parsing work — unacceptable on mobile.
// Run with `vite --mode development` and add it back only when debugging React behaviour.
createRoot(document.getElementById('root')!).render(<App />)
