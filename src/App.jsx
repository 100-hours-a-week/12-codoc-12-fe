import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import AuthGate from '@/components/AuthGate'
import RateLimitGate from '@/components/RateLimitGate'
import MainLayout from '@/layouts/MainLayout'
import { initGa4, trackPageView } from '@/lib/ga4'
import Chatbot from '@/pages/Chatbot'
import ChatRooms from '@/pages/ChatRooms'
import ChatRoomDetail from '@/pages/ChatRoomDetail'
import Home from '@/pages/Home'
import Leaderboards from '@/pages/Leaderboards'
import Login from '@/pages/Login'
import MyPage from '@/pages/MyPage'
import Notifications from '@/pages/Notifications'
import NotificationSettings from '@/pages/NotificationSettings'
import Onboarding from '@/pages/Onboarding'
import ProblemDetail from '@/pages/ProblemDetail'
import Problems from '@/pages/Problems'
import Quiz from '@/pages/Quiz'
import SummaryCards from '@/pages/SummaryCards'

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
          <Route element={<Notifications />} path="notifications" />
          <Route element={<ChatRooms />} path="chat" />
          <Route element={<ChatRoomDetail />} path="chat/:roomId" />
          <Route element={<NotificationSettings />} path="notifications/settings" />
          <Route element={<Leaderboards />} path="leaderboard" />
          <Route element={<MyPage />} path="my" />
        </Route>
      </Routes>
    </RateLimitGate>
  )
}

export default App
