const Hapi = require("@hapi/hapi");
const config = require("@crypto-signals/config");
const { createWriteStream } = require("pino-http-send");

const init = async () => {
  const server = Hapi.server({
    port: config.port,
    host: config.host,
    routes: {
      cors: { additionalExposedHeaders: ["x-total-count"] }
    }
  });
  const stream = createWriteStream({
    url: `${config.api_url}/logs`,
    method: "POST",
    log: true
  });
  server.validator(require("joi"));
  await server.register([
    {
      plugin: require("hapi-pino"),
      options: {
        prettyPrint: !["production", "staging"].includes(config.environment),
        // Redact Authorization headers, see https://getpino.io/#/docs/redaction
        redact: ["req.headers.authorization"],
        ignoreFunc: (options, request) => {
          const paths = [
            "/candles",
            "/markets",
            "/account",
            "/nes",
            "/signals",
            "/orders",
            "/logs",
            "/positions/open"
          ];

          if ((request.payload || {}).type === "update") {
            return true;
          }

          return paths.some(path => request.path.startsWith(path));
        },
        logPayload: true,
        logQueryParams: true,
        stream
      }
    },
    require("./src/auth"),
    {
      plugin: require("./db"),
      options: { db_uri: config.db_uri }
    },
    {
      plugin: require("./redis"),
      options: { redis_uri: config.redis_uri }
    },
    {
      plugin: require("./src/ws"),
      options: { enabled: config.websocket_server_enabled }
    },
    {
      plugin: require("./src/candle/routes"),
      routes: { prefix: "/candles" },
      options: { pairs: config.allowed_pairs }
    },
    {
      plugin: require("./src/signal/routes"),
      routes: { prefix: "/signals" },
      options: { pairs: config.allowed_pairs }
    },
    {
      plugin: require("./src/position/routes"),
      routes: { prefix: "/positions" },
      options: { pairs: config.allowed_pairs }
    },
    // allow localhost requests only
    {
      plugin: require("./src/telegram/routes"),
      routes: { prefix: "/telegram" },
      options: {
        pairs: config.allowed_pairs,
        auth: { access: { scope: ["telegram"] } }
      }
    },
    {
      plugin: require("./src/account/routes"),
      routes: { prefix: "/account" },
      options: { pairs: config.allowed_pairs }
    },
    {
      plugin: require("./src/order/routes"),
      routes: { prefix: "/order" }
    },
    {
      plugin: require("./src/market/routes"),
      routes: { prefix: "/markets" }
    },
    {
      plugin: require("./src/log/routes"),
      routes: { prefix: "/logs" }
    },
    {
      plugin: require("./src/report/routes"),
      routes: { prefix: "/reports" }
    },
    { plugin: require("./src/ws/routes"), routes: { prefix: "/ws" } }
  ]);

  server.route({
    method: "GET",
    path: "/health",
    options: { auth: false },
    handler: async (request, h) => {
      let ok = true;

      try {
        const mongodbIsConnected = request.server.plugins.mongoose.connection
          .getClient()
          .isConnected();
        const redisIsConnected = request.server.plugins.redis.client.ping();
        const pubsubIsConnected = request.server.plugins.redis.pubSub.ping();
        if (!mongodbIsConnected || !redisIsConnected || !pubsubIsConnected) {
          ok = false;
        }
      } catch (error) {
        console.error(error);
        ok = false;
      }
      return h.response({ ok });
    }
  });

  await server.start();
  console.log(`Server running on port ${config.port}`);
};

init();
