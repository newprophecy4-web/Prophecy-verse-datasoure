const UPSTREAM = "https://api.aniflix.uno";

const ALLOWED_ROUTES = new Set([
  "/api/search",
  "/api/home",
  "/api/popular",
  "/api/recent",
  "/api/trending",
  "/api/top-rated",
  "/api/upcoming",
  "/api/schedule",
  "/api/random",
  "/api/season",
  "/api/watch",
]);

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...cors(),
    },
  });
}

function isAllowedRoute(path) {
  if (ALLOWED_ROUTES.has(path)) return true;

  if (/^\/api\/anime\/[^/]+$/.test(path)) return true;
  if (/^\/api\/anime\/[^/]+\/episodes$/.test(path)) return true;
  if (/^\/api\/anime\/[^/]+\/servers\/[^/]+$/.test(path)) return true;

  return false;
}

function buildUpstreamURL(request) {
  const incoming = new URL(request.url);
  const upstream = new URL(UPSTREAM);

  upstream.pathname = incoming.pathname;

  for (const [key, value] of incoming.searchParams) {
    if (value.length <= 1000) {
      upstream.searchParams.append(key, value);
    }
  }

  return upstream;
}

export default {
  async fetch(request) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: cors(),
        });
      }

      if (request.method !== "GET") {
        return json(
          {
            success: false,
            error: "Method not allowed",
          },
          405
        );
      }

      const url = new URL(request.url);

      if (url.pathname === "/") {
        return json({
          success: true,
          service: "Prophecy Verse Anime API",
          status: "online",
        });
      }

      if (url.pathname === "/health") {
        return json({
          success: true,
          status: "online",
          timestamp: new Date().toISOString(),
        });
      }

      if (!url.pathname.startsWith("/api/")) {
        return json(
          {
            success: false,
            error: "Not found",
          },
          404
        );
      }

      if (!isAllowedRoute(url.pathname)) {
        return json(
          {
            success: false,
            error: "API route not supported",
          },
          404
        );
      }

      const upstreamURL = buildUpstreamURL(request);

      const response = await fetch(upstreamURL.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        redirect: "follow",
      });

      const headers = new Headers(response.headers);

      headers.set(
        "Access-Control-Allow-Origin",
        "*"
      );

      headers.set(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
      );

      headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Accept"
      );

      return new Response(response.body, {
        status: response.status,
        headers,
      });

    } catch (error) {
      return json(
        {
          success: false,
          error: "Upstream request failed",
          message:
            error instanceof Error
              ? error.message
              : "Unknown error",
        },
        502
      );
    }
  },
};
