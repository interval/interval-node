const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports.prisma = prisma;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.generateThumbnail = async function generateThumbnail(url) {
  await sleep(500);
  return '';
};

module.exports.generateSlug = function generateSlug(input) {
  return input.toLowerCase().replace(/[^-_.a-zA-Z\d]+/, '-');
};

module.exports.getCollisionSafeSlug = async function getCollisionSafeSlug(
  desiredSlug
) {
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
};

module.exports.findUsers = async function findUsers(query) {
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
};
