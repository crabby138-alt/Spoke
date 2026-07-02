import React from 'react'
import ReactDOM from 'react-dom/client'
import Spoke from './Spoke.jsx' // Gọi file code của bạn

// Mock up window.storage nếu bạn chưa định nghĩa nó ở nơi khác để tránh lỗi crash
if (!window.storage) {
  window.storage = {
    get: async (key) => ({ value: localStorage.getItem(key) }),
    set: async (key, value) => { localStorage.setItem(key, value) }
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Spoke />
  </React.StrictMode>,
)
