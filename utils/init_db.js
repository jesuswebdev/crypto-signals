Object.entries({accounts: [{ id: 1 }],candles: [{ exchange: 1, symbol: 1, open_time: 1 },{ exchange: 1, symbol: 1, interval: 1, open_time: 1 },{ exchange: 1, symbol: 1, interval: 1, open_time: -1 },{ id: 1 }],logs: [],markets: [{ exchange: 1, symbol: 1 },{ symbol: 1 },{ trader_lock: 1, last_trader_lock_update: 1 }],orders: [{ orderId: -1, symbol: -1 },{ status: 1, side: 1, time: -1 }],signals: [{ "buy_order.orderId": 1 },{ "close_candle.id": 1 },{ exchange: 1, symbol: 1, status: 1, trigger_time: -1 },{ exchange: 1, symbol: 1, status: 1, close_time: -1 },{ id: 1 }],positions: [{ "buy_order.orderId": 1 },{ exchange: 1, symbol: 1, status: 1 },{ exchange: 1, symbol: 1, status: 1, open_time: -1 },{ id: 1 },{ signal: 1 }]}).map(([col_name, indexes]) => {db.createCollection(col_name);if (indexes.length) {indexes.map(index => {db[col_name].createIndex(index);});}});