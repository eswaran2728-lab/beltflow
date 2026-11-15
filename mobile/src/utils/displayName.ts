/**
 * Turns an internal id into something a person can read, for places where
 * only the id is known on the phone:
 *   org_selangor_silambam -> "Selangor Silambam"
 *   cls_selangor_junior   -> "Selangor Junior"
 * A real name from the server should always be preferred when available.
 */
export function readableId(id: string | null | undefined): string {
  if (!id) return '';
  const words = id
    .replace(/^(org|cls|class|stu|usr|grp)[_-]/i, '')
    .split(/[_-]+/)
    .filter(Boolean);
  if (words.length === 0) return id;
  return words.map(w => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
}
