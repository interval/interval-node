const { faker } = require('@faker-js/faker');
const { PrismaClient } = require('@prisma/client');
const { generateSlug } = require('../src/util');

const prisma = new PrismaClient();

async function main() {
  for (let i = 0; i < 20; i++) {
    const firstName = faker.name.firstName();
    const lastName = faker.name.lastName();

    await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: faker.internet.email(firstName, lastName),
        username: generateSlug([firstName, lastName].join(' ')),
      },
    });
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
