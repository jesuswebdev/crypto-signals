"use strict";

const mongoose = require("mongoose");
const { validateNumber } = require("../../utils");
const { allowed_pairs } = require("../../config");

const Schema = mongoose.Schema;

const SignalSchema = new Schema(
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
      validate: value => allowed_pairs.includes(value)
    },
    interval: {
      type: String,
      required: true,
      validate: value => ["4h", "1h", "1m"].includes(value)
    },
    price: { type: Number, required: true, validate: validateNumber },
    type: { type: String, required: true, enum: ["buy", "sell"] },
    date: { type: Date, required: true },
    close_date: { type: Date },
    drop_price: { type: Number, required: true, validate: validateNumber },
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
    low1d: { type: Number },
    low3d: { type: Number },
    low7d: { type: Number },
    low30d: { type: Number }
  },
  { timestamps: true }
);

module.exports = db => db.model("Signal", SignalSchema);
