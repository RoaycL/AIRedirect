// functions/[[path]].js

/**
 * 主处理函数，作为智能路由器
 * @param {object} context - Cloudflare Pages 的上下文对象，包含 request, env, waitUntil 等
 */
export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    // 根据访问路径，决定执行哪个操作
    switch (path) {
        case '/v1/models':
            return handleModelsRequest(request, context);

        case '/v1/chat/completions':
        case '/api/openai': // 兼容旧路径
            return handleChatCompletionsRequest(request);

        default:
            return new Response('Not Found', { status: 404 });
    }
}

/**
 * 处理模型列表请求 (/v1/models)
 * 新增了动态获取和缓存逻辑
 * @param {Request} request - 从客户端传来的原始请求
 * @param {object} context - Cloudflare Pages 上下文
 */
async function handleModelsRequest(request, context) {
    const cache = caches.default; // 获取 Cloudflare 的默认缓存 API
    let response = await cache.match(request); // 尝试从缓存中匹配请求

    if (response) {
        console.log("Cache HIT for /v1/models");
        return response; // 如果命中缓存，直接返回缓存的响应
    }

    console.log("Cache MISS for /v1/models. Fetching from origin...");

    // --- 如果未命中缓存，则执行实时获取 ---

    // 1. 从客户端请求中提取 Authorization 头，用于向 GitHub API 进行身份验证
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization header is missing' }), { status: 401 });
    }

    // 2. 准备请求 GitHub 官方模型目录所需的头
    const githubCatalogHeaders = new Headers({
        'Authorization': authHeader,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    });

    // 3. 请求真正的 GitHub 模型目录 API
    const catalogResponse = await fetch('https://models.github.ai/catalog/models', {
        headers: githubCatalogHeaders,
    });

    if (!catalogResponse.ok) {
        return new Response('Failed to fetch model catalog from GitHub', { status: catalogResponse.status });
    }

    const githubModels = await catalogResponse.json();

    // 4. 实时将 GitHub 格式的列表转换为 OpenAI 格式
    const openAIFormattedModels = githubModels.map(model => ({
        id: model.id,
        object: 'model',
        created: Math.floor(new Date(model.version === "1" ? Date.now() : model.version).getTime() / 1000) || Math.floor(Date.now() / 1000),
        owned_by: model.publisher || 'unknown',
    }));

    const responseData = {
        object: 'list',
        data: openAIFormattedModels,
    };

    // 5. 创建新的响应，并设置缓存策略（缓存1小时）
    response = new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600', // 缓存1小时
        },
    });

    // 6. 将新响应异步存入缓存，不会阻塞对用户的返回
    context.waitUntil(cache.put(request, response.clone()));

    return response;
}

/**
 * 处理聊天请求 (POST /v1/chat/completions)
 * 这部分逻辑保持不变
 * @param {Request} request - 从客户端传来的原始请求
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