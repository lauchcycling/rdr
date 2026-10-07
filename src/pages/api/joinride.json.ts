import type { APIRoute } from 'astro';
import { getJoinrideStatus } from '../../lib/joinride';

export const prerender = false;

export const GET: APIRoute = async () => {
  const status = await getJoinrideStatus();

  return new Response(JSON.stringify(status, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
};
