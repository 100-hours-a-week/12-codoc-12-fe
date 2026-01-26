import { Route, Routes } from 'react-router-dom'

import AuthGate from '@/components/AuthGate'
import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import MyPage from '@/pages/MyPage'
import Onboarding from '@/pages/Onboarding'
import Problems from '@/pages/Problems'

function App() {
  return (
    <Routes>
      <Route element={<Login />} path="/login" />
      <Route
        element={
          <AuthGate>
            <Onboarding />
          </AuthGate>
        }
        path="/onboarding"
      />
      <Route
        element={
          <AuthGate>
            <MainLayout />
          </AuthGate>
        }
      >
        <Route element={<Home />} index />
        <Route element={<Problems />} path="problems" />
        <Route element={<MyPage />} path="my" />
      </Route>
    </Routes>
  )
}

export default App
