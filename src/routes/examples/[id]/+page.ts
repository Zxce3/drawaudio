import { error } from '@sveltejs/kit';
import { EXAMPLE_SONGS } from '$lib/songs';

export const entries = () => EXAMPLE_SONGS.map((example) => ({ id: example.id }));

export function load({ params }) {
  if (!EXAMPLE_SONGS.some((example) => example.id === params.id)) error(404, 'Example song not found');
  return { id: params.id };
}
