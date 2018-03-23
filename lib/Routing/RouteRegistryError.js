'use strict';

class RoutingException extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
module.exports = RoutingException;
