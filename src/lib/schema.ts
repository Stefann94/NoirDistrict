import { business, serviceGroups, socialLinks } from '../data/business';

const DAY_URL = {
  Mo: 'https://schema.org/Monday',
  Tu: 'https://schema.org/Tuesday',
  We: 'https://schema.org/Wednesday',
  Th: 'https://schema.org/Thursday',
  Fr: 'https://schema.org/Friday',
  Sa: 'https://schema.org/Saturday',
  Su: 'https://schema.org/Sunday',
} as const;

export interface Crumb {
  name: string;
  path: string;
}

interface GraphInput {
  site: URL;
  url: URL;
  title: string;
  description: string;
  image: URL;
  crumbs?: Crumb[];
}

/**
 * Un singur bloc JSON-LD per pagină, ca @graph legat prin @id:
 * WebSite + HairSalon (afacerea locală) + WebPage + BreadcrumbList (opțional).
 */
export function buildGraph({ site, url, title, description, image, crumbs }: GraphInput) {
  const siteId = new URL('/#website', site).href;
  const businessId = new URL('/#business', site).href;
  const pageId = `${url.href}#webpage`;

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': siteId,
      url: site.href,
      name: business.name,
      inLanguage: 'ro-RO',
      publisher: { '@id': businessId },
    },
    {
      '@type': 'HairSalon',
      '@id': businessId,
      name: business.name,
      description: business.description,
      url: site.href,
      image: image.href,
      telephone: business.phone,
      email: business.email || undefined,
      priceRange: business.priceRange,
      currenciesAccepted: business.currency,
      address: {
        '@type': 'PostalAddress',
        streetAddress: business.address.street,
        addressLocality: business.address.city,
        addressRegion: business.address.region,
        postalCode: business.address.postalCode || undefined,
        addressCountry: business.address.country,
      },
      geo: business.geo
        ? { '@type': 'GeoCoordinates', latitude: business.geo.lat, longitude: business.geo.lng }
        : undefined,
      areaServed: { '@type': 'City', name: business.address.city },
      openingHoursSpecification: business.hours.map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: h.days.map((d) => DAY_URL[d]),
        opens: h.opens,
        closes: h.closes,
      })),
      founder: { '@type': 'Person', name: business.owner },
      sameAs: socialLinks.length ? socialLinks.map((s) => s.url) : undefined,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Servicii',
        itemListElement: serviceGroups.map((group) => ({
          '@type': 'OfferCatalog',
          name: group.title,
          itemListElement: group.services.map((s) => ({
            '@type': 'Offer',
            price: s.price,
            priceCurrency: business.currency,
            itemOffered: { '@type': 'Service', name: s.name, description: s.description },
          })),
        })),
      },
    },
    {
      '@type': 'WebPage',
      '@id': pageId,
      url: url.href,
      name: title,
      description,
      inLanguage: 'ro-RO',
      isPartOf: { '@id': siteId },
      about: { '@id': businessId },
      primaryImageOfPage: image.href,
      ...(crumbs && { breadcrumb: { '@id': `${url.href}#breadcrumb` } }),
    },
  ];

  if (crumbs) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url.href}#breadcrumb`,
      itemListElement: [{ name: 'Acasă', path: '/' }, ...crumbs].map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: new URL(c.path, site).href,
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
