import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com',
  timeout: 15000,
})
