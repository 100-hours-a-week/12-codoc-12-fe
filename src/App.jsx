import { Route, Routes } from 'react-router-dom'

import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'
import MyPage from '@/pages/MyPage'
import Problems from '@/pages/Problems'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route element={<Home />} index />
        <Route element={<Problems />} path="problems" />
        <Route element={<MyPage />} path="my" />
      </Route>
    </Routes>
  )
}

export default App
