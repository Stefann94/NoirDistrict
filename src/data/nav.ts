export const nav = [
  { href: '/servicii/', label: 'Servicii' },
  { href: '/galerie/', label: 'Galerie' },
  { href: '/contact/', label: 'Contact' },
] as const;

export const isCurrent = (href: string, path: string) =>
  href === '/' ? path === '/' : path.startsWith(href);
