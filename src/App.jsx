import { Route, Routes } from 'react-router-dom'

import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route element={<Home />} index />
      </Route>
    </Routes>
  )
}

export default App
