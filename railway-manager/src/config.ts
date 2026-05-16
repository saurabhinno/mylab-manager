import Conf from "conf";

const config = new Conf({ projectName: "railway-manager" });

export function getToken(): string | null {
  return (config.get("token") as string) || null;
}

export function setToken(token: string) {
  config.set("token", token);
}

export function clearToken() {
  config.delete("token");
}

export function getConfig() {
  return config;
}
