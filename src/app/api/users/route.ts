import { z } from "zod";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User, Agent, AuditLog } from "@/models";
import { apiHandler, requireAdmin, HttpError } from "@/lib/rbac";
import { ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

const GRADIENTS = ["#4f7cff,#6a5cff", "#f5a524,#f5455c", "#25c281,#1fa86e", "#9b6dff,#6a5cff", "#4f7cff,#25c281", "#f5455c,#9b6dff"];

const createSchema = z.object({
  name: z.string().trim().min(2, "Имя слишком короткое"),
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  password: z.string().min(8, "Пароль минимум 8 символов"),
  role: z.enum(ROLES).default("USER"),
  // для роли AGENT — параметры доменной записи агента
  title: z.string().trim().optional(),
  teamId: z.string().optional(),
  ownerId: z.string().optional(), // куратор (пользователь, который смотрит за агентом)
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

    // Роль «Агент» → создаём связанную доменную запись агента (появится на «Агенты»,
    // а пользователь заходит по email+паролю).
    let agentId: string | undefined;
    if (parsed.data.role === "AGENT") {
      const team = parsed.data.teamId && mongoose.isValidObjectId(parsed.data.teamId) ? parsed.data.teamId : null;
      const owner = parsed.data.ownerId && mongoose.isValidObjectId(parsed.data.ownerId) ? parsed.data.ownerId : admin.id;
      const agent = await Agent.create({
        name: parsed.data.name,
        title: parsed.data.title?.trim() || "Sales agent",
        team,
        owner,
        user: user._id,
        isOnline: false,
        color: GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
      });
      user.agent = agent._id;
      await user.save();
      agentId = String(agent._id);
    }

    await AuditLog.create({
      user: admin.id,
      action: parsed.data.role === "AGENT" ? "agent.create" : "user.create",
      entity: parsed.data.role === "AGENT" ? "Agent" : "User",
      entityId: agentId ?? String(user._id),
      meta: { email: user.email, role: user.role },
    });

    return {
      user: { id: String(user._id), name: user.name, email: user.email, role: user.role, agentId },
    };
  });
}
