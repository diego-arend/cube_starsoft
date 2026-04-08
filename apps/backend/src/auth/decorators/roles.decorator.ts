import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@turborepo/database";

export const ROLES_KEY = "roles";
const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export default Roles;
