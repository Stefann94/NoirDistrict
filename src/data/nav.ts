// Navigarea principală duce la secțiunile primei pagini. De pe subpagini, link-ul `/#sectiune`
// deschide prima pagină direct la secțiune. `page` = subpagina echivalentă, marcată ca activă.
export const sections = [
  { id: 'lucrari', label: 'Lucrări', page: '/galerie/' },
  { id: 'preturi', label: 'Prețuri', page: '/servicii/' },
  { id: 'contact', label: 'Contact', page: '/contact/' },
] as const;

export const sectionHref = (id: string) => `/#${id}`;

// Paginile separate (footer): bune pentru Google și pentru cine vrea toate detaliile.
export const pages = [
  { href: '/galerie/', label: 'Galerie' },
  { href: '/servicii/', label: 'Servicii și prețuri' },
  { href: '/contact/', label: 'Contact și program' },
  { href: '/politica-de-confidentialitate/', label: 'Confidențialitate' },
] as const;

export const isCurrent = (href: string, path: string) =>
  href === '/' ? path === '/' : path.startsWith(href);
