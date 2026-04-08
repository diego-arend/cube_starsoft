import bcrypt from "bcryptjs";
import { AppDataSource } from "../data-source";
import { UserEntity } from "../entities/user.entity";
import { UserRole } from "../enums/user-role.enum";

async function run() {
  const email = "admin@example.com";
  const password = "admin1234";
  const name = "Administrator";

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(UserEntity);

  const found = await repo.findOne({ where: { email } });
  const hashed = await bcrypt.hash(password, 10);

  if (found) {
    console.log(`User ${email} already exists. Updating role and password.`);
    found.role = UserRole.ADMIN;
    found.passwordHash = hashed;
    found.name = name;
    await repo.save(found);
    console.log(`Updated user ${email} as ADMIN.`);
  } else {
    const user = repo.create({
      email,
      name,
      passwordHash: hashed,
      role: UserRole.ADMIN,
    });
    await repo.save(user);
    console.log(`Created admin user ${email}.`);
  }

  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
