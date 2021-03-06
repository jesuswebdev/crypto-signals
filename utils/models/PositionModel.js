const { pairs, validateNumber } = require("../");

module.exports = (mongoose, config = {}) => {
  return new mongoose.Schema(
    {
      id: { type: String, required: true },
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
      open_time: { type: Number, required: true, validate: validateNumber },
      close_time: { type: Number, validate: validateNumber },
      date: { type: Date },
      close_date: { type: Date },
      status: {
        type: String,
        enum: ["open", "closed"],
        default: "open"
      },
      change: { type: Number, validate: validateNumber },
      cost: { type: Number, validate: validateNumber },
      buy_price: { type: Number, validate: validateNumber },
      buy_amount: { type: Number, validate: validateNumber },
      sell_price: { type: Number, validate: validateNumber },
      take_profit: { type: Number, validate: validateNumber },
      stop_loss: { type: Number, validate: validateNumber },
      arm_trailing_stop_loss: { type: Number, validate: validateNumber },
      trailing_stop_loss: { type: Number, validate: validateNumber },
      trailing_stop_loss_armed: { type: Boolean, default: false },
      trigger: { type: String },
      profit: { type: Number, validate: validateNumber },
      signal: { type: mongoose.Types.ObjectId, ref: "Signal" },
      buy_order: { type: Object },
      sell_order: { type: Object },
      sell_trigger: {
        type: String,
        validate: value =>
          ["stop_loss", "trailing_stop_loss", "take_profit"].includes(value)
      },
      sell_candle: { type: Object },
      is_test: { type: Boolean, default: false },
      account_id: { type: mongoose.Types.ObjectId, ref: "Account" },
      configuration: { type: Object },
      trailing_stop_loss_trigger_time: { type: Number },
      stop_loss_trigger_time: { type: Number },
      last_tsl_update: { type: Number, default: 0 },
      trader_lock: { type: Boolean, default: false },
      trader_bot: { type: Boolean },
      filled_on_update: { type: Boolean, default: false },
      negative_change: { type: Boolean, default: false },
      unlocked_tsl_multiplier: { type: Number, default: 0 },
      last_stop_loss_update: { type: Number, default: 0 },
      broadcast: { type: Boolean, default: false },
      entry_signal_telegram_message_id: { type: Number },
      entry_signal_discord_message_id: { type: Number }
    },
    { timestamps: true, ...config }
  );
};
