import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'

import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-[100vh] flex justify-center p-8 focus:outline-none focus:ring focus:ring-primary">
      <App />
    </div>
    <Toaster richColors />
  </React.StrictMode>
)
