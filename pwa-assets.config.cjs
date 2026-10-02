// Configuración de @vite-pwa/assets-generator.
// Se ejecuta con `npm run pwa:assets` tras cambiar el logo.
// Referencia: https://vite-pwa-org.netlify.app/guide/assets-generator.html
module.exports = {
  // Se genera desde la copia de `public/` para que las imágenes salgan
  // directamente en `public/`: el manifest y las etiquetas de `<head>` necesitan
  // URL estables en la raíz, no los nombres con hash que Vite genera para `src/assets/`.
  path: 'public/langbox.svg',
  includeHtml: false,

  // El logo es un glifo blanco sobre fondo transparente. Sin un fondo de marca,
  // las iconos "maskable" se ven recortadas al perder la zona segura del sistema
  // y el glifo blanco desaparece sobre una pantalla de inicio clara.
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      padding: 0.14,
      resizeOptions: { background: '#4f46e5' },
      favicons: [[48, 'favicon.ico']]
    },
    maskable: {
      // La zona segura de una maskable es un círculo del 80%: el 20% del ancho
      // queda sujeto a recorte según el launcher, de ahí el margen extra.
      sizes: [512],
      padding: 0.24,
      resizeOptions: { background: '#4f46e5' }
    },
    apple: {
      sizes: [180],
      padding: 0.14,
      resizeOptions: { background: '#4f46e5' }
    }
  },

  name: 'LangBox - Tu repositorio de vocabulario',
  short_name: 'LangBox',
  theme_color: '#09090b',
  png: { quality: 90 }
}