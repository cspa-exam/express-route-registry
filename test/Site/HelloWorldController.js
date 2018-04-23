'use strict';

const Controller = require('../../lib/DependencyInjection/Controller');

class HelloWorldController extends Controller {

  index_action(req, res, next) {
    res.send('<html><body>Hello world! The weather is currently: Sunny</body>');
  }

}
module.exports = HelloWorldController;
