export type Config = {
  kvUrl: string;
  kvToken: string;
  turnstileSiteKey: string;
  turnstileSecretKey: string;
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(): Config {
  return {
    kvUrl: required("KV_REST_API_URL"),
    kvToken: required("KV_REST_API_TOKEN"),
    turnstileSiteKey: required("TURNSTILE_SITE_KEY"),
    turnstileSecretKey: required("TURNSTILE_SECRET_KEY"),
  };
}
