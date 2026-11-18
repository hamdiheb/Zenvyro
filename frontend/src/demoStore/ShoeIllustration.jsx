// Original, simple sneaker artwork for the fictional Acme Shoes store. The colour comes from
// currentColor, so each product tile can tint it.
export function ShoeIllustration({ size = 180 }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 200 120" aria-hidden="true">
      <ellipse cx="100" cy="108" rx="86" ry="7" fill="rgba(27,29,41,0.08)" />
      <path
        d="M18 88c0-10 6-16 16-18l34-8c8-2 14-10 18-20l6-14c2-4 6-6 10-5l12 4c4 1 6 5 5 9l-2 8c10 4 26 10 44 16 14 5 22 12 22 24v6H18z"
        fill="currentColor"
      />
      <path d="M18 92h166v6c0 4-3 6-7 6H25c-4 0-7-2-7-6z" fill="#ffffff" stroke="rgba(27,29,41,0.12)" />
      <path d="M86 46l14 6M80 56l14 6M74 64l12 5" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      <path d="M128 72c14 2 28 6 40 12" stroke="rgba(255,255,255,0.55)" strokeWidth="5" strokeLinecap="round" fill="none" />
    </svg>
  )
}
