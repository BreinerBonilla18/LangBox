import sharp from 'sharp'
import { readdir, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'

// El generador de assets produce los iconos "any" sobre un canvas transparente
// por diseño (`generateTransparentAsset` fuerza alpha 0 y no admite color de
// fondo). El logo de LangBox es un glifo blanco, que sobre una pantalla de inicio
// clara sería invisible, así que aquí se aplanan sobre el color de marca.
// Los iconos "maskable" y "apple-touch" ya salen con fondo y se dejan intactos.

const BACKGROUND = '#4f46e5'
const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname.replace(/^\//, '')

const TRANSPARENT_ICONS = ['pwa-64x64.png', 'pwa-192x192.png', 'pwa-512x512.png']

for (const file of TRANSPARENT_ICONS) {
  const input = join(PUBLIC_DIR, file)
  const tmp = join(PUBLIC_DIR, `${file}.tmp`)

  await sharp(input)
    // `flatten` combina el canal alfa sobre el color de marca.
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toFile(tmp)

  await unlink(input)
  await rename(tmp, input)
  console.log(`Aplanado sobre ${BACKGROUND}: public/${file}`)
}

// Aviso si el generador empezó a emitir algún icono "any" nuevo que este
// script no cubre, para que no quede transparente por descuido.
const generated = await readdir(PUBLIC_DIR)
const unhandled = generated.filter(
  name => name.startsWith('pwa-') && name.endsWith('.png') && !TRANSPARENT_ICONS.includes(name)
)

if (unhandled.length > 0) {
  console.warn(`Iconos "any" no cubiertos por el aplanado: ${unhandled.join(', ')}`)
}