import type { ImageMetadata } from 'astro';

// Pozele stau în src/assets/galerie/, numite „01-carare-skin-fade.jpg”. Numărul dă ordinea.
// Titlul și textul alternativ (important pentru Google Images) se scriu mai jos, după numele fișierului.
// O poză nouă fără intrare aici primește un titlu generat din nume.
const captions: Record<string, { title: string; alt: string }> = {
  'carare-skin-fade': {
    title: 'Cărare tăiată și skin fade',
    alt: 'Tunsoare cu cărare tăiată și skin fade, părul pieptănat lateral',
  },
  'textured-mid-fade': {
    title: 'Textured crop și mid fade',
    alt: 'Păr texturat pe creștet cu mid fade până la piele',
  },
  'low-taper-texturat': {
    title: 'Low taper, păr lung texturat',
    alt: 'Low taper la ceafă și păr lung texturat pe creștet, văzut din spate',
  },
  'slick-back-low-taper': {
    title: 'Slick back și low taper',
    alt: 'Păr dat pe spate cu low taper și barbă tip goatee',
  },
  'crop-texturat-drop-fade': {
    title: 'Crop texturat și drop fade',
    alt: 'Crop texturat cu breton scurt și drop fade până la piele',
  },
  'textured-fringe-skin-fade': {
    title: 'Textured fringe și skin fade',
    alt: 'Păr negru texturat, cu breton, și skin fade înalt la tâmple',
  },
};

const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/galerie/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

const slugOf = (path: string) => path.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/^\d+[-_]?/, '');

const fallback = (slug: string) => {
  const words = slug.replace(/[-_]+/g, ' ').trim();
  const title = `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
  return { title, alt: title };
};

export const galleryImages = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, mod]) => {
    const slug = slugOf(path);
    const { title, alt } = captions[slug] ?? fallback(slug);
    return { slug, src: mod.default, title, alt: `${alt} – Noir District, Piatra Neamț` };
  });

export const galleryBySlug = (slug: string) => {
  const img = galleryImages.find((i) => i.slug === slug);
  if (!img) throw new Error(`Poza „${slug}” nu există în src/assets/galerie/`);
  return img;
};
