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
import { TestLineRoom } from "./rooms/testline/TestLineRoom.js";
import { aiWorkerRouter } from "./worker-api/routes.js";
import { sessionRouter } from "./api/session.js";
import { linesRouter } from "./api/lines.js";
import { roomsRouter } from "./api/rooms.js";
import { assetsRouter } from "./api/assets.js";
import { STORAGE_DIR, STORAGE_URL_PREFIX, SOURCES_DIR, SOURCES_URL_PREFIX } from "./asset/storage.js";

const server = defineServer({
    /**
     * Define your room handlers:
     */
    rooms: {
        my_room: defineRoom(MyRoom),
        baseworld: defineRoom(BaseworldRoom),
        race: defineRoom(RaceRoom),
        testline: defineRoom(TestLineRoom)
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
        // CORS — 클라(sunboy7594...)와 API(sunboy7594-game...)가 서로 다른 origin이라 필요.
        // ⚠️ 배포 환경(Cloudflare Tunnel)에서는 이 미들웨어 도달 전에 Cloudflare가 OPTIONS
        // 프리플라이트를 자체 응답으로 가로채고, 그 기본 Allow-Headers엔 커스텀 헤더가 없다
        // (Authorization만 있음) — 그래서 인증은 Authorization: Bearer로 통일함(auth.ts).
        // 이 미들웨어는 로컬 개발(직접 Express 도달) 대비 유지. 쿠키 인증이 아니라 헤더 토큰
        // 인증이라 Allow-Credentials 불필요 — origin 그대로 반사해도 자격증명 유출 위험 없음.
        app.use((req, res, next) => {
            const origin = req.headers.origin;
            if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-token");
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
            if (req.method === "OPTIONS") { res.sendStatus(204); return; }
            next();
        });

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

        // 라인 저장/조회 API (에디터 저장·재사용 브라우징)
        app.use(linesRouter());

        // 로비 방 목록 API
        app.use(roomsRouter());

        // 에셋 스프라이트 매니페스트 조회 (클라 sprites 모듈이 항상 이 형태로 로드)
        app.use(assetsRouter());

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