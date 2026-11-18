import styles from './ProductGridSection.module.css'

// products: [{ id, name, price, tagline, colorHex, illustration }]
export function ProductGridSection({ title, description = '', products }) {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        <ul className={styles.grid}>
          {products.map((product) => (
            <li key={product.id} className={styles.card}>
              <div className={styles.imageTile} style={{ '--tile-color': product.colorHex }}>
                {product.illustration}
              </div>
              <div className={styles.cardBody}>
                <div>
                  <h3 className={styles.productName}>{product.name}</h3>
                  <p className={styles.productTagline}>{product.tagline}</p>
                </div>
                <p className={styles.price}>{product.price}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
