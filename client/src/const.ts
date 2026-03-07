export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const getRedirectUri = () => {
  const configuredRedirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI?.trim();
  if (configuredRedirectUri) return configuredRedirectUri;

  const protocol = window.location.protocol;
  if (protocol === "http:" || protocol === "https:") {
    return `${window.location.origin}/api/oauth/callback`;
  }

  // Electron production usually runs on file://, so origin-based callback is invalid there.
  return "http://127.0.0.1:3000/api/oauth/callback";
};

export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = getRedirectUri();
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
