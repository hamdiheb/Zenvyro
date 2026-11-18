// SQL for the messages table. The executor is either the pool or a transaction client.
// Messages belong to a conversation; callers check the conversation's business before calling these.

export async function insertMessage(databaseExecutor, { conversationId, senderType, senderId, body }) {
  const result = await databaseExecutor.query(
    `INSERT INTO messages (conversation_id, sender_type, sender_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, conversation_id, sender_type, sender_id, body, created_at`,
    [conversationId, senderType, senderId ?? null, body],
  )
  return result.rows[0]
}

// Returns up to fetchCount rows, newest first. sort_value is created_at as Postgres text, used as the cursor.
export async function findMessagesPageForConversation(
  databaseExecutor,
  { conversationId, cursor, fetchCount },
) {
  const parameters = [conversationId]
  let cursorCondition = ''
  if (cursor) {
    parameters.push(cursor.sortValue, cursor.id)
    cursorCondition = `AND (created_at, id) < ($2::timestamptz, $3::uuid)`
  }
  parameters.push(fetchCount)

  const result = await databaseExecutor.query(
    `SELECT id, conversation_id, sender_type, sender_id, body, created_at,
            created_at::text AS sort_value
     FROM messages
     WHERE conversation_id = $1
     ${cursorCondition}
     ORDER BY created_at DESC, id DESC
     LIMIT $${parameters.length}`,
    parameters,
  )
  return result.rows
}
