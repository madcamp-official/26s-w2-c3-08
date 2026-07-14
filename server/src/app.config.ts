import {
    defineServer,
    defineRoom,
    monitor,
    playground,
} from "colyseus";

/**
 * Import your Room files
 */
import { MyRoom } from "./rooms/MyRoom.js";
import { registerV2ApiRoutes } from "./routes/v2Api.js";

export function createAppConfig() {
    return defineServer({
        /**
         * Define your room handlers:
         */
        rooms: {
            my_room: defineRoom(MyRoom)
        },

        /**
         * Bind your custom express routes here:
         * Read more: https://expressjs.com/en/starter/basic-routing.html
         */
        express: (app) => {
            registerV2ApiRoutes(app);

            app.get("/hi", (req, res) => {
                res.send("It's time to kick ass and chew bubblegum!");
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
}

const server = createAppConfig();

export default server;
