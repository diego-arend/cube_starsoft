import bcrypt from "bcryptjs";
import { AppDataSource } from "../data-source";
import { UserEntity } from "../entities/user.entity";
import { UserRole } from "../enums/user-role.enum";

async function run() {
  const count = Number(10);
  const emailPrefix = "user";
  const emailDomain = "example.com";
  const basePassword = "password1234";

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(UserEntity);

  for (let i = 1; i <= count; i++) {
    const email = `${emailPrefix}${i}@${emailDomain}`;
    const name = `${emailPrefix} ${i}`;
    const password = basePassword;
    const hashed = await bcrypt.hash(password, 10);

    const found = await repo.findOne({ where: { email } });

    if (found) {
      found.role = UserRole.USER;
      found.passwordHash = hashed;
      found.name = name;
      await repo.save(found);
      console.log(`Updated user ${email} as USER.`);
    } else {
      const user = repo.create({
        email,
        name,
        passwordHash: hashed,
        role: UserRole.USER,
      });
      await repo.save(user);
      console.log(`Created user ${email}.`);
    }
  }

  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
