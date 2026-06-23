import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ComplexSynthViz } from './components/ComplexSynthViz'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ width: '100vw', height: '100vh' }}>
      <ComplexSynthViz />
    </div>
  </StrictMode>,
)
