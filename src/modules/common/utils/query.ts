type SortDir = 'asc' | 'desc';

export type ListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  sort?: string;
  filter?: string;
};

function pickFirst(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0]?.toString();
  if (v == null) return undefined;
  return String(v);
}

export function parseListQuery(q: any) {
  const pageStr = pickFirst(q?.page) ?? '1';
  const limitStr = pickFirst(q?.limit) ?? '10';
  const searchStr = pickFirst(q?.search) ?? '';
  const sortStr = pickFirst(q?.sort);
  const filterStr = pickFirst(q?.filter);

  const page = Math.max(parseInt(pageStr, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(limitStr, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const search = searchStr.trim();

  let orderBy: Record<string, SortDir> | undefined;
  if (sortStr) {
    const [field, dir] = sortStr.split(':');
    const d: SortDir = dir === 'desc' ? 'desc' : 'asc';
    if (field) orderBy = { [field]: d };
  }

  let where: Record<string, any> = {};
  if (filterStr) {
    try {
      const obj = JSON.parse(filterStr);
      if (obj && typeof obj === 'object') where = obj;
    } catch {}
  }

  return { page, limit, skip, search, orderBy, where };
}

export function shapeList<T>(items: T[], total: number, page: number, limit: number) {
  const pages = Math.ceil(total / limit);
  return { items, meta: { total, page, limit, pages } };
}
