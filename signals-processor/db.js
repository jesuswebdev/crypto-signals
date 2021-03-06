"use strict";

const Mongoose = require("mongoose");

module.exports = {
  name: "mongoose",
  version: "1.0.0",
  register: async function (server, options) {
    Mongoose.set("useFindAndModify", false);

    try {
      const db = await Mongoose.createConnection(options.db_uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });

      require("./src/candle/model")(db);
      require("./src/signal/model")(db);
      require("./src/position/model")(db);
      require("./src/account/model")(db);
      require("./src/market/model")(db);
      console.log("imported all models");
      server.expose("connection", db);
    } catch (error) {
      throw error;
    }
  }
};
