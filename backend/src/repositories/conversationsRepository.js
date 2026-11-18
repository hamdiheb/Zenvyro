// SQL for the conversations table. The executor is either the pool or a transaction client.
// Every query filters by business_id so one business can never read another business's rows.

// sort_value is the last_message_at as Postgres text. It becomes the pagination cursor.
const SELECT_CONVERSATION_WITH_CUSTOMER = `
  SELECT conversations.id,
         conversations.business_id,
         conversations.customer_id,
         customers.name AS customer_name,
         customers.email AS customer_email,
         conversations.channel,
         conversations.mode,
         conversations.status,
         conversations.assigned_agent_id,
         conversations.last_message_at,
         conversations.resolved_at,
         conversations.created_at,
         conversations.updated_at,
         conversations.last_message_at::text AS sort_value
  FROM conversations
  JOIN customers ON customers.id = conversations.customer_id`

export async function insertConversation(databaseExecutor, { businessId, customerId }) {
  const result = await databaseExecutor.query(
    `INSERT INTO conversations (business_id, customer_id, last_message_at)
     VALUES ($1, $2, now())
     RETURNING id`,
    [businessId, customerId],
  )
  return result.rows[0]
}

export async function findConversationForBusiness(databaseExecutor, { businessId, conversationId }) {
  const result = await databaseExecutor.query(
    `${SELECT_CONVERSATION_WITH_CUSTOMER}
     WHERE conversations.id = $1 AND conversations.business_id = $2`,
    [conversationId, businessId],
  )
  return result.rows[0] ?? null
}

// Locks the row until the transaction ends, so two agents cannot change the same conversation at once.
export async function lockConversationForBusiness(databaseExecutor, { businessId, conversationId }) {
  const result = await databaseExecutor.query(
    `SELECT id, status
     FROM conversations
     WHERE id = $1 AND business_id = $2
     FOR UPDATE`,
    [conversationId, businessId],
  )
  return result.rows[0] ?? null
}

// Returns up to fetchCount rows, newest activity first. Filters are added only when given.
export async function findConversationsPageForBusiness(
  databaseExecutor,
  { businessId, staffUserId, view, status, mode, customerId, cursor, fetchCount },
) {
  const parameters = [businessId]
  const conditions = ['conversations.business_id = $1']
  const addParameter = (value) => {
    parameters.push(value)
    return `$${parameters.length}`
  }

  if (view === 'mine') {
    conditions.push(`conversations.assigned_agent_id = ${addParameter(staffUserId)}`)
  }
  if (view === 'unassigned') {
    conditions.push('conversations.assigned_agent_id IS NULL')
  }
  if (status) {
    conditions.push(`conversations.status = ${addParameter(status)}`)
  }
  if (mode) {
    conditions.push(`conversations.mode = ${addParameter(mode)}`)
  }
  if (customerId) {
    conditions.push(`conversations.customer_id = ${addParameter(customerId)}`)
  }
  if (cursor) {
    const sortValuePlaceholder = addParameter(cursor.sortValue)
    const idPlaceholder = addParameter(cursor.id)
    conditions.push(
      `(conversations.last_message_at, conversations.id) < (${sortValuePlaceholder}::timestamptz, ${idPlaceholder}::uuid)`,
    )
  }

  const limitPlaceholder = addParameter(fetchCount)
  const result = await databaseExecutor.query(
    `${SELECT_CONVERSATION_WITH_CUSTOMER}
     WHERE ${conditions.join(' AND ')}
     ORDER BY conversations.last_message_at DESC, conversations.id DESC
     LIMIT ${limitPlaceholder}`,
    parameters,
  )
  return result.rows
}

// Returns true when a row was changed. The CASE keeps resolved_at in step with the status.
export async function updateConversationStatusAndMode(
  databaseExecutor,
  { businessId, conversationId, status, mode },
) {
  const result = await databaseExecutor.query(
    `UPDATE conversations
     SET status = COALESCE($3::text, status),
         mode = COALESCE($4::text, mode),
         resolved_at = CASE
           WHEN $3::text IS NULL THEN resolved_at
           WHEN $3::text = 'resolved' THEN COALESCE(resolved_at, now())
           ELSE NULL
         END,
         updated_at = now()
     WHERE id = $1 AND business_id = $2`,
    [conversationId, businessId, status ?? null, mode ?? null],
  )
  return result.rowCount > 0
}

export async function touchConversationLastMessageAt(databaseExecutor, { conversationId }) {
  await databaseExecutor.query(
    `UPDATE conversations
     SET last_message_at = now(), updated_at = now()
     WHERE id = $1`,
    [conversationId],
  )
}
