import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/authContext'
import { WorkerPortal } from './routes/WorkerPortal'
import { OwnerPortal } from './routes/OwnerPortal'
import { LearnerPortal } from './routes/LearnerPortal'
import { DeveloperPortal } from './routes/DeveloperPortal'
import { ResetPasswordScreen } from './components/ResetPasswordScreen'

function AppRoutes() {
  const { recoveryMode } = useAuth()

  if (recoveryMode) {
    return <ResetPasswordScreen />
  }

  return (
    <Routes>
      <Route path="/" element={<WorkerPortal />} />
      <Route path="/owner" element={<OwnerPortal />} />
      <Route path="/learn" element={<LearnerPortal />} />
      <Route path="/dev" element={<DeveloperPortal />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
