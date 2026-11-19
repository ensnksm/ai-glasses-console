import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Workspace from './components/workspace/Workspace'
import { LoginPage, RegisterPage } from './pages/Auth'
import { AuthProvider, useAuth } from './services/auth'
import { DemoProvider } from './services/demo'

function RequireSession() {
  const { currentUser } = useAuth()
  const { pathname, search, hash } = useLocation()
  return currentUser ? <Outlet /> : <Navigate replace to="/login" state={{ from: pathname + search + hash }} />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DemoProvider>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route element={<RequireSession />}>
              <Route path="*" element={<Workspace />} />
            </Route>
          </Routes>
        </DemoProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
