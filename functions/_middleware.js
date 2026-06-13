export async function onRequest(context) {
    // Execute the next middleware or route handler
    const response = await context.next();

    // Verify that the response is in HTML format before modifying it
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('text/html')) {
        return response;
    }

    // Verify that the KEY_VALUE binding exists in the context
    const KV = context.env.KEY_VALUE;
    if (!KV) {
        console.error('KEY_VALUE binding not found in context');
        return response;
    }

    try {
        let origins = await KV.get('origins');
        if (!origins) {
            // Get the path to the config.json file
            const url = new URL(context.request.url);
            url.pathname = '/assets/config.json';

            try {
                // Perform an internal fetch using the ASSETS special binding
                const configResponse = await context.env.ASSETS.fetch(url);
                if (!configResponse.ok) {
                    console.error(`Failed to fetch config.json: ${configResponse.statusText}`);
                    return response;
                }

                const configData = await configResponse.json();
                const uniqueOrigins = new Set();
                configData.webpages.forEach(webpage => {
                    webpage.urls.forEach(url => uniqueOrigins.add(new URL(url).origin));
                });

                origins = Array.from(uniqueOrigins).join(' ');
                await KV.put('origins', origins);
                console.log('Origins cached successfully');

            } catch (error) {
                console.error('Error fetching config.json:', error);
                return response;
            }
        }

        const cspHeader = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' https://www.w3schools.com",
            "img-src 'self' data:",
            "object-src 'none'",
            `frame-src 'self' ${origins}`,
            `connect-src 'self' ${origins}`
        ].join('; ');
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Content-Security-Policy', cspHeader);
        return newResponse;

    } catch (error) {
        console.error('Error accessing KEY_VALUE store:', error);
        return response;
    }
}
