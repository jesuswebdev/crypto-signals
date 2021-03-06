const MongooseTypes = require("mongoose").Types;
const tulind = require("tulind");
const mesa = require("./mesa");
const { Candle, OHLC } = require("./src/interfaces");
const {
  nz,
  toSymbolPrecision,
  cloneObject,
  milliseconds
} = require("@crypto-signals/utils");

const truncateDecimals = v => Number(Number(v).toFixed(4));
const validateValue = value =>
  typeof value === "undefined" ? null : truncateDecimals(value);

const invalidNumber = v =>
  typeof v === "undefined" ||
  v === null ||
  isNaN(v) ||
  v === -Infinity ||
  v === Infinity;

/**
 *
 * @param {Candle[]} array
 * @returns {OHLC} result
 */
const getOHLCValues = array => {
  const assertValue = value => {
    if (invalidNumber(value)) throw new Error("Invalid OHLC value: " + value);
    return value;
  };

  const ohlc = {
    open: [],
    high: [],
    low: [],
    close: [],
    volume: [],
    hl2: []
  };

  for (const candle of array) {
    ohlc.open.push(assertValue(candle.open_price));
    ohlc.high.push(assertValue(candle.high_price));
    ohlc.low.push(assertValue(candle.low_price));
    ohlc.close.push(assertValue(candle.close_price));
    ohlc.volume.push(assertValue(candle.base_asset_volume));
    ohlc.hl2.push(assertValue((candle.high_price + candle.low_price) / 2));
  }
  return ohlc;
};

const getBollingerBands = (data, parseFn = validateValue) => {
  return new Promise(async (resolve, reject) => {
    tulind.indicators.bbands.indicator(data, [20, 2], (err, res) => {
      if (err) {
        return reject(err);
      }

      const getDirection = array => {
        const length = array.length - 1;
        if (array[length - 1] > array[length]) {
          return "down";
        }
        if (array[length - 1] < array[length]) {
          return "up";
        }
        return "side";
      };

      const [bbabds_lower_result, bbands_middle_result, bbands_upper_result] =
        res;
      const [bbands_lower] = bbabds_lower_result.slice(-1);
      const [bbands_middle] = bbands_middle_result.slice(-1);
      const [bbands_upper] = bbands_upper_result.slice(-1);

      return resolve({
        bbands_lower: parseFn(bbands_lower),
        bbands_middle: parseFn(bbands_middle),
        bbands_upper: parseFn(bbands_upper),
        bbands_direction: getDirection(bbands_middle_result)
      });
    });
  });
};

/**
 *
 * @param {Array<Number[]>} data
 * @returns {Promise<Number>|Promise<Number[]>} Exponential Moving Average value
 */
const getEMA = (data, period = 5, all = false, parseFn = validateValue) => {
  return new Promise(async (resolve, reject) => {
    tulind.indicators.ema.indicator(data, [period], (err, [res]) => {
      if (err) {
        return reject(err);
      }
      if (all) {
        return resolve((res || []).map(v => parseFn(v)));
      }
      return resolve(parseFn(res.pop()));
    });
  });
};

/**
 *
 * @param {Array<Number[]>} data
 * @returns {Promise<Number>} Simple Moving Average value
 */
const getSMA = (data, periods = 28, parseFn = validateValue) => {
  return new Promise(async (resolve, reject) => {
    tulind.indicators.sma.indicator(data, [periods], (err, [res]) => {
      if (err) {
        return reject(err);
      }
      return resolve(parseFn(res.pop()));
    });
  });
};

const getRMA = async (data, periods, validateFn) => {
  const alpha = 1 / periods;

  let sum = [];

  for (const item of data) {
    const previous = sum[sum.length - 1];
    const nan = isNaN(previous);
    const src = data.slice(0, sum.length + 1);
    const value = nan
      ? await getSMA([src], periods, validateFn)
      : validateFn(alpha * item + (1 - alpha) * nz(previous));
    sum.push(value);
  }

  return sum;
};

/**
 *
 * @param {Array<Number[]>} data
 * @returns {Promise<Number>} Average True Range value
 */
const getATR = (
  data,
  periods = 14,
  return_sma = true,
  parseFn = validateValue
) => {
  return new Promise(async (resolve, reject) => {
    tulind.indicators.atr.indicator(data, [periods], async (err, [res]) => {
      if (err) {
        return reject(err);
      }
      if (!return_sma) {
        return resolve(parseFn(res.pop()));
      }
      const sma = await getSMA([res], 28, parseFn);
      return resolve({ atr: parseFn(res.pop()), atr_sma: sma });
    });
  });
};

