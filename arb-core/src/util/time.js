// Окно по времени до начала матча. Чистая функция — nowMs передаётся снаружи
// (детерминируется в тестах).
//
// Зачем: value/вилки надо ловить на линиях близко к матчу. Ранние futures-линии
// (за недели до игры) сырые и сильно двигаются — по ним не ставят. Окно отсекает
// их, а также уже начавшиеся/прошедшие события.

// Матч в окне [nowMs, nowMs + maxHours·ч]?
//   commenceIso — ISO-время начала (нет времени → не отсекаем);
//   maxHours <= 0 → без верхней границы (только отсечь начавшиеся).
export function withinWindow(commenceIso, nowMs, maxHours) {
  if (!commenceIso) return true;
  const t = Date.parse(commenceIso);
  if (Number.isNaN(t)) return true;
  if (t < nowMs) return false; // уже начался/прошёл
  if (maxHours && maxHours > 0 && t > nowMs + maxHours * 3600 * 1000) return false;
  return true;
}
