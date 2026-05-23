const ADMIN_KEY = "bees-nippo:admin";

export function isAdmin(): boolean {
  return localStorage.getItem(ADMIN_KEY) === "1";
}

export function setAdmin(on: boolean): void {
  if (on) localStorage.setItem(ADMIN_KEY, "1");
  else localStorage.removeItem(ADMIN_KEY);
}

export function consumeAdminQuery(): boolean {
  const url = new URL(window.location.href);
  const param = url.searchParams.get("admin");
  if (param === "on") {
    setAdmin(true);
    url.searchParams.delete("admin");
    window.history.replaceState({}, "", url.toString());
    return true;
  }
  if (param === "off") {
    setAdmin(false);
    url.searchParams.delete("admin");
    window.history.replaceState({}, "", url.toString());
    return false;
  }
  return isAdmin();
}
