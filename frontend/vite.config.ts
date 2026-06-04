import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Code-splitting por vendor: cada grupo se sirve en su propio chunk para que
// (1) la carga inicial sea más pequeña y (2) el navegador pueda cachear los
// vendors independientemente del código de la app. Sin esto, el bundle único
// supera 2.6 MB y dispara el warning de Vite.
const VENDOR_CHUNKS: Record<string, RegExp> = {
  // Stack RAG: pesa ~1 MB (transformers + onnxruntime-web). Sólo se necesita
  // cuando el usuario abre el Centro Operativo de IA — separado para no
  // bloquear la carga inicial del dashboard.
  'vendor-transformers': /[\\/]node_modules[\\/](@xenova[\\/]transformers|onnxruntime-web)[\\/]/,
  // PDF.js (extractor del Plan Municipal). Ya tiene su worker como asset
  // aparte; aislamos también la librería principal.
  'vendor-pdfjs': /[\\/]node_modules[\\/]pdfjs-dist[\\/]/,
  // Mapa táctico: leaflet + react-leaflet.
  'vendor-leaflet': /[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/,
  // Chakra UI + emotion (sistema de diseño).
  'vendor-chakra': /[\\/]node_modules[\\/](@chakra-ui|@emotion)[\\/]/,
  // Framer Motion (animaciones de tarjetas, drawer y transiciones).
  'vendor-framer': /[\\/]node_modules[\\/]framer-motion[\\/]/,
  // Iconos: react-icons importa muchos paquetes; un chunk dedicado evita
  // tree-shaking parcial dentro del bundle principal.
  'vendor-icons': /[\\/]node_modules[\\/]react-icons[\\/]/,
  // Núcleo React.
  'vendor-react': /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
  // html2canvas: capturas del mapa. Se carga dinámicamente desde SendMapModal,
  // pero igualmente lo aislamos para que ese chunk sea predecible.
  'vendor-canvas': /[\\/]node_modules[\\/]html2canvas[\\/]/,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev: proxy de la API al backend FastAPI de CECOVI (:8000). En prod la SPA la
  // sirve FastAPI desde frontend/dist (mismo origen, sin proxy).
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    // Subimos el umbral del warning: los vendor-chunks de transformers y
    // pdfjs (~1 MB y ~750 kB respectivamente) son irreductibles sin sacrificar
    // funcionalidad. El warning por defecto (500 kB) deja de ser accionable.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // Silencia el warning de eval directo que onnxruntime-web emite desde su
      // bundle ya minificado (no podemos modificar código de terceros). El
      // resto de warnings se preserva.
      onwarn(warning, defaultHandler) {
        if (
          warning.code === 'EVAL' &&
          typeof warning.id === 'string' &&
          warning.id.includes('onnxruntime-web')
        ) {
          return
        }
        defaultHandler(warning)
      },
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          for (const [name, pattern] of Object.entries(VENDOR_CHUNKS)) {
            if (pattern.test(id)) return name
          }
          return undefined
        },
      },
    },
  },
})
