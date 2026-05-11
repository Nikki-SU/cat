/**
 * 路由配置
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Tracking from './pages/Tracking'
import Browse from './pages/Browse'
import DeepRead from './pages/DeepRead'
import Learn from './pages/Learn'
import Settings from './pages/Settings'

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Tracking />} />
          <Route path="browse" element={<Browse />} />
          <Route path="deep-read" element={<DeepRead />} />
          <Route path="learn" element={<Learn />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
