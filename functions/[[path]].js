// functions/[[path]].js

/**
 * 主处理函数，作为智能路由器
 * 最终版本：根据 utools 客服的反馈，增加了对 /v1 路径的健康检查响应
 * @param {object} context - Cloudflare Pages 的上下文对象
 */
export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    // 根据访问路径，决定执行哪个操作
    switch (path) {
        // 新增：处理对 /v1 根路径的健康检查
        case '/v1':
            if (request.method === 'GET' || request.method === 'HEAD') {
                return new Response(JSON.stringify({ status: "ok", message: "v1 endpoint is active and ready." }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            break; // 如果不是 GET/HEAD，则继续到 default

        // 处理模型列表请求
        case '/v1/models':
            return handleModelsRequest(request, context);

        // 处理聊天请求
        case '/':
        case '/v1/chat/completions':
        case '/api/openai':
            return handleChatCompletionsRequest(request);

        // 其他所有未知路径，都返回 404
        default:
            return new Response('Not Found', { status: 404 });
    }
}

/**
 * 处理模型列表请求 (/v1/models)，包含动态获取和缓存
 * @param {Request} request
 * @param {object} context
 */
async function handleModelsRequest(request, context) {
    const cache = caches.default;
    let response = await cache.match(request);
    if (response) { return response; }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization header is missing' }), { status: 401 });
    }

    const githubCatalogHeaders = new Headers({
        'Authorization': authHeader,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    });

    const catalogResponse = await fetch('https://models.github.ai/catalog/models', {
        headers: githubCatalogHeaders,
    });

    if (!catalogResponse.ok) {
        return new Response('Failed to fetch model catalog from GitHub', { status: catalogResponse.status });
    }

    const githubModels = await catalogResponse.json();
    const openAIFormattedModels = githubModels.map(model => ({
        id: model.id,
        object: 'model',
        created: Math.floor(new Date(model.version === "1" ? Date.now() : model.version).getTime() / 1000) || Math.floor(Date.now() / 1000),
        owned_by: model.publisher || 'unknown',
    }));

    const responseData = { object: 'list', data: openAIFormattedModels };
    response = new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
        },
    });

    context.waitUntil(cache.put(request, response.clone()));
    return response;
}

/**
 * 处理聊天请求
 * @param {Request} request
 */
async function handleChatCompletionsRequest(request) {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization header is missing' }), { status: 401 });
    }

    const githubHeaders = new Headers({
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    });

    return fetch('https://models.github.ai/inference/chat/completions', {
        method: 'POST',
        headers: githubHeaders,
        body: request.body,
    });
}