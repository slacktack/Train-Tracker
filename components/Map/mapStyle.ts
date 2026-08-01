export function getMapStyleUrl(theme: 'light' | 'dark', apiKey: string): string {
  const styleId = theme === 'dark' ? 'streets-v2-dark' : 'streets-v2-light';
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${apiKey}`;
}
