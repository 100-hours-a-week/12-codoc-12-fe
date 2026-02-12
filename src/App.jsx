import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import AuthGate from '@/components/AuthGate'
import RateLimitGate from '@/components/RateLimitGate'
import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import MyPage from '@/pages/MyPage'
import Onboarding from '@/pages/Onboarding'
import Chatbot from '@/pages/Chatbot'
import Quiz from '@/pages/Quiz'
import ProblemDetail from '@/pages/ProblemDetail'
import Problems from '@/pages/Problems'
import SummaryCards from '@/pages/SummaryCards'
import { initGa4, trackPageView } from '@/lib/ga4'

function App() {
  const location = useLocation()

  useEffect(() => {
    initGa4()
  }, [])

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`
    trackPageView(path)
  }, [location])

  return (
    <RateLimitGate>
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
          <Route element={<ProblemDetail />} path="problems/:problemId" />
          <Route element={<SummaryCards />} path="problems/:problemId/summary" />
          <Route element={<Chatbot />} path="problems/:problemId/chatbot" />
          <Route element={<Quiz />} path="problems/:problemId/quiz" />
          <Route element={<MyPage />} path="my" />
        </Route>
      </Routes>
    </RateLimitGate>
  )
}

export default App
