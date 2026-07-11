import {
    defineServer,
    defineRoom,
    monitor,
    playground,
    createRouter,
    createEndpoint,
} from "colyseus";

/**
 * Import your Room files
 */
import { MyRoom } from "./rooms/MyRoom.js";
import { QwenClient } from "./qwen/qwenClient.js";
import {
    isQwenClientError,
    isQwenConfigurationError
} from "./qwen/qwenErrors.js";
import type { Response } from "express";

const server = defineServer({
    /**
     * Define your room handlers:
     */
    rooms: {
        my_room: defineRoom(MyRoom)
    },

    /**
     * Experimental: Define API routes. Built-in integration with the "playground" and SDK.
     * 
     * Usage from SDK: 
     *   client.http.get("/api/hello").then((response) => {})
     * 
     */
    routes: createRouter({
        api_hello: createEndpoint("/api/hello", { method: "GET", }, async (ctx) => {
            return { message: "Hello World" }
        })
    }),

    /**
     * Bind your custom express routes here:
     * Read more: https://expressjs.com/en/starter/basic-routing.html
     */
    express: (app) => {
        app.get("/hi", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        app.get("/internal/qwen/health", async (_req, res) => {
            try {
                const qwen = new QwenClient();
                res.status(200).json(await qwen.health());
            } catch (error) {
                sendQwenRouteError(res, error);
            }
        });

        app.get("/internal/qwen/model", async (_req, res) => {
            try {
                const qwen = new QwenClient();
                res.status(200).json(await qwen.model());
            } catch (error) {
                sendQwenRouteError(res, error);
            }
        });

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitoring/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/monitor", monitor());

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }
    }

});

export default server;

function sendQwenRouteError(res: Response, error: unknown) {
    if (isQwenClientError(error)) {
        res.status(error.status === 0 ? 502 : error.status).json({
            ok: false,
            error: {
                code: error.code,
                message: error.message
            },
            retry_policy: error.retryPolicy
        });
        return;
    }

    if (isQwenConfigurationError(error)) {
        res.status(500).json({
            ok: false,
            error: {
                code: error.code,
                message: error.message
            }
        });
        return;
    }

    res.status(500).json({
        ok: false,
        error: {
            code: "QWEN_INTERNAL_ROUTE_ERROR",
            message: error instanceof Error ? error.message : "Unknown Qwen route error"
        }
    });
}
