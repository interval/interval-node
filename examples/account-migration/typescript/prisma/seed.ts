import { faker } from "@faker-js/faker";
import { Prisma, PrismaClient } from "@prisma/client";
import { generateSlug } from "../src/util";

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
        username: generateSlug([firstName, lastName].join(" ")),
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
