// Centralized context packing. Character counts are a conservative transport budget,
// not a semantic per-source cap. High-priority sections are kept first; lower-priority
// sections use whatever room remains instead of each feature inventing its own hard cut.
export function fitContextSections(sections = [], { charBudget = 90000 } = {}) {
  const rows = (Array.isArray(sections) ? sections : [])
    .map((item, index) => ({
      key: String(item?.key || `section-${index}`),
      text: String(item?.text || '').trim(),
      priority: Number(item?.priority ?? 0),
      order: index,
    }))
    .filter(item => item.text)
    .sort((a,b) => b.priority - a.priority || a.order - b.order);
  let remaining = Math.max(8000, Number(charBudget || 90000));
  const kept = [];
  for (const row of rows) {
    if (remaining <= 0) break;
    const take = row.text.length <= remaining ? row.text : row.text.slice(0, remaining);
    if (take.trim()) kept.push({ ...row, text: take + (take.length < row.text.length ? '\n…（上下文预算已满，其余低优先级内容未装入本轮）' : '') });
    remaining -= take.length;
  }
  return kept.sort((a,b)=>a.order-b.order).map(item=>item.text).join('\n\n');
}
