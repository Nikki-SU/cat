import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Tracking from './pages/Tracking'
import Browse from './pages/Browse'
import DeepRead from './pages/DeepRead'
import Manage from './pages/Manage'
import Learn from './pages/Learn'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Tracking />} />
          <Route path="browse" element={<Browse />} />
          <Route path="deep-read" element={<DeepRead />} />
          <Route path="manage" element={<Manage />} />
          <Route path="learn" element={<Learn />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
