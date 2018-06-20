'use strict';

const { RouteRegistry } = require('../index');

module.exports = service_container => {
  const registry = new RouteRegistry();
  registry.setContainer(service_container);

  // Routes, organized by various tests
  registry.routeBuilder({
    '/test1': {
      get: { name: 'test1', action: (req, res, next) => {
        res.send({
          message: 'This is the most basic test case.',
          documentation: 'Using get/post/put/delete/patch as a configuration key will set a route action.',
          expectation: 'You should see a string.',
          pass: true,
        });
      }},
    },
  });

  registry.routeBuilder({
    middleware: (req, res, next) => { req.context = 'fud'; next(); },
    '/test2': {
      get: { name: 'test2', action: (req, res, next) => {
        if (req.context) {
          res.send({
            message: `This test is a demonstration of how to use middleware.`,
            documentation: `Middleware are function that are executed before route actions. Don't forget to call next() in the middleware or it will not forward the request to the route action.`,
            expectation: `It sets the req.context value: "${req.context}".`,
            pass: true,
          });
        } else {
          res.status(500).send({
            message: 'Middleware not fired. Test failed.',
            pass: false,
          });
        }
      }},
    },
  });

  registry.routeBuilder({
    param: [ 'id', (req, res, next, id) => { req.converted = `UserId:${id}`; next(); }],
    '/test3': {
      get: { name: 'test3_index', action: (req, res, next) => res.redirect('/test3/777')},

      '/:id(\\d+)': {
        get: { name: 'test3', action: (req, res, next) => {
          if (req.converted) {
            res.send({
              message: `This test is a demonstration of how to use parameter converters.`,
              documentation: `Parameter converters take named route parameters and are used to convert them into objects. Generally, try to set the on req.*. And don't forget to call next()!`,
              expectation: `It sets the req.converted value: "${req.converted}".`,
              pass: true,
            });
          } else {
            res.status(500).send({
              message: 'Parameter converter not fired.',
              pass: false,
            });
          }
        }},
      }
    },
  });

  registry.routeBuilder({
    '/test4': {
      get: { name: 'test4', action: (req, res, next) => { throw new Error('GET raised exception') }},
    },
    error: (err, req, res, next) => {
      res.send({
        message: `This test is a demonstration of how to use error handlers.`,
        error: `Error handlers are fired when a route action raises an exception.`,
        expectation: `It catches the error here: "${err.message}".`,
        pass: true,
      });
    }
  });

  // More advanced tests

  registry.routeBuilder({
    middleware: [
      (req, res, next) => { req.context = []; next(); },
      (req, res, next) => { req.context.push('top level'); next(); },
    ],
    '/test5': {
      middleware: (req, res, next) => { req.context.push('middle level'); next(); },

      '/': {
        middleware: (req, res, next) => { req.context.push('bottom level'); next(); },
        get: { name: 'test5', action: (req, res, next) => {
          res.send({
            message: `This test is a demonstration of how middleware is inherited, and in what order. Don't forget to call next() on each one!`,
            expectation: `It sets the req.context value: "${req.context}".`,
            pass: true,
          });
        }},
      },
    },
  });

  registry.routeBuilder({
    '/test6': {
      '/': {
        get: { name: 'test6', action: (req, res, next) => { throw new Error('blow up'); }},
        error: [
          (error, req, res, next) => { req.context = []; next(error); },
          (error, req, res, next) => { req.context.push('bottom level'); next(error); },
        ],
      },
      error: (error, req, res, next) => { req.context.push('middle level'); next(error); },
    },
    error: [
      (error, req, res, next) => { req.context.push('top level'); next(error); },
      (error, req, res, next) => {
        res.send({
          message: `This test is a demonstration of how multiple error handlers are inherited, and in what order. Note it goes in the OPPOSITE order of middleware! Don't forget to call next(error) on each one!`,
          expectation: `It sets req.context: "${req.context}". And the error was: "${error.message}".`,
          pass: true,
        });
      }
    ]
  });

  registry.routeBuilder({
    traits: {
      website: {
        middleware: (req, res, next) => { req.web_context = 'home'; next(); },
      },
    },
    '/test7': {
      is: [ 'website' ],
      get: { name: 'test7', action: (req, res, next) => {
        res.send({
          message: `This is a demonstration of traits. You can register middleware onto traits and have them quickly inherited by many routes.`,
          expectation: `The req.web_context should look like: "${req.web_context}".`,
          pass: true,
        })
      }},
    }
  });

  registry.routeBuilder({
    traits: {
      website: {
        middleware: '@middleware.heylisten',
        error: '@error.test9',
      },
    },
    '/test8': {
      is: [ 'website' ],
      get: [ '@TestController', 'test8_action', 'datnametho' ],
    },
    '/test9': {
      is: [ 'website' ],
      get: [ '@TestController', 'test9_action', 'eeeeeeee' ],
    }
  });

  registry.routeBuilder({
    '/routes': {
      get: [ 'debug.controller', 'get_all_routes_action' ],
    },
  });

  return registry;
};

