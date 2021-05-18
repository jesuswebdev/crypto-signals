const Boom = require("@hapi/boom");
const {
  signals_performance_microservice,
  positions_processor_microservice,
  signals_processor_microservice,
  candles_processor_microservice
} = require("../../utils/axios");
const { orderAlphabetically, milliseconds } = require("@crypto-signals/utils");
const { positions_interval, signals_interval } = require("../../config");

exports.create = async function (request, h) {
  try {
    const Candle = request.server.plugins.mongoose.connection.model("Candle");
    const symbol = request.query.symbol;

    const candles = Array.isArray(request.payload)
      ? request.payload
      : [request.payload];

    const existing_candles = await Candle.find({
      id: { $in: candles.map(s => s.id) }
    });

    const [to_update, to_create] = candles
      .map(({ _id: _, ...candle }) => candle)
      .reduce(
        (acc, candle) => {
          const found = existing_candles.find(c => c.id === candle.id);
          return [
            acc[0].concat(found ? candle : []),
            acc[1].concat(found ? [] : candle)
          ];
        },
        [[], []]
      );

    console.log(
      `${symbol} | Candles: ${candles.length} | to create: ${to_create.length} | to update: ${to_update.length}`
    );

    if (to_create.length) {
      await Candle.insertMany(to_create);
    }
    if (to_update.length) {
      const updates = to_update.map(c => ({
        updateOne: {
          filter: { id: c.id },
          update: { $set: c }
        }
      }));
      await Candle.bulkWrite(updates, { ordered: false });
    }

    return h.response();
  } catch (error) {
    console.error(error);
    return Boom.internal();
  }
};
exports.find = async function (request, h) {};
exports.getSymbolCandles = async function (request, h) {
  try {
    const Candle = request.server.plugins.mongoose.connection.model("Candle");
    const symbol = request.params.symbol;

    const candles = await Candle.find({
      $and: [{ exchange: "binance" }, { symbol }, { interval: "4h" }]
    })
      .limit(1000)
      .sort({ open_time: -1 });

    return (candles || []).reverse();
  } catch (error) {
    console.error(error);
    return Boom.internal();
  }
};
exports.update = async function (request, h) {};
exports.delete = async function (request, h) {};

exports.getObserverStatus = async function (request, h) {
  try {
    const Candle = request.server.plugins.mongoose.connection.model("Candle");
    const options = request.route.realm.pluginOptions;
    const pairs = options.pairs.filter(pair =>
      request.query.symbol ? pair === request.query.symbol : true
    );
    const candles = await Promise.all(
      pairs.map(symbol =>
        Candle.findOne(
          { $and: [{ exchange }, { symbol }] },
          {
            _id: 0,
            symbol: 1,
            open_time: 1,
            close_time: 1,
            close_price: 1,
            change: 1
          }
        )
          .hint("exchange_1_symbol_1_open_time_-1")
          .sort({ open_time: -1 })
      )
    ).then(result =>
      result
        .filter(notNull => notNull)
        .sort((a, b) => orderAlphabetically((a || {}).symbol, (b || {}).symbol))
    );
    return candles;
  } catch (error) {
    console.error(error);
    return Boom.internal();
  }
};

exports.deleteOldCandles = async function (request, h) {
  try {
    const Candle = request.server.plugins.mongoose.connection.model("Candle");
    const week = 604800000;
    const symbol = request.query.symbol;

    await Candle.deleteMany({
      $and: [
        { close_time: { $lt: new Date().getTime() - week } },
        { interval: "1h" },
        ...(symbol ? [{ symbol }] : [])
      ]
    });

    return { success: true };
  } catch (error) {
    console.error(error);
    return Boom.internal();
  }
};

exports.broadcast = async function (request, h) {
  try {
    const candle = request.payload;

    request.server.publish(`/candles/${candle.symbol}`, candle);
    return h.response();
  } catch (error) {
    request.server.logger.error(error);
    return Boom.internal();
  }
};