/**
 *
 * @param {Array<Number[]>} data
 * @returns {Promise<Number>} Average True Range value
 */
const getTR = (data, all = false, parseFn = validateValue) => {
  return new Promise(async (resolve, reject) => {
    tulind.indicators.tr.indicator(data, [], async (err, [res]) => {
      if (err) {
        return reject(err);
      }
      if (all) {
        return resolve((res || []).map(v => parseFn(v)));
      }
      return resolve(parseFn(res.pop()));
    });
  });
};

/**
 *
 * @param {Array<Number[]>} data
 * @returns {Promise<Number>} On Balance Volume value
 */
const getOBV = (data, return_sma = true) => {
  return new Promise(async (resolve, reject) => {
    tulind.indicators.obv.indicator(data, [], async (err, [res]) => {
      if (err) {
        return reject(err);
      }
      if (!return_sma) {
        return resolve(validateValue(res.pop()));
      }
      const ema = await getEMA([res], 28);
      return resolve({ obv: validateValue(res.pop()), obv_ema: ema });
    });
  });
};

const getMACD = (data, parseFn = validateValue) => {
  return new Promise(async (resolve, reject) => {
    tulind.indicators.macd.indicator(data, [12, 26, 9], (err, res) => {
      if (err) {
        return reject(err);
      }
      const [macd_result, signal_result, histogram_result] = res;
      const macd = macd_result.pop();
      const macd_signal = signal_result.pop();
      const macd_histogram = histogram_result.pop();
      return resolve({
        macd: parseFn(macd),
        macd_signal: parseFn(macd_signal),
        macd_histogram: parseFn(macd_histogram)
      });
    });
  });
};

const getADX = (data, periods = 14) => {
  return new Promise(async (resolve, reject) => {
    tulind.indicators.adx.indicator(data, [periods], (err, [res]) => {
      if (err) {
        return reject(err);
      }
      return resolve(validateValue(res.pop()));
    });
  });
};

const getDI = (data, periods = 14) => {
  return new Promise(async (resolve, reject) => {
    tulind.indicators.di.indicator(data, [periods], (err, res) => {
      if (err) {
        return reject(err);
      }
      return resolve({
        plus_di: validateValue(res[0].pop()),
        minus_di: validateValue(res[1].pop())
      });
    });
  });
};

const getDMI = (data, periods = 14) => {
  return new Promise(async (resolve, reject) => {
    try {
      const adx = await getADX(data, periods);
      const di = await getDI(data, periods);
      return resolve({ adx, ...di });
    } catch (error) {
      console.error(error);
      return reject(error);
    }
  });
};

/**
 *
 * @param {Candle[]} candles
 * @param {OHLC} ohlc
 */
const getSupertrend = async (candles, ohlc, parseFn = validateValue) => {
  if (candles.length === 1) {
    return {};
  }
  const { high, low, close, hl2 } = ohlc;

  const factor = 3;
  const pd = 7;

  const atr = await getATR([high, low, close], pd, false, parseFn);

  const up = hl2[hl2.length - 1] - factor * atr;
  const dn = hl2[hl2.length - 1] + factor * atr;

  const trend_up = parseFn(
    close[close.length - 2] > candles[candles.length - 2]?.trend_up
      ? Math.max(up, candles[candles.length - 2]?.trend_up)
      : up
  );

  const trend_down = parseFn(
    close[close.length - 2] < candles[candles.length - 2]?.trend_down
      ? Math.min(dn, candles[candles.length - 2]?.trend_down)
      : dn
  );

  const trend =
    close[close.length - 1] > candles[candles.length - 2]?.trend_down
      ? 1
      : close[close.length - 2] < candles[candles.length - 2]?.trend_up
      ? -1
      : nz(candles[candles.length - 2]?.trend, 1);

  return { trend, trend_up, trend_down };
};

const getCumulativeIndicator = async ({
  candles,
  ohlc,
  fn,
  getter,
  parseFn
}) => {
  const result = await candles
    .reduce(async (p_acc, candle, index, array) => {
      const acc = await p_acc;
      const sliced_candles = array.slice(0, index + 1).map(sliced => ({
        ...sliced,
        ...getter(acc.find(v => v.id === sliced.id) || {})
      }));
      const sliced_ohlc = Object.entries(ohlc).reduce(
        (acc, [key, value]) => ({ ...acc, [key]: value.slice(0, index + 1) }),
        {}
      );

      const value = await fn(sliced_candles, sliced_ohlc, parseFn);
      return acc.concat({ ...candle, ...value });
    }, Promise.resolve([]))
    .then(r => getter(r[r.length - 1]));
  return result;
};

/**
 *
 * @param {Candle[]} candles
 * @param {OHLC} ohlc
 */
const getATRStop = async (candles, ohlc, parseFn = validateValue) => {
  if (candles.length === 1) {
    return {};
  }
  const { high, low, close } = ohlc;

  const factor = 3.5;
  const pd = 5;

  const atr = await getATR([high, low, close], pd, false, parseFn);
  const loss = atr * factor;

  const [previous_candle] = candles.slice(-2);
  const [previous_close, current_close] = close.slice(-2);

  let atr_stop = 0;

  if (
    current_close > parseFn(nz(previous_candle.atr_stop)) &&
    previous_close > parseFn(nz(previous_candle.atr_stop))
  ) {
    atr_stop = parseFn(
      Math.max(nz(previous_candle.atr_stop), current_close - loss)
    );
  } else if (
    current_close < parseFn(nz(previous_candle.atr_stop)) &&
    previous_close < parseFn(nz(previous_candle.atr_stop))
  ) {
    atr_stop = parseFn(
      Math.min(nz(previous_candle.atr_stop), current_close + loss)
    );
  } else if (current_close > parseFn(nz(previous_candle.atr_stop))) {
    atr_stop = parseFn(current_close - loss);
  } else {
    atr_stop = parseFn(current_close + loss);
  }

  return { atr_stop };
};

/**
 *
 * @param {Candle[]} candles
 * @param {OHLC} ohlc
 */
const getCHATR = async (candles, ohlc) => {
  if (candles.length === 1) {
    return {};
  }

  const { high, low, close } = ohlc;

  const tr = await getTR([high, low, close], true, nz);
  const rma = await getRMA(tr, 10, nz);
  const atrp = rma.map((t, i) => (t / close[i]) * 100);
  const avg = await getEMA([atrp], 28, undefined, nz);

  return {
    ch_atr_ema: avg,
    ch_atr: atrp[atrp.length - 1]
  };
};

async function getPumpOrDump(ohlc) {
  //Pump Alerts by herrkaschel
  const lookback = 150;
  const threshold = 15; // % change to be considered a pump
  const { volume, close } = ohlc;

  let mav = [];
  let all_historic_max = [];
  let is_pump = [];

  for (let index = 0; index < volume.length; index++) {
    const prev_mav = mav[mav.length - 1];
    const prev_historic_max = all_historic_max[all_historic_max.length - 1];
    const src = volume.slice(0, index + 1);
    if (src.length < 2) {
      continue;
    }
    const previous_close = close[index - 1] || 0;
    const current_close = close[index] || 0;
    const mav_sma = await getSMA([src], lookback);
    const difference = nz(mav_sma) - nz(prev_mav);
    const increasing = current_close > previous_close && difference > 0;
    const vroc =
      increasing && nz(prev_mav) !== 0 ? difference * (100 / prev_mav) : 0;
    const firstVrocNormalizedValue = 10;
    const historic_max =
      vroc > nz(prev_historic_max)
        ? vroc
        : nz(prev_historic_max, firstVrocNormalizedValue);
    const vrocNormalized =
      nz(historic_max) !== 0 ? (vroc / historic_max) * 100 : 0;

    is_pump.push(vrocNormalized >= threshold);
    all_historic_max.push(historic_max);
    mav.push(nz(mav_sma));
  }
  return { is_pump: is_pump[is_pump.length - 1] };
}

function getVolumeTrend(ohlc) {
  const { open, close, volume } = ohlc;
  const lookback = 14;

  let up = 0;
  let down = 0;

  for (let i = volume.length - lookback; i < volume.length; i++) {
    close[i] > open[i] ? (up += volume[i]) : (down += volume[i]);
  }

  return { volume_trend: up - down > 0 ? 1 : -1 };
}

async function getEMASlope(ohlc, parseFn) {
  const { hl2 } = ohlc;
  const periods = 50;

  const ema = await getEMA([hl2], periods, true, parseFn);
  let slope = 0;
  let previous = 0;
  for (const value of ema) {
    slope = nz(value / previous) > 1 ? 1 : -1;
    previous = value;
  }

  return { ema_50: ema[ema.length - 1], ema_50_slope: slope };
}

/**
 *
 * @param {OHLC} ohlc Values
 * @param {Candle[]} candles candles
 */
