export { default } from "next-auth/middleware";

/**
 * Защищаем все страницы, кроме /login и служебных путей. API исключён:
 * вебхуки (intake/status) проверяются по HMAC, а админ-эндпоинты — по сессии
 * внутри самих обработчиков.
 */
export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
