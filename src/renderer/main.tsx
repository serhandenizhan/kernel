import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { PrintView } from './print/PrintView'
import 'katex/dist/katex.min.css'
// IBM Plex Sans (OFL): varsayılan not yazı tipi, uygulamayla gelir (ağ gerekmez)
import '@fontsource-variable/ibm-plex-sans/wght.css'
import '@fontsource-variable/ibm-plex-sans/wght-italic.css'
import '@fontsource-variable/fraunces/wght.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
// Bricolage paketi (OFL): başlık Bricolage Grotesque, gövde Figtree, kod ve küçük etiketler DM Mono
import '@fontsource-variable/bricolage-grotesque/wght.css'
import '@fontsource-variable/figtree/wght.css'
import '@fontsource-variable/figtree/wght-italic.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
// ek paketler (OFL): Editorial, Space, Literata, Nunito
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import '@fontsource-variable/literata/wght.css'
import '@fontsource-variable/literata/wght-italic.css'
import '@fontsource-variable/fira-code/wght.css'
import '@fontsource-variable/nunito/wght.css'
import '@fontsource-variable/nunito/wght-italic.css'
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
