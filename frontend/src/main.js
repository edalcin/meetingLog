import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
const app = mount(App, { target: document.getElementById('app') })
export default app

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
