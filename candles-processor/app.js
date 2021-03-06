const Hapi = require("@hapi/hapi");
const Boom = require("@hapi/boom");
const config = require("@crypto-signals/config");
const { getTimeDiff } = require("@crypto-signals/utils");
const { getIndicatorsValues, getOHLCValues } = require("./utils");

const init = async () => {
  const server = Hapi.server({
    port: config.port,
    host: config.host
  });
  await server.register([
    {
      plugin: require("./db"),
      options: { db_uri: config.db_uri }
    }
  ]);

  server.route({
    path: "/",
    method: "POST",
    handler: async (request, h) => {
      try {
        const CandleModel =
          request.server.plugins.mongoose.connection.model("Candle");
        const { symbol } = request.query;
        const candlesToUpdate = request.payload;

        const toUpdate = await CandleModel.find({
          id: { $in: candlesToUpdate }
        })
          .hint("id_1")
          .sort({ open_time: 1 })
          .lean();

        for (const candle of toUpdate) {
          const candles = await CandleModel.find({
            $and: [
              { symbol },
              {
                open_time: {
                  $gte: candle.open_time - getTimeDiff(155, config.interval)
                }
              },
              { open_time: { $lte: candle.open_time } }
            ]
          })
            .hint("symbol_1_open_time_1")
            .sort({ open_time: 1 })
            .lean();

          if (candles.length >= 150) {
            const ohlc = getOHLCValues(candles);
            const indicators = await getIndicatorsValues(ohlc, candles);

            await CandleModel.findByIdAndUpdate(candle._id, {
              $set: indicators
            });
          }
        }
        return h.response();
      } catch (error) {
        console.error(error);
        return Boom.internal();
      }
    }
  });

  await server.start();
  console.log(`Server running on port ${config.port}`);
};

init();
