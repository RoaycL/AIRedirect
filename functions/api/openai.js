// functions/api/openai.js

export async function onRequest(context) {
    const request = context.request;
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 1. 处理 OPTIONS 预检请求 (CORS)
    // 某些复杂的客户端在发送POST请求前会先发送一个OPTIONS请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    // 2. 处理 GET 或 HEAD 健康检查请求
    // HEAD 请求是 GET 请求的一种，但不需要响应体
    if (request.method === 'GET' || request.method === 'HEAD') {
        const responseBody = JSON.stringify({
            status: "ok",
            message: "Proxy is active. Ready to receive POST requests.",
        });
        return new Response(request.method === 'HEAD' ? null : responseBody, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 3. 处理核心的 POST 代理请求
    if (request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Authorization header is missing' }), {
                status: 401,
                headers: corsHeaders,
            });
        }

        const githubHeaders = new Headers({
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        });

        const githubResponse = await fetch('https://models.github.ai/inference/chat/completions', {
            method: 'POST',
            headers: githubHeaders,
            body: request.body,
        });

        // 创建一个新的响应以附加 CORS 头
        const newResponse = new Response(githubResponse.body, githubResponse);
        Object.keys(corsHeaders).forEach(key => {
            newResponse.headers.set(key, corsHeaders[key]);
        });

        return newResponse;
    }

    // 4. 其他所有方法都返回 405
    return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders,
    });
}