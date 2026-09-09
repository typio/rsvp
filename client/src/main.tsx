import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'

import '@fontsource-variable/lexend'
import '@fontsource-variable/gabarito'
import '@fontsource-variable/caveat'

import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen flex justify-center focus:outline-hidden focus:ring-3 focus:ring-primary">
      <App />
    </div>
    <Toaster />
  </React.StrictMode>
)
