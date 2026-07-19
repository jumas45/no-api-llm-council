import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initialTheme, applyTheme } from './ui/theme.js'
import './index.css'

// Apply the saved theme before first paint to avoid a flash.
applyTheme(initialTheme())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
