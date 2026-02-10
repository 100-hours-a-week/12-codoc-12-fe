let isInitialized = false

export const getGaId = () => {
  const gaId = import.meta.env.VITE_GA_ID
  return typeof gaId === 'string' ? gaId.trim() : ''
}

export const initGa4 = () => {
  const gaId = getGaId()
  if (!gaId || isInitialized) {
    return
  }

  if (!window.dataLayer) {
    window.dataLayer = []
  }

  function gtag() {
    window.dataLayer.push(arguments)
  }

  window.gtag = window.gtag || gtag

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
  document.head.appendChild(script)

  window.gtag('js', new Date())
  window.gtag('config', gaId, { send_page_view: false })

  isInitialized = true
}

export const setUserId = (userId) => {
  if (!isInitialized) {
    initGa4()
  }
  const gaId = getGaId()
  if (!gaId || typeof window.gtag !== 'function') {
    return
  }
  if (userId === null || userId === undefined || userId === '') {
    return
  }
  window.gtag('config', gaId, { user_id: String(userId) })
}

export const trackPageView = (path) => {
  const gaId = getGaId()
  if (!gaId || typeof window.gtag !== 'function') {
    return
  }
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

export const trackEvent = (name, params = {}) => {
  const gaId = getGaId()
  if (!gaId || typeof window.gtag !== 'function' || !name) {
    return
  }
  window.gtag('event', name, params)
}
