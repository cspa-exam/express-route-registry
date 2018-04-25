'use strict';

function middlewareSetsRequestBits(req, res, next) {
  req.bits = 'bats';
  next();
}

function middlewarePreventUnauthorizedAccess(req, res, next) {
  if (req.authorized === 'yes') {
    next();
  } else {
    next(new Error('Unauthorized'));
  }
}

module.exports = {
  middlewareSetsRequestBits,
  middlewarePreventUnauthorizedAccess,
};
