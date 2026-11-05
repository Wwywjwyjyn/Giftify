import { NextRequest } from 'next/server';
import { getCollections, getSpecialCollections } from '@/lib/market';

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') || 'gifts';
  try {
    if (kind === 'usernames' || kind === 'numbers') {
      const collections = await getSpecialCollections(kind);
      return Response.json({ collections });
    }
    const collections = await getCollections('gifts');
    return Response.json({ collections });
  } catch {
    return Response.json({ collections: [] });
  }
}
