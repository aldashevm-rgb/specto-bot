// Тонкий HTTP-хелпер: fetch с ретраями временных сбоев (429/5xx/сеть) и таймаутом.
// Общий для всех источников данных.

export async function withRetry(fn, { retries = 2, baseMs = 600, label = "http", retryOn } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const canRetry = retryOn ? retryOn(err) : true;
      if (attempt === retries || !canRetry) break;
      const wait = baseMs * Math.pow(2, attempt);
      console.warn(`[${label}] попытка ${attempt + 1} не удалась (${err.message}), повтор через ${wait}мс`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// GET JSON с таймоутом и ретраями. Кидает ошибку с .status при не-2xx.
export async function getJson(url, { headers = {}, timeoutMs = 15000, retries = 2, label = "http" } = {}) {
  return withRetry(
    async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { headers, signal: ctrl.signal });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const err = new Error(`${label} ${res.status}: ${body.slice(0, 200)}`);
          err.status = res.status;
          throw err;
        }
        return await res.json();
      } finally {
        clearTimeout(t);
      }
    },
    {
      retries,
      label,
      retryOn: (err) => err.name === "AbortError" || !err.status || err.status >= 500 || err.status === 429
    }
  );
}