const getIndicatorsValues = (ohlc, candles) => {
  const { high, close, low, volume, hl2 } = ohlc;
  const [previous_candle, current_candle] = cloneObject(candles.slice(-2));
  const parseValue = v =>
    invalidNumber(v) ? null : toSymbolPrecision(v, current_candle.symbol);
  return new Promise(async resolve => {
    const promises = [
      getATR([high, low, close], undefined, undefined, parseValue),
      getOBV([close, volume]),
      getDMI([high, low, close]),
      getMACD([close], parseValue),
      getEMASlope(ohlc, parseValue),
      ...(!previous_candle.trend && !current_candle.trend
        ? [
            getCumulativeIndicator({
              candles,
              ohlc,
              getter: ({ trend, trend_up, trend_down } = {}) => ({
                trend,
                trend_up,
                trend_down
              }),
              fn: getSupertrend,
              parseFn: parseValue
            })
          ]
        : [getSupertrend(candles, ohlc, parseValue)]),
      ...(!previous_candle.atr_stop && !current_candle.atr_stop
        ? [
            getCumulativeIndicator({
              candles,
              ohlc,
              getter: ({ atr_stop } = {}) => ({ atr_stop }),
              fn: getATRStop,
              parseFn: parseValue
            })
          ]
        : [getATRStop(candles, ohlc, parseValue)]),
      getCHATR(candles, ohlc, parseValue),
      getPumpOrDump(ohlc)
    ];

    const p = await Promise.all(promises);
    const result = p.reduce((acc, v) => ({ ...acc, ...v }), {});
    const mesa_result = mesa(hl2);
    return resolve({
      ...result,
      mama: parseValue(mesa_result.mama),
      fama: parseValue(mesa_result.fama),
      ...getVolumeTrend(ohlc)
    });
  });
};

/**
 *
 * @param {Number} open_price candle open price
 * @param {Number} close_price candle close price
 */
const getCandleDirection = (open_price, close_price) => {
  if (close_price > open_price) {
    return "up";
  }
  if (close_price < open_price) {
    return "down";
  }
  return "side";
};

/**
 *
 * @returns {Candle[]} array of candles without indicators values
 */
const buildCandlesData = ({ candles, symbol, interval }) => {
  console.log("Building candles data");

  if (exchange === "kucoin") {
    return candles.reduce(
      (acc, current) =>
        acc.concat({
          exchange,
          symbol,
          interval,
          id: `${exchange}_${symbol}_${interval}_${cloneObject(
            current[0] * 1e3
          )}`,
          event_time: Number(cloneObject(current[0] * 1e3)),
          open_time: Number(cloneObject(current[0] * 1e3)),
          close_time: Number(
            cloneObject(
              current[0] * 1e3 +
                milliseconds.minute * 59 +
                milliseconds.seconds * 59
            )
          ),
          open_price: Number(cloneObject(current[1])),
          close_price: Number(cloneObject(current[2])),
          high_price: Number(cloneObject(current[3])),
          low_price: Number(cloneObject(current[4])),
          base_asset_volume: Number(cloneObject(current[5])),
          quote_asset_volume: Number(cloneObject(current[6])),
          date: new Date(Number(cloneObject(current[0] * 1e3))),
          direction: getCandleDirection(
            Number(cloneObject(current[1])),
            Number(cloneObject(current[2]))
          )
        }),
      []
    );
  }

  return candles.reduce(
    (acc, current) =>
      acc.concat({
        exchange,
        symbol,
        interval,
        id: `${exchange}_${symbol}_${interval}_${cloneObject(current[0])}`,
        event_time: Number(cloneObject(current[0])),
        open_time: Number(cloneObject(current[0])),
        close_time: Number(cloneObject(current[6])),
        open_price: Number(cloneObject(current[1])),
        close_price: Number(cloneObject(current[4])),
        high_price: Number(cloneObject(current[2])),
        low_price: Number(cloneObject(current[3])),
        base_asset_volume: Number(cloneObject(current[5])),
        number_of_trades: Number(cloneObject(current[8])),
        is_closed: new Date().getTime() > Number(cloneObject(current[6])),
        quote_asset_volume: Number(cloneObject(current[7])),
        date: new Date(Number(cloneObject(current[0])))
      }),
    []
  );
};

const castToObjectId = id =>
  typeof id === "string" ? MongooseTypes.ObjectId(id) : id;

module.exports = {
  getOHLCValues,
  getIndicatorsValues,
  buildCandlesData,
  castToObjectId,
  getCandleDirection,
  getSupertrend,
  getATRStop,
  getCHATR
};
