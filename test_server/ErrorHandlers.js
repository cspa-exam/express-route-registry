'use strict';

function defaultErrorHandler(err, req, res, next) {
  res.status(500).send(`<html><body>Whoops, something went wrong??? ${err.message}</body></html>`);
}

function unauthorizedErrorHandler(err, req, res, next) {
  if (err.message === 'Unauthorized') {
    res.status(403).send('<html><body>Man you aint authorized why dont u gtfo</body></html>');
    return;
  }
  next();
}

function bitsErrorHandler(err, req, res, next) {
  if (req.bits) {
    res.status(302).send(`<html><body>Actually why dont you go over here: ${req.bits}</body></html>`);
  }
  next();
}

module.exports = {
  unauthorizedErrorHandler,
  defaultErrorHandler,
  bitsErrorHandler,
};
