'use strict';

module.exports = service_container => {

  service_container.set('service_container', service_container);

  service_container.set('express.port', 8282);

  service_container.registerFactory('express.error_handler1', () => {
    return require('./ErrorHandlers').unauthorizedErrorHandler;
  });
  service_container.registerFactory('express.error_handler2', () => {
    return require('./ErrorHandlers').bitsErrorHandler;
  });
  service_container.registerFactory('express.error_handler3', () => {
    return require('./ErrorHandlers').defaultErrorHandler;
  });

  service_container.registerFactory('route_registry', require('./routing'));

  service_container.set('middleware.sample', function samplemiddleware(req, res, next) { next(); });
  service_container.set('middleware.heylisten', function heylisten(req, res, next) { req.heylisten = 'HEY, listen!'; next(); });
  service_container.set('error.sample', function sampleerrorhandler(err, req, res, next) { res.send('blah'); });
  service_container.set('error.test9', function test9error(err, req, res, next) {
    res.send({
      message: `This is a demonstration of error handlers working.`,
      expectation: err.message,
      pass: true,
    });
  });
  service_container.set('param.sample', function sampleparameterconverter(req, res, next, id) { next(); });

  service_container.registerFactory('express.server', service_container => {
    const express = require('express');

    const app = express();

    // Register our routes
    const appRouter = express.Router();
    service_container.get('route_registry').registerAll(appRouter);
    app.use(appRouter);

    // app.use(service_container.get('express.error_handler1'));
    // app.use(service_container.get('express.error_handler2'));
    // app.use(service_container.get('express.error_handler3'));

    const port = service_container.get('express.port');
    const start = () => {
      require('http').createServer(app).listen(port, () => {
        console.log('AppKernel: Express server started, listening on port ' + port + '...');
      });
    };

    return {
      start,
    };
  });

  service_container.autowire('TestController', require('./TestController')).addTag('controller');
  service_container.autowire('helloworld_controller', require('./HelloWorldController')).addTag('controller');
  service_container.autowire('debug.controller', require('./DebugController')).addTag('controller');
  service_container.addCompilerPass(new (require('../lib/DependencyInjection/ControllerCompilerPass'))());

};
