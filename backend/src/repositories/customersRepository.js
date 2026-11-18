// SQL for the customers table. The executor is either the pool or a transaction client.

export async function findCustomerForBusiness(databaseExecutor, { businessId, customerId }) {
  const result = await databaseExecutor.query(
    `SELECT id, business_id, name, email, external_id
     FROM customers
     WHERE id = $1 AND business_id = $2`,
    [customerId, businessId],
  )
  return result.rows[0] ?? null
}

// Finds the oldest customer in this business with the same external id or email. Either may be null.
export async function findExistingCustomerForBusiness(databaseExecutor, { businessId, externalId, email }) {
  const result = await databaseExecutor.query(
    `SELECT id, business_id, name, email, external_id
     FROM customers
     WHERE business_id = $1
       AND (($2::text IS NOT NULL AND external_id = $2::text)
            OR ($3::text IS NOT NULL AND email = $3::text))
     ORDER BY created_at, id
     LIMIT 1`,
    [businessId, externalId ?? null, email ?? null],
  )
  return result.rows[0] ?? null
}

export async function insertCustomer(databaseExecutor, { businessId, name, email, externalId }) {
  const result = await databaseExecutor.query(
    `INSERT INTO customers (business_id, name, email, external_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, business_id, name, email, external_id`,
    [businessId, name, email ?? null, externalId ?? null],
  )
  return result.rows[0]
}
