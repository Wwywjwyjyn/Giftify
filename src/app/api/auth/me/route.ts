import { getSessionUser } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ user: null });
  return Response.json({
    user: {
      id: user.id,
      role: user.role,
      wallet: user.wallet,
      telegramId: user.telegramId,
      name: user.name,
      photo: user.photo,
      verified: user.verified,
    },
  });
}
