import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './services/theme'
import './styles/theme.css'
import './styles/app.css'
import './styles/motion.css'
import './styles/ambient-controls.css'
import './styles/glass-theme.css'

createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider><App /></ThemeProvider></StrictMode>)
