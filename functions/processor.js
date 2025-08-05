// functions/processor.js

// --- 在这里配置您希望在 utools 中看到的模型 ---
// 您可以按需修改或添加列表中的模型
const MOCK_MODELS = [
    {
        id: 'openai/gpt-4o', // 这是模型ID
        object: 'model',
        created: Math.floor(Date.now() / 1000), // 使用当前时间戳
        owned_by: 'github',
    },
    {
        id: 'openai/gpt-4.1', // 您可以按此格式添加更多模型
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'github',
    },
    {
        id: 'openai/gpt-3.5-turbo', // 也可以添加一些常见的模型ID
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'github',
    }
];
// ---------------------------------------------

/**
 * 主处理函数，现在它是一个路由器
 * 它会根据访问的URL路径，执行不同的功能
 * @param {object} context - Cloudflare Pages 的上下文对象
 */
export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    // 根据访问路径，决定执行哪个操作
    switch (path) {
        // 如果客户端是来获取可用模型列表的
        case '/v1/models':
            return handleModelsRequest();

        // 如果客户端是来请求AI聊天的
        case '/v1/chat/completions':
            return handleChatCompletionsRequest(request);

        // 为了向后兼容，如果仍然访问旧的路径，也视为聊天请求
        case '/api/openai':
            return handleChatCompletionsRequest(request);

        // 如果访问的是其他未知路径，返回 404 Not Found
        default:
            return new Response('Not Found', { status: 404 });
    }
}

/**
 * 处理模型列表请求 (/v1/models)
 * 直接返回我们伪造的、看起来像真的一样的模型列表
 * 这是为了“骗”过挑剔的客户端的可用性检测
 */
function handleModelsRequest() {
    const responseData = {
        object: 'list',
        data: MOCK_MODELS,
    };
    return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * 处理聊天请求 (/v1/chat/completions 或 /api/openai)
 * 这部分是真正的代理逻辑，负责将请求转发给 GitHub Models API
 * @param {Request} request - 从客户端传来的原始请求
 */
async function handleChatCompletionsRequest(request) {
    // 只允许 POST 方法
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // 验证 Authorization 头是否存在
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization header is missing' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 准备转发到 GitHub 的请求头，添加必需的字段
    const githubHeaders = new Headers({
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    });

    // 异步发起请求到真正的 GitHub Models API，并直接返回其响应
    return fetch('https://models.github.ai/inference/chat/completions', {
        method: 'POST',
        headers: githubHeaders,
        body: request.body,
    });
}