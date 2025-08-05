// functions/[[path]].js

/**
 * 主处理函数，作为智能路由器
 * 终极版本：智能修正路径，使其同时兼容 utools 和标准 OpenAI 客户端
 * @param {object} context - Cloudflare Pages 的上下文对象
 */
export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    let path = url.pathname; // 将 path 定义为可修改的变量

    // --- 智能路径修正 ---
    // 如果路径以 /v1/v1/ 开头，说明是标准客户端错误地使用了 /v1 地址
    // 我们自动修正它，去掉多余的 /v1
    if (path.startsWith('/v1/v1/')) {
        path = path.substring(3); // 例如将 /v1/v1/models 修正为 /v1/models
    }
    // --------------------

    // 根据修正后的路径，决定执行哪个操作
    switch (path) {
        case '/v1':
            if (request.method === 'GET' || request.method === 'HEAD') {
                return new Response(JSON.stringify({ status: "ok", message: "v1 endpoint is active and ready for utools." }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            break;

        case '/v1/models':
            return handleModelsRequest(request, context);

        case '/':
        case '/v1/chat/completions':
        case '/api/openai':
            return handleChatCompletionsRequest(request);

        default:
            return new Response('Not Found', { status: 404 });
    }
}

/**
 * 处理模型列表请求 (/v1/models)，逻辑不变
 */
async function handleModelsRequest(request, context) {
    const cache = caches.default;
    let response = await cache.match(request);
    if (response) { return response; }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) { return new Response(JSON.stringify({ error: 'Authorization header is missing' }), { status: 401 }); }

    const githubCatalogHeaders = new Headers({
        'Authorization': authHeader, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
    });

    const catalogResponse = await fetch('https://models.github.ai/catalog/models', { headers: githubCatalogHeaders });

    if (!catalogResponse.ok) { return new Response('Failed to fetch model catalog from GitHub', { status: catalogResponse.status }); }

    const githubModels = await catalogResponse.json();
    const openAIFormattedModels = githubModels.map(model => ({
        id: model.id, object: 'model',
        created: Math.floor(new Date(model.version === "1" ? Date.now() : model.version).getTime() / 1000) || Math.floor(Date.now() / 1000),
        owned_by: model.publisher || 'unknown',
    }));

    const responseData = { object: 'list', data: openAIFormattedModels };
    response = new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    });

    context.waitUntil(cache.put(request, response.clone()));
    return response;
}

/**
 * 处理聊天请求，逻辑不变
 */
async function handleChatCompletionsRequest(request) {
    if (request.method !== 'POST') { return new Response('Method Not Allowed', { status: 405 }); }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) { return new Response(JSON.stringify({ error: 'Authorization header is missing' }), { status: 401 }); }

    const githubHeaders = new Headers({
        'Authorization': authHeader, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
    });

    return fetch('https://models.github.ai/inference/chat/completions', {
        method: 'POST',
        headers: githubHeaders,
        body: request.body,
    });
}