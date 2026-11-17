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
