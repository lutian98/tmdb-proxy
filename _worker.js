const apiCache = new Map();
const apiCacheMaxAge = 10 * 60 * 1000; // 10 minutes
const maxApiCacheSize = 1000;
const imageCacheName = 'tmdb-images';
const imageCacheMaxAge = 24 * 60 * 60; // 24 hours

function cleanExpiredApiCache() {
    const now = Date.now();
    for (const [key, value] of apiCache) {
        if (now - value.timestamp > apiCacheMaxAge) {
            apiCache.delete(key);
        }
    }
}

function checkApiCacheSize() {
    if (apiCache.size > maxApiCacheSize) {
        let oldestKey = null;
        let oldestTimestamp = Infinity;
        for (const [key, value] of apiCache) {
            if (value.timestamp < oldestTimestamp) {
                oldestTimestamp = value.timestamp;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            apiCache.delete(oldestKey);
        }
    }
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.startsWith('/t/p/')) { // Image URL pattern
        return handleImageRequest(request, url);
    } else { // Assume it's a TMDB API request
        return handleApiRequest(request, url, pathname);
    }
}

async function handleApiRequest(request, url, pathname) {
    cleanExpiredApiCache();
    checkApiCacheSize();

    const apiKey = url.searchParams.get('api_key');

    if (!apiKey && request.headers.get('Accept')?.includes('text/html')) {
        return Response.redirect('https://developer.themoviedb.org/docs', 302);
    }

    if (!apiKey) {
        return new Response('Missing api_key parameter', { status: 400 });
    }

    url.searchParams.delete('api_key');
    let params = url.searchParams.toString();

    // 检查是否已存在 language 参数，如果没有，则添加 language=zh-CN
    if (!url.searchParams.has('language')) {
        params = params ? `${params}&language=zh-CN` : 'language=zh-CN';
    }

    const cacheKey = `${pathname}?${params}`;

    if (apiCache.has(cacheKey)) {
        const cachedResponse = apiCache.get(cacheKey);
        if (Date.now() - cachedResponse.timestamp < apiCacheMaxAge) {
            return new Response(cachedResponse.data, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': `max-age=${apiCacheMaxAge / 1000}`,
                    'Content-Type': 'application/json;charset=utf-8',
                },
            });
        }
    }

    const tmdbUrl = `https://api.themoviedb.org${pathname}?${params}${params ? '&' : ''}api_key=${apiKey}`;

    try {
        const tmdbResponse = await fetch(tmdbUrl, {
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!tmdbResponse.ok) {
            throw new Error(`TMDB API error: ${tmdbResponse.status}`);
        }

        const data = await tmdbResponse.json();

        const response = new Response(JSON.stringify(data), {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': `max-age=${apiCacheMaxAge / 1000}`,
                'Content-Type': 'application/json;charset=utf-8',
            },
        });

        apiCache.set(cacheKey, {
            data: JSON.stringify(data),
            timestamp: Date.now(),
        });

        return response;
    } catch (error) {
        return new Response(error.message, { status: 500 });
    }
}

async function handleImageRequest(request, url) {
  const cache = caches.default;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const cacheKey = new Request(url.toString(), request);
  let response = await cache.match(cacheKey);

  if (!response) {
    console.log("Cache miss for:", cacheKey.url);
    const imageUrl = `https://image.tmdb.org${url.pathname}${url.search}`;

    try {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.delete('Referer');
      requestHeaders.delete('Host');

      response = await fetch(imageUrl, {
        headers: requestHeaders,
      });

      if (!response.ok) {
        console.error("Error fetching image from TMDB:", response.status, response.statusText);
        let errorBody = '';
        try {
          errorBody = await response.text();
          if (errorBody.includes('<h1>Image size not supported</h1>'))
          {
            errorBody = 'Image size not supported';
          }

        } catch (e) {
          errorBody = 'Failed to read error body';
        }
        console.error("TMDB error response body:", errorBody);
        return new Response(`Error fetching image: ${response.status} ${response.statusText} - ${errorBody}`, { status: response.status });
      }

      const clonedResponse = response.clone();
      const responseHeaders = new Headers(clonedResponse.headers);
      responseHeaders.set('Cache-Control', `public, max-age=${imageCacheMaxAge}`);
      responseHeaders.set('X-Worker-Cache', 'MISS');
      const cachedResponse = new Response(clonedResponse.body, {
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers: responseHeaders,
      });

      // 直接 await 缓存写入操作
      await caches.default.put(cacheKey, cachedResponse);

    } catch (error) {
      console.error("Error fetching image:", error);
      let errorMessage = "An error occurred while fetching the image";
      if (error instanceof TypeError) {
        errorMessage += ` (TypeError: ${error.message})`;
      } else if (error instanceof Error) {
        errorMessage += ` (Error: ${error.message})`;
      }
      return new Response(errorMessage, { status: 500 });
    }
  } else {
    console.log("Cache hit for:", cacheKey.url);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Worker-Cache', 'HIT');
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  }

  return response;
}