exports.getPastDayCandles = async function (request, h) {
  try {
    const Candle = request.server.plugins.mongoose.connection.model("Candle");
    const open_time = new Date().setUTCMinutes(0, 0, 0) - 1440 * 6e4;
    const candles = await Candle.find(
      { open_time },
      {
        open_time: true,
        open_price: true,
        symbol: true
      }
    ).then(r => r.map(c => c.toJSON()).map(({ _id, ...c } = {}) => c));
    return candles;
  } catch (error) {
    request.server.logger.error(error);
    return Boom.internal();
  }
};

exports.persist = async function (request, h) {
  try {
    const getAsync = request.server.plugins.redis.getAsync;
    const setAsync = request.server.plugins.redis.setAsync;
    const delAsync = request.server.plugins.redis.delAsync;
    const rpushAsync = request.server.plugins.redis.rpushAsync;
    const llenAsync = request.server.plugins.redis.llenAsync;
    const lpopAsync = request.server.plugins.redis.lpopAsync;

    const CandleModel =
      request.server.plugins.mongoose.connection.model("Candle");

    const candle = request.payload;

    request.server.publish(`/candles/${candle.symbol}`, candle);

    const last_signals_process_date = await getAsync(
      `${candle.symbol}_last_signals_process_date`
    );
    const last_positions_process_date = await getAsync(
      `${candle.symbol}_last_positions_process_date`
    );

    const candles_persist_lock = await getAsync(
      `${candle.symbol}_candles_persist_lock`
    );

    const has_open_signal = await getAsync(`${candle.symbol}_has_open_signal`);

    if (
      Date.now() - (last_signals_process_date || 0) >
        signals_interval * milliseconds.seconds * 2 &&
      !!candles_persist_lock
    ) {
      await delAsync(`${candle.symbol}_candles_persist_lock`);
    }

    if (
      Date.now() - (last_signals_process_date || 0) >
        signals_interval * milliseconds.seconds &&
      !candles_persist_lock
    ) {
      await setAsync(`${candle.symbol}_candles_persist_lock`, true);
      await setAsync(`${candle.symbol}_last_signals_process_date`, Date.now());

      const length = await llenAsync(`${candle.symbol}_candles`);
      const candles = await lpopAsync([`${candle.symbol}_candles`, length]);
      const toUpdate = Object.entries(
        (candles || []).reduce((acc, candle) => {
          const parsed = JSON.parse(candle);
          return { ...acc, [parsed.id]: parsed };
        }, {})
      ).map(([_, value]) => value);

      if (toUpdate.length) {
        await CandleModel.bulkWrite(
          toUpdate.map(value => ({
            updateOne: {
              filter: { id: value.id },
              update: { $set: value },
              upsert: true
            }
          })),
          { ordered: false }
        );

        await candles_processor_microservice.post(
          `?symbol=${candle.symbol}`,
          toUpdate.map(c => c.id)
        );

        await signals_performance_microservice.post(
          `?symbol=${candle.symbol}`,
          toUpdate
        );
      }
      await delAsync(`${candle.symbol}_candles_persist_lock`);

      if (
        Date.now() - (last_positions_process_date || 0) >
          positions_interval * milliseconds.seconds &&
        !candles_persist_lock
      ) {
        await positions_processor_microservice.post(`?symbol=${candle.symbol}`);
        await setAsync(
          `${candle.symbol}_last_positions_process_date`,
          Date.now()
        );
      }

      await signals_processor_microservice.post(`?symbol=${candle.symbol}`);
    } else {
      try {
        await rpushAsync(`${candle.symbol}_candles`, JSON.stringify(candle));
      } catch (error) {
        console.error(error.code);
        if (error.code === "WRONGTYPE") {
          await delAsync(`${candle.symbol}_candles`);
        } else {
          throw error;
        }
      }
    }

    if (has_open_signal) {
      await signals_processor_microservice.post(`?symbol=${candle.symbol}`);
    }

    return h.response();
  } catch (error) {
    console.error(error);
    return Boom.internal();
  }
};
