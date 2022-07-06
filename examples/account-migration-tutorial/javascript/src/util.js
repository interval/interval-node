import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateThumbnail(url) {
  await sleep(500);
  return '';
}

export function generateSlug(input) {
  return input.toLowerCase().replace(/[^-_.a-zA-Z\d]+/, '-');
}

export async function getCollisionSafeSlug(desiredSlug) {
  const existingSlugs = (
    await prisma.video.findMany({
      where: {
        slug: {
          startsWith: desiredSlug,
        },
      },
      select: {
        slug: true,
      },
    })
  ).map(org => org.slug);

  if (existingSlugs.length === 0) {
    return desiredSlug;
  }

  let i = existingSlugs.length;
  let slug = `${desiredSlug}-${i}`;

  while (existingSlugs.includes(slug)) {
    i++;
    slug = `${desiredSlug}-${i}`;
  }

  return slug;
}

export async function findUsers(query) {
  return prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: query } },
        { lastName: { contains: query } },
        { email: { contains: query } },
        { username: { contains: query } },
      ],
    },
  });
}
