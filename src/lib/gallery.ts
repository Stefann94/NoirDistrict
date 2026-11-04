import type { ImageMetadata } from 'astro';

// Pozele se pun în src/assets/galerie/, numite „01-skin-fade.jpg”, „02-aranjat-barba.jpg”.
// Numărul stabilește ordinea; restul numelui devine textul alternativ (alt), important pentru Google Images.
const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/galerie/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

const toAlt = (path: string) => {
  const slug = path.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/^\d+[-_]?/, '');
  const words = slug.replace(/[-_]+/g, ' ').trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} – Noir District, Piatra Neamț`;
};

export const galleryImages = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, mod]) => ({ src: mod.default, alt: toAlt(path) }));
