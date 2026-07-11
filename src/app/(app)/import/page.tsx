import { dbConnect } from "@/lib/db";
import { Source } from "@/models";
import { getSessionUser } from "@/lib/rbac";
import { decryptNullable } from "@/lib/crypto";
import { SOURCE_TYPE_LABEL, type SourceType } from "@/lib/enums";
import CsvImport from "@/components/CsvImport";
import ApiIntakeCard from "@/components/ApiIntakeCard";

export const dynamic = "force-dynamic";

export interface SourceLite {
  id: string;
  name: string;
  type: SourceType;
  isActive: boolean;
  webhookUrl: string;
  secret?: string;
}

export default async function ImportPage() {
  const me = await getSessionUser();
  const isAdmin = me?.role === "ADMIN";

  await dbConnect();
  const sources = await Source.find().sort({ createdAt: 1 }).lean();
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const list: SourceLite[] = sources.map((s) => ({
    id: String(s._id),
    name: s.name,
    type: s.type,
    isActive: s.isActive,
    webhookUrl: `${appUrl}/api/intake/${String(s._id)}`,
    secret: isAdmin ? decryptNullable(s.secretEnc) : undefined,
  }));

  return (
    <>
      <div className="section-head">
        <h2>Импорт лидов</h2>
      </div>

      <div className="grid-2b">
        <CsvImport sources={list} />
        <ApiIntakeCard sources={list} isAdmin={isAdmin} />
      </div>

      <div className="card table-card" style={{ marginTop: 16 }}>
        <div className="tbl-toolbar">
          <b style={{ fontSize: 14 }}>Источники</b>
          <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>{list.length} источников</span>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr>
                <th>Источник</th>
                <th>Тип</th>
                <th>Состояние</th>
                <th>Endpoint приёма</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.name}</b></td>
                  <td><span className="chip src">{SOURCE_TYPE_LABEL[s.type]}</span></td>
                  <td><span className={`badge ${s.isActive ? "b-dep" : "b-off"}`}>{s.isActive ? "Активен" : "Выключен"}</span></td>
                  <td className="mono muted" style={{ fontSize: 12 }}>/api/intake/{s.id.slice(-8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
