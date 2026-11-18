// SQL for the labels and conversation_labels tables. The executor is either the pool or a transaction client.
// Every query filters by business_id so labels never cross businesses.

export async function findLabelsForBusiness(databaseExecutor, { businessId }) {
  const result = await databaseExecutor.query(
    `SELECT id, name, color_hex
     FROM labels
     WHERE business_id = $1
     ORDER BY name`,
    [businessId],
  )
  return result.rows
}

export async function insertLabel(databaseExecutor, { businessId, name, colorHex }) {
  const result = await databaseExecutor.query(
    `INSERT INTO labels (business_id, name, color_hex)
     VALUES ($1, $2, $3)
     RETURNING id, name, color_hex`,
    [businessId, name, colorHex],
  )
  return result.rows[0]
}

// Counts how many of the given label ids exist in this business. The caller compares it with the input size.
export async function countLabelsInBusiness(databaseExecutor, { businessId, labelIds }) {
  const result = await databaseExecutor.query(
    `SELECT COUNT(*)::int AS matching_count
     FROM labels
     WHERE business_id = $1 AND id = ANY($2::uuid[])`,
    [businessId, labelIds],
  )
  return result.rows[0].matching_count
}

// Replaces the whole label set of one conversation. Callers run this inside a transaction.
export async function replaceConversationLabels(databaseExecutor, { conversationId, labelIds }) {
  await databaseExecutor.query(`DELETE FROM conversation_labels WHERE conversation_id = $1`, [conversationId])
  if (labelIds.length > 0) {
    await databaseExecutor.query(
      `INSERT INTO conversation_labels (conversation_id, label_id)
       SELECT $1, label_id FROM UNNEST($2::uuid[]) AS label_id`,
      [conversationId, labelIds],
    )
  }
}
