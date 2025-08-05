// functions/api/openai.js

// Cloudflare Pages Functions 的代码格式更简洁
export async function onRequest(context) {
    // context.request 就是传入的 HTTP 请求
    const request = context.request;

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

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

    // 直接将请求转发到 GitHub Models API
    return fetch('https://models.github.ai/inference/chat/completions', {
        method: 'POST',
        headers: githubHeaders,
        body: request.body,
    });
}