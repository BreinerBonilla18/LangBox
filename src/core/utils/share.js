// Utilidades para el compartido de palabras. La URL reutiliza la ruta de
// búsqueda y solo lleva la palabra y el nombre de quien la comparte (`via`);
// quien la abre llega a la búsqueda normal con un aviso de quién la compartió,
// sin guardar nada en la nube.

export const buildShareUrl = (word, name) => {
  const via = (name || '').trim()
  const base = window.location.origin
  const wordParam = encodeURIComponent(word)
  if (!via) return `${base}/search/${wordParam}`
  return `${base}/search/${wordParam}?via=${encodeURIComponent(via)}`
}

export const copyToClipboard = async text => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Fallback para contextos (HTTP antiguo, WebView) sin API de portapapeles.
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}