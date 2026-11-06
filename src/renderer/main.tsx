import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { PrintView } from './print/PrintView'
import 'katex/dist/katex.min.css'
// IBM Plex Sans (OFL): varsayılan not yazı tipi, uygulamayla gelir (ağ gerekmez)
import '@fontsource-variable/ibm-plex-sans/wght.css'
import '@fontsource-variable/ibm-plex-sans/wght-italic.css'
import './styles/tokens.css'
import './styles/glass.css'
import './styles/app.css'
import './styles/editor.css'
import './styles/blocks.css'
import './styles/home.css'
import './styles/print.css'

// platforma özgü stiller için (Windows'ta opak zemin, trafik ışığı boşluğu yok)
document.documentElement.dataset['platform'] = window.kernel?.app.platform ?? 'darwin'

// #/print: PDF için baskı görünümü; aksi halde uygulama
const isPrint = location.hash.startsWith('#/print')

createRoot(document.getElementById('root')!).render(<StrictMode>{isPrint ? <PrintView /> : <App />}</StrictMode>)
