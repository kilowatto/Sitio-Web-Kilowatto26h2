export async function loadTranslations(db: any, entityType: string, locale: string) {
  const { results } = await db
    .prepare("SELECT entity_id, field_key, value FROM translations WHERE entity_type = ? AND locale = ?")
    .bind(entityType, locale)
    .all();

  const map = new Map<string, string>();
  for (const row of results ?? []) {
    map.set(`${row.entity_id}:${row.field_key}`, row.value);
  }
  return map;
}

export function t(map: Map<string, string>, entityId: number | string, field: string, fallback: string | null) {
  return map.get(`${entityId}:${field}`) ?? fallback;
}
