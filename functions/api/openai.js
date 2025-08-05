// functions/api/openai.js

/**
 * Cloudflare Pages 函数，作为 GitHub Models API 的 OpenAI 兼容代理
 * 更新版本：增加了对 GET 请求的友好响应，以通过客户端的可用性检测。
 */
export async function onRequest(context) {
    // context.request 就是从您的客户端应用传入的 HTTP 请求
    const request = context.request;

    // 1. 如果是 GET 请求，说明是客户端在做“健康检查”或“可用性检测”
    if (request.method === 'GET') {
        // 我们返回一个成功的响应，告诉客户端“代理服务在线”
        return new Response(JSON.stringify({
            status: "ok",
            message: "Proxy is active. Ready to receive POST requests for AI chat.",
        }), {
            status: 200, // 返回 200 OK 状态码
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 2. 如果是 POST 请求，则执行我们之前的代理逻辑
    if (request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Authorization header is missing' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
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

    // 3. 如果是其他方法 (如 PUT, DELETE 等)，则返回 405 错误
    return new Response('Method Not Allowed', {
        status: 405,
    });
}