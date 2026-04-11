export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  console.log('[NativeIntent] Handling Redirecting path:', path, 'initial:', initial);
  if (path.includes('sponsor-detail')) {
    return path;
  }
  if (path.includes('withdraw')) {
    return path;
  }
  return '/';
}
