// Studio private project IDs and separate opt-in public Live Signal names.
export const PROJECTS = Object.freeze({
  'devon-station': { label: 'DevonStation', repository: 'devon-station', publicSlug: 'devonstation' },
  'devonakins-com': { label: 'DevonAkins.com', repository: 'devonakins.com', publicSlug: 'devonakins-com' },
  knowledge: { label: 'Knowledge', repository: 'knowledge', publicSlug: 'knowledge' },
  mizvo: { label: 'Mizvo', repository: 'mizvo', publicSlug: 'mizvo' },
  rhen: { label: 'Rhen', repository: 'rhen', publicSlug: 'rhen' },
  merit: { label: 'Merit', repository: 'merit', publicSlug: 'merit' },
  squelch: { label: 'Squelch', repository: 'squelch', publicSlug: 'squelch' },
  brandicade: { label: 'Brandicade', repository: 'brandicade', publicSlug: 'brandicade' },
  vesper: { label: 'Vesper', repository: 'vesper', publicSlug: 'vesper' },
});
export function projectForRemote(remote) {
  if (typeof remote !== 'string') return null;
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)devonalanakins\/([a-z0-9.-]+?)(?:\.git)?$/.exec(remote);
  if (!match) return null;
  return Object.entries(PROJECTS).find(([, project]) => project.repository === match[1])?.[0] ?? null;
}
export function knownProject(id) {
  return typeof id === 'string' && Object.hasOwn(PROJECTS, id);
}
