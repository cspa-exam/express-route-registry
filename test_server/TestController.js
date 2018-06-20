'use strict';

const Controller = require('../index.js').Controller;

class TestController extends Controller {

  test8_action(req, res, next) {
    res.send({
      message: `This is a demonstration of service ids in the json loader syntax.`,
      expectation: `The middleware should set this variable: ${req.heylisten}`,
      pass: true,
    });
  }

  test9_action(req, res, next) {
    throw new Error('Test 9 passes');
  }

}
module.exports = TestController;
