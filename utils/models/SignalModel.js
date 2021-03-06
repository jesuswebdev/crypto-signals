const { validateNumber, candle_intervals, pairs } = require("../");

module.exports = (mongoose, config = {}) => {
  return new mongoose.Schema(
    {
      id: { type: String, required: true },
      time: { type: Number, required: true, validate: validateNumber },
      trigger_time: { type: Number, required: true, validate: validateNumber },
      close_time: { type: Number, validate: validateNumber },
      exchange: {
        type: String,
        required: true,
        enum: ["binance", "kucoin"],
        default: "binance"
      },
      symbol: {
        type: String,
        required: true,
        validate: value => pairs.map(p => p.symbol).includes(value)
      },
      interval: {
        type: String,
        required: true,
        validate: value => candle_intervals.includes(value)
      },
      price: { type: Number, required: true, validate: validateNumber },
      type: { type: String, required: true, enum: ["buy", "sell"] },
      date: { type: Date, required: true },
      close_date: { type: Date },
      drop_price: { type: Number, validate: validateNumber },
      trigger: { type: String, required: true },
      status: {
        type: String,
        enum: ["open", "closed"],
        default: "open"
      },
      trailing_stop_buy: {
        type: Number,
        required: true,
        validate: validateNumber
      },
      open_candle: { type: Object },
      close_candle: { type: Object },
      drop_percent: { type: Number, validate: validateNumber },
      position: { type: mongoose.Types.ObjectId, ref: "Position" },
      is_test: { type: Boolean, default: false },
      high1d: { type: Number },
      high3d: { type: Number },
      high7d: { type: Number },
      high30d: { type: Number },
      high90d: { type: Number, default: 0 },
      low1d: { type: Number },
      low3d: { type: Number },
      low7d: { type: Number },
      low30d: { type: Number },
      low90d: { type: Number, default: 0 },
      broadcast: { type: Boolean, default: false },
      trader_lock: { type: Boolean, default: false },
      buy_order: { type: Object }
    },
    { timestamps: true, ...config }
  );
};
