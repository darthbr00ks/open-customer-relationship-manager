/**
 * Reading a cookie off a plain `Request`.
 *
 * `next/headers`' `cookies()` is only available inside the App Router's request
 * scope; route handlers here take a bare `Request` (which is what makes them
 * callable straight from the test suite), and the proxy runs before that scope
 * exists. One parser serves both.
 */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}
