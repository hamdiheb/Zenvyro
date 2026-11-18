// Zenvyro chat widget loader. Paste on any website:
//   <script src="https://YOUR-ZENVYRO-ORIGIN/zenvyro-widget.js" data-widget-key="wk_…"
//           data-business-name="Your shop" async></script>
// data-business-name is optional: it is shown until the chat session returns the business's name.
// It adds one fixed iframe at the bottom-right. The chat runs inside the iframe, so the host
// site's CSS cannot change it. The iframe tells this script when it opens or closes, and the
// script resizes the iframe to fit. No other build is needed.
;(function loadZenvyroWidget() {
  if (window.ZenvyroWidget) {
    return
  }

  var loaderScript = document.currentScript || document.querySelector('script[data-widget-key]')
  if (!loaderScript) {
    return
  }

  var widgetKey = loaderScript.getAttribute('data-widget-key') || ''
  var businessName = loaderScript.getAttribute('data-business-name') || ''
  var widgetOrigin = new URL(loaderScript.src, window.location.href).origin
  var MOBILE_MAXIMUM_WIDTH = 480
  var CLOSED_SIZE = { width: '88px', height: '88px' }
  var OPEN_SIZE = { width: '402px', height: '660px' }

  var widgetFrame = document.createElement('iframe')
  var frameSource = new URL('/widget', widgetOrigin)
  frameSource.searchParams.set('key', widgetKey)
  if (businessName) {
    frameSource.searchParams.set('name', businessName)
  }
  widgetFrame.src = frameSource.toString()
  widgetFrame.title = 'Chat with us'
  widgetFrame.setAttribute('allowtransparency', 'true')

  var baseFrameStyle = {
    position: 'fixed',
    right: '0',
    bottom: '0',
    border: '0',
    background: 'transparent',
    colorScheme: 'normal',
    zIndex: '2147483000',
    maxWidth: '100vw',
    maxHeight: '100vh',
  }
  Object.keys(baseFrameStyle).forEach(function applyStyle(styleName) {
    widgetFrame.style[styleName] = baseFrameStyle[styleName]
  })

  function resizeFrame(isOpen) {
    var isMobileScreen = window.innerWidth <= MOBILE_MAXIMUM_WIDTH
    var frameSize = CLOSED_SIZE
    if (isOpen) {
      frameSize = isMobileScreen ? { width: '100vw', height: '100vh' } : OPEN_SIZE
    }
    widgetFrame.style.width = frameSize.width
    widgetFrame.style.height = frameSize.height
  }

  // Only this page knows the real screen width (the iframe is always small), so it tells the
  // widget whether to use the full-screen phone layout.
  function sendHostViewport() {
    if (widgetFrame.contentWindow) {
      widgetFrame.contentWindow.postMessage(
        { type: 'zenvyro:host-viewport', isCompactLayout: window.innerWidth <= MOBILE_MAXIMUM_WIDTH },
        widgetOrigin,
      )
    }
  }

  var isWidgetOpen = false
  function handleWidgetMessage(messageEvent) {
    var isFromWidget = messageEvent.origin === widgetOrigin && messageEvent.source === widgetFrame.contentWindow
    if (!isFromWidget || !messageEvent.data) {
      return
    }
    if (messageEvent.data.type === 'zenvyro:widget-ready') {
      sendHostViewport()
    }
    if (messageEvent.data.type === 'zenvyro:widget-state') {
      isWidgetOpen = Boolean(messageEvent.data.isOpen)
      resizeFrame(isWidgetOpen)
    }
  }

  function handleWindowResize() {
    resizeFrame(isWidgetOpen)
    sendHostViewport()
  }

  resizeFrame(false)
  window.addEventListener('message', handleWidgetMessage)
  window.addEventListener('resize', handleWindowResize)
  document.body.appendChild(widgetFrame)

  // destroy() lets single-page apps remove the widget when they leave the page.
  window.ZenvyroWidget = {
    destroy: function destroyWidget() {
      window.removeEventListener('message', handleWidgetMessage)
      window.removeEventListener('resize', handleWindowResize)
      widgetFrame.remove()
      delete window.ZenvyroWidget
    },
  }
})()
