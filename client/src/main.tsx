import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'

import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-[100vh] flex justify-center py-4 sm:py-8 px-2 sm:px-8 focus:outline-none focus:ring focus:ring-primary">
      <App />
    </div>
    <Toaster />
  </React.StrictMode>
)
