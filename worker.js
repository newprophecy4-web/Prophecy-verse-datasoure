/**
 * Prophecy Verse — Cloudflare Worker API Gateway
 *
 * Purpose:
 *   Website → Cloudflare Worker → authorized upstream API
 *
 * No database required.
 * No Render/VPS required for this gateway.
 *
 * IMPORTANT:
 * Use only with an upstream API/source that you are authorized
 * to access and display on your website.
 */

const CONFIG = {
  // Authorized upstream API.
  UPSTREAM: "https://api.aniflix.uno",

  // Cache API JSON responses at Cloudflare edge.
  CACHE_SECONDS: 30,

  // Maximum URL length accepted.
  MAX_URL_LENGTH: 4096,
};

const ALLOWED_EXACT_ROUTES = new Set([
  "/api/home",
  "/api/popular",
  "/api/recent",
  "/api/trending",
  "/api/top-rated",
  "/api/upcoming",
  "/api/schedule",
  "/api/random",
  "/api/season",
  "/api/search",
  "/api/watch",
]);

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Expose-Headers": "Content-Type, Cache-Control",
    "Vary": "Origin",
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders("*"),
      ...extra,
    },
  });
}

function errorResponse(message, status = 400, details = null) {
  return json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    status
  );
}

function isAllowedMethod(request) {
  return request.method === "GET" || request.method === "OPTIONS";
}

function isAllowedRoute(pathname) {
  if (ALLOWED_EXACT_ROUTES.has(pathname)) return true;

  // Dynamic anime routes.
  if (/^\/api\/anime\/[^/]+$/.test(pathname)) return true;

  if (/^\/api\/anime\/[^/]+\/episodes$/.test(pathname)) return true;

  if (/^\/api\/anime\/[^/]+\/servers\/[^/]+$/.test(pathname)) {
    return true;
  }

  // AniList dynamic routes.
  if (/^\/api\/anime\/anilist\/[^/]+$/.test(pathname)) return true;

  if (/^\/api\/anime\/anilist\/[^/]+\/episodes$/.test(pathname)) {
    return true;
  }

  if (/^\/api\/anime\/anilist\/[^/]+\/servers\/[^/]+$/.test(pathname)) {
    return true;
  }

  return false;
}

function sanitizeQuery(url) {
  const result = new URLSearchParams();

  for (const [key, value] of url.searchParams.entries()) {
    // Prevent unexpectedly huge query values.
    if (value.length > 1000) continue;

    result.append(key, value);
  }

  return result;
}

function buildUpstreamURL(requestURL) {
  const incoming = new URL(requestURL);

  const upstream = new URL(CONFIG.UPSTREAM);

  upstream.pathname = incoming.pathname;
  upstream.search = sanitizeQuery(incoming).toString();

  return upstream;
}

async function fetchUpstream(request, env) {
  const upstreamURL = buildUpstreamURL(request.url);

  const headers = new Headers();

  headers.set("Accept", "application/json");

  const userAgent =
    request.headers.get("User-Agent") || "Prophecy-Verse-Worker";

  headers.set("User-Agent", userAgent);

  /*
   * Do NOT forward arbitrary client headers.
   * This keeps the gateway predictable and avoids leaking
   * browser-specific headers upstream.
   */

  const upstreamResponse = await fetch(upstreamURL.toString(), {
    method: "GET",
    headers,
    redirect: "follow",
  });

  return upstreamResponse;
}

async function handleAPI(request, env, ctx) {
  const url = new URL(request.url);

  if (!isAllowedRoute(url.pathname)) {
    return errorResponse("API route not found", 404);
  }

  if (url.toString().length > CONFIG.MAX_URL_LENGTH) {
    return errorResponse("Request URL is too long", 414);
  }

  /*
   * Only cache metadata/API JSON.
   * We intentionally do not implement an open arbitrary URL proxy.
   */
  const cacheable =
    url.pathname !== "/api/watch" &&
    !url.pathname.includes("/servers/");

  if (cacheable) {
    const cache = caches.default;

    const cacheKey = new Request(
      new URL(request.url).toString(),
      request
    );

    const cached = await cache.match(cacheKey);

    if (cached) {
      const headers = new Headers(cached.headers);
      Object.assign(headers, corsHeaders("*"));

      return new Response(cached.body, {
        status: cached.status,
        headers,
      });
    }

    const upstreamResponse = await fetchUpstream(request, env);

    const contentType =
      upstreamResponse.headers.get("Content-Type") || "";

    const headers = new Headers(upstreamResponse.headers);

    Object.assign(headers, corsHeaders("*"));

    /*
     * Cache only successful JSON responses.
     */
    if (
      upstreamResponse.ok &&
      contentType.toLowerCase().includes("application/json")
    ) {
      headers.set(
        "Cache-Control",
        `public, max-age=${CONFIG.CACHE_SECONDS}`
      );

      const response = new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers,
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    });
  }

  /*
   * Watch endpoint:
   *
   * Website:
   * /api/watch?id=...&ep=1&server=pahe&source_type=sub
   *
   * Upstream:
   * same endpoint
   *
   * The upstream response contains:
   * data.sources[].proxy_url
   *
   * Your player can use that URL.
   */
  const upstreamResponse = await fetchUpstream(request, env);

  const headers = new Headers(upstreamResponse.headers);

  Object.assign(headers, corsHeaders("*"));

  headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });
}

async function handleHealth() {
  return json({
    success: true,
    service: "prophecy-verse-anime-api",
    status: "online",
    architecture: "Cloudflare Worker API Gateway",
    timestamp: new Date().toISOString(),
  });
}

async function handleOptions(request) {
  const origin = request.headers.get("Origin") || "*";

  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      "Access-Control-Max-Age": "86400",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (!isAllowedMethod(request)) {
        return errorResponse("Method not allowed", 405);
      }

      if (request.method === "OPTIONS") {
        return handleOptions(request);
      }

      const url = new URL(request.url);

      /*
       * Worker health endpoint.
       */
      if (url.pathname === "/health") {
        return handleHealth();
      }

      /*
       * API endpoints.
       */
      if (url.pathname.startsWith("/api/")) {
        return await handleAPI(request, env, ctx);
      }

      /*
       * Root endpoint.
       */
      if (url.pathname === "/") {
        return json({
          success: true,
          name: "Prophecy Verse Anime API",
          status: "online",
          endpoints: {
            health: "/health",
            search: "/api/search?q=naruto",
            anime: "/api/anime/{id}",
            episodes: "/api/anime/{id}/episodes",
            servers: "/api/anime/{id}/servers/{episode}",
            watch: "/api/watch?id={id}&ep={episode}&server=pahe",
          },
        });
      }

      return errorResponse("Not found", 404);
    } catch (error) {
      console.error("Worker error:", error);

      return errorResponse(
        "Upstream/API request failed",
        502,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  },
};
