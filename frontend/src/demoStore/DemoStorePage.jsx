import { useEffect } from 'react'
import { MessageCircle, RotateCcw, Search, ShoppingBag, Truck, User } from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { HeroSection } from '../components/sections/HeroSection'
import { ProductGridSection } from '../components/sections/ProductGridSection'
import { FeatureHighlightsSection } from '../components/sections/FeatureHighlightsSection'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { ShoeIllustration } from './ShoeIllustration.jsx'
import styles from './DemoStorePage.module.css'

const DEMO_BUSINESS_NAME = 'Acme Shoes'
const LOADER_SCRIPT_ID = 'zenvyro-widget-loader'

const PRODUCTS = [
  { id: 'trail-runner', name: 'Trail Runner', tagline: 'Grippy, light, ready for mud', price: '$118', colorHex: '#EA580C' },
  { id: 'city-walker', name: 'City Walker', tagline: 'All-day comfort on pavement', price: '$96', colorHex: '#2563EB' },
  { id: 'court-classic', name: 'Court Classic', tagline: 'Clean leather, timeless shape', price: '$104', colorHex: '#16A34A' },
  { id: 'cloud-slip', name: 'Cloud Slip-on', tagline: 'No laces, all cushion', price: '$82', colorHex: '#9333EA' },
  { id: 'summit-hiker', name: 'Summit Hiker', tagline: 'Waterproof and ankle-high', price: '$146', colorHex: '#B45309' },
  { id: 'sprint-pro', name: 'Sprint Pro', tagline: 'Race-day carbon plate', price: '$168', colorHex: '#DB2777' },
].map((product) => ({ ...product, illustration: <ShoeIllustration size={150} /> }))

const FEATURES = [
  { title: 'Free shipping over $75', description: 'Delivered in 2–4 business days.', icon: Truck },
  { title: '30-day easy returns', description: "Didn't fit? Send it back for free.", icon: RotateCcw },
  { title: 'Real people on chat', description: 'Tap the bubble at the bottom-right.', icon: MessageCircle },
]

const FOOTER_COLUMNS = [
  { title: 'Shop', links: ['New arrivals', 'Running', 'Everyday', 'Outdoor'] },
  { title: 'Help', links: ['Shipping', 'Returns', 'Size guide'] },
  { title: 'Company', links: ['About', 'Careers', 'Press'] },
]

// A fictional storefront that embeds the widget exactly like a customer site would: by adding
// the loader script. The Week 1 end-to-end demo runs here.
export function DemoStorePage() {
  const widgetKey = import.meta.env.VITE_DEMO_WIDGET_KEY || ''

  useEffect(() => {
    if (!widgetKey || document.getElementById(LOADER_SCRIPT_ID)) {
      return undefined
    }
    const loaderScript = document.createElement('script')
    loaderScript.id = LOADER_SCRIPT_ID
    loaderScript.src = '/zenvyro-widget.js'
    loaderScript.async = true
    loaderScript.dataset.widgetKey = widgetKey
    loaderScript.dataset.businessName = DEMO_BUSINESS_NAME
    document.body.appendChild(loaderScript)
    return () => {
      window.ZenvyroWidget?.destroy()
      loaderScript.remove()
    }
  }, [widgetKey])

  return (
    <div className={styles.store} id="top">
      <p className={styles.announcement}>Free shipping on orders over $75 · Demo store for Zenvyro</p>
      <Navbar
        variant="storefront"
        leading={<span className={styles.storeBrand}>{DEMO_BUSINESS_NAME}</span>}
        center={
          <nav className={styles.storeLinks} aria-label="Store">
            <a href="#top">Home</a>
            <a href="#catalog">Catalog</a>
            <a href="#help">Help</a>
          </nav>
        }
        trailing={
          <>
            <IconButton label="Search">
              <Search size={18} aria-hidden="true" />
            </IconButton>
            <IconButton label="Account">
              <User size={18} aria-hidden="true" />
            </IconButton>
            <IconButton label="Cart">
              <ShoppingBag size={18} aria-hidden="true" />
            </IconButton>
          </>
        }
      />
      {!widgetKey && (
        <p className={styles.setupNotice} role="alert">
          Set VITE_DEMO_WIDGET_KEY in frontend/.env to show the chat widget on this page.
        </p>
      )}
      <HeroSection
        eyebrow="New season"
        title="Step into comfort that lasts all day"
        description="Lightweight sneakers built for city miles, weekend trails and everything in between."
        action={
          <a href="#catalog" className={styles.heroLink}>
            <Button size="large">Shop the collection</Button>
          </a>
        }
        illustration={
          <div className={styles.heroArt}>
            <ShoeIllustration size={340} />
          </div>
        }
      />
      <div id="catalog">
        <ProductGridSection
          title="Bestsellers"
          description="Our most-loved pairs this month."
          products={PRODUCTS}
        />
      </div>
      <div id="help">
        <FeatureHighlightsSection features={FEATURES} />
      </div>
      <Footer
        brandName={DEMO_BUSINESS_NAME}
        tagline="Comfortable shoes for every step. A fictional store for demos."
        linkColumns={FOOTER_COLUMNS}
        bottomNote="© Acme Shoes. Fictional demo storefront. Chat powered by Zenvyro."
      />
    </div>
  )
}
