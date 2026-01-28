import { Route, Routes } from 'react-router-dom'

import AuthGate from '@/components/AuthGate'
import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import MyPage from '@/pages/MyPage'
import Onboarding from '@/pages/Onboarding'
import Chatbot from '@/pages/Chatbot'
import Quiz from '@/pages/Quiz'
import ProblemDetail from '@/pages/ProblemDetail'
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
        <Route element={<ProblemDetail />} path="problems/:problemId" />
        <Route element={<Chatbot />} path="problems/:problemId/chatbot" />
        <Route element={<Quiz />} path="problems/:problemId/quiz" />
        <Route element={<MyPage />} path="my" />
      </Route>
    </Routes>
  )
}

export default App
