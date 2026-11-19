// Orele ocupate pe zile (cereri în așteptare, programări confirmate, ore blocate), ca formularul să
// arate doar orele libere. Formularul o citește din nou periodic, deci ce vede clientul e la zi.
// Nu conține date personale: doar intervale de timp.
import type { APIRoute } from 'astro';
import { availability, json } from '../../lib/booking-server';
import { NotConfigured } from '../../lib/store';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    return json(200, { ok: true, ...(await availability()) });
  } catch (error) {
    if (!(error instanceof NotConfigured)) console.error('Disponibilitate:', error);
    return json(503, { ok: false });
  }
};
