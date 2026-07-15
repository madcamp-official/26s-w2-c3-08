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
import express from "express";
import { MyRoom } from "./rooms/MyRoom.js";
import { BaseworldRoom } from "./rooms/baseworld/BaseworldRoom.js";
import { RaceRoom } from "./rooms/race/RaceRoom.js";
import { aiWorkerRouter } from "./worker-api/routes.js";
import { sessionRouter } from "./api/session.js";
import { STORAGE_DIR, STORAGE_URL_PREFIX, SOURCES_DIR, SOURCES_URL_PREFIX } from "./asset/storage.js";

const server = defineServer({
    /**
     * Define your room handlers:
     */
    rooms: {
        my_room: defineRoom(MyRoom),
        baseworld: defineRoom(BaseworldRoom),
        race: defineRoom(RaceRoom)
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

        /**
         * 에셋 생성 파이프라인 API (제출 큐 + 5080 워커 pull).
         * routes: /api/asset/submit, /api/ai/jobs/next, /api/ai/jobs/:id/result|fail
         */
        app.use(aiWorkerRouter());

        // 세션 API (로그인·토큰 검증)
        app.use(sessionRouter());

        // 생성된 스프라이트 시트 정적 서빙 (sheetUrl = STORAGE_URL_PREFIX/{id}.png).
        app.use(STORAGE_URL_PREFIX, express.static(STORAGE_DIR));
        // 업로드 소스(원본·정규화본) 정적 서빙 — 워커가 sourceImageUrl로 내려받는 경로.
        app.use(SOURCES_URL_PREFIX, express.static(SOURCES_DIR));

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