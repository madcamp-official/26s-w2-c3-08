import { createServer } from "node:http";
import { env } from "./config/env.js";
import { createApp } from "./http/app.js";
import { attachSocketServer } from "./socket/index.js";

const app = createApp();
const server = createServer(app);

attachSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`backend listening on http://localhost:${env.PORT}`);
});
