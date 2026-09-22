import {
    getErrorMessage,
    JWT_HEADER_NAME,
    type ApiError,
} from '@lightdash/common';
import { resolveEmbedScope } from './embedInstance';

export const resolveRequestUrl = (url: string, embedInstanceId?: string) => {
    const { instanceUrl } = resolveEmbedScope(embedInstanceId);

    return new URL(url, instanceUrl ?? window.location.origin).toString();
};

// To be reused across all hooks that need to fetch SQL query results
export const getResultsFromStream = async <T>(
    url: string | undefined,
    embedInstanceId?: string,
) => {
    try {
        if (!url) {
            throw new Error('No URL provided');
        }
        // Embed iframes need the JWT on every fetch — there is no session
        // cookie. Mirror lightdashApi's finalizeHeaders so streamed result
        // reads aren't rejected with 401.
        const { embed } = resolveEmbedScope(embedInstanceId);
        const headers: Record<string, string> = {
            Accept: 'application/json',
        };
        if (embed?.token) {
            headers[JWT_HEADER_NAME] = embed.token;
        }
        const response = await fetch(resolveRequestUrl(url, embedInstanceId), {
            method: 'GET',
            headers,
        });
        const rb = response.body;
        const reader = rb?.getReader();

        const stream = new ReadableStream({
            start(controller) {
                function push() {
                    void reader?.read().then(({ done, value }) => {
                        if (done) {
                            // Close the stream
                            controller.close();
                            return;
                        }
                        // Enqueue the next data chunk into our target stream
                        controller.enqueue(value);

                        push();
                    });
                }

                push();
            },
        });

        const responseStream = new Response(stream, {
            headers: { 'Content-Type': 'application/json' },
        });
        const result = await responseStream.text();

        // Split the JSON strings by newline
        const jsonStrings = result
            .trim()
            .split('\n')
            .filter((s) => s !== '');
        const jsonObjects: T[] = jsonStrings
            .map((jsonString) => {
                try {
                    if (!jsonString) {
                        return null;
                    }
                    return JSON.parse(jsonString);
                } catch (e) {
                    throw new Error('Error parsing JSON');
                }
            })
            .filter((obj) => obj !== null);

        return jsonObjects;
    } catch (e) {
        // convert error to ApiError
        throw <ApiError>{
            status: 'error',
            error: {
                name: 'Error',
                statusCode: 500,
                message: getErrorMessage(e),
                data: {},
            },
        };
    }
};
