const express = () => {
  const express = require("express");
  const cors = require("cors")({ origin: true });
  const morgan = require("morgan");
  const helmet = require("helmet");
  const nocache = require("nocache");

  const app = express();

  app.use(helmet());
  app.use(nocache());
  app.use(cors);
  app.use(morgan("combined"));

  return app;
};

module.exports = express;
