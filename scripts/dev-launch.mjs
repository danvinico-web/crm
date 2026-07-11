// Лаунчер dev-сервера для превью-харнесса: он стартует из корня воркспейса,
// поэтому сначала переходим в каталог проекта (нужно для Tailwind content-глобов
// и загрузки .env.local), затем запускаем Next CLI в режиме dev.
// Для обычной разработки используйте `npm run dev`.
import { chdir } from "node:process";

const PROJECT = "/path/to/leadhub-crm";
chdir(PROJECT);
process.argv = [process.argv[0], "next", "dev"];
await import(PROJECT + "/node_modules/next/dist/bin/next");
