import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './lib/auth'
import { WorkerPortal } from './routes/WorkerPortal'
import { OwnerPortal } from './routes/OwnerPortal'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<WorkerPortal />} />
          <Route path="/owner" element={<OwnerPortal />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
