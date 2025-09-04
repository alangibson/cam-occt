export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Basic routing example
    switch (url.pathname) {
      case '/api/health':
        return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });

      case '/api/convert':
        if (request.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 });
        }
        
        try {
          const data = await request.json();
          // Add your CAM processing logic here
          return new Response(JSON.stringify({ 
            message: 'Conversion endpoint ready',
            input: data 
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

      default:
        return new Response('Not found', { status: 404 });
    }
  },
};