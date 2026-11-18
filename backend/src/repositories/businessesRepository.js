// SQL for the businesses table. The executor is either the pool or a transaction client.
export async function insertBusiness(databaseExecutor, { name, slug, widgetKey }) {
  const result = await databaseExecutor.query(
    `INSERT INTO businesses (name, slug, widget_key)
     VALUES ($1, $2, $3)
     RETURNING id, name, slug, widget_key, created_at`,
    [name, slug, widgetKey],
  )
  return result.rows[0]
}

// Looks up the business that owns a widget key. The widget key is public (it is in the embed code).
export async function findBusinessByWidgetKey(databaseExecutor, { widgetKey }) {
  const result = await databaseExecutor.query(
    `SELECT id, name, slug, widget_key
     FROM businesses
     WHERE widget_key = $1`,
    [widgetKey],
  )
  return result.rows[0] ?? null
}
