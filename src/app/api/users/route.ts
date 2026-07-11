import { z } from "zod";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User, AuditLog } from "@/models";
import { apiHandler, requireAdmin, HttpError } from "@/lib/rbac";
import { ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(2, "Имя слишком короткое"),
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  password: z.string().min(8, "Пароль минимум 8 символов"),
  role: z.enum(ROLES).default("USER"),
});

/** Список пользователей (только админ). */
export async function GET() {
  return apiHandler(async () => {
    await requireAdmin();
    await dbConnect();
    const users = await User.find().sort({ createdAt: -1 }).lean();
    return {
      users: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
    };
  });
}

/** Создание пользователя (только админ). */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    }
    await dbConnect();

    const exists = await User.findOne({ email: parsed.data.email });
    if (exists) throw new HttpError(409, "Пользователь с таким email уже существует");

    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: bcrypt.hashSync(parsed.data.password, 10),
      role: parsed.data.role,
      createdBy: admin.id,
    });

    await AuditLog.create({
      user: admin.id,
      action: "user.create",
      entity: "User",
      entityId: String(user._id),
      meta: { email: user.email, role: user.role },
    });

    return {
      user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    };
  });
}
