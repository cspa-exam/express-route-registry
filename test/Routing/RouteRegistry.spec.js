'use strict';

const { expect } = require('chai');
const RouteBuilder = require('../../lib/Routing/RouteBuilder');
const RouteRegistry = require('../../lib/Routing/RouteRegistry');

const { ServiceContainer } = require('service-container');

describe('RouteRegistry', () => {
  describe('route generation', () => {
    it('can register, name, then generate routes', () => {
      const registry = new RouteRegistry();

      registry.routeBuilder({
        '/foo-bar/:id': {
          get: function thisThatAction(req, res, next) { },
        },
      });

      expect(registry.generate('thisthataction', { id: 'abc' })).to.equal('/foo-bar/abc');
    });
  });

  describe('route registration', () => {
    it('can register routes', () => {
      const r = RouteBuilder.get('/foo/bar').to((req, res, next) => res.send('Hello'));

      expect(r.generate()).to.equal('/foo/bar');
    });

    it('errors on name collisions', () => {
      const r = RouteBuilder.get('/foo/:id/bar/:baz').to((req, res, next) => res.send('Hello'));

      expect(r.generate({id:1, baz:2})).to.equal('/foo/1/bar/2');
    });

    it('throws exception when missing parameters', () => {
      const r = RouteBuilder.get('/foo/:id/bar/:baz').to((req, res, next) => res.send('Hello'));

      expect(() => r.generate({id:1})).to.throw('Expected "baz" to be a string');
    });

    it('throws exception on parameter violations', () => {
      const r = RouteBuilder.get('/foo/:id(\\d+)').to((req, res, next) => res.send('Hello'));

      expect(() => r.generate({id: 'a'})).to.throw('Expected "id" to match "\\d+", but got "a"');
    });
  });

  describe('route matching', () => {
    it('can match', () => {
      const r = RouteBuilder.get('/foo/:id(\\d+)').to((req, res, next) => res.send('Hello'));

      expect(r.isMatch('/foo/3')).to.be.true;
      expect(r.isMatch('/foo/a')).to.be.false;
      expect(r.isMatch('/bar/3')).to.be.false;
    });
  });

  describe('recursive route builder basic features', () => {
    let registry = null;
    let error = null;

    const test_action = (req, res, next) => {};
    const foo_action = (req, res, next) => {};
    const foobarbaz_action = (req, res, next) => {};
    const foo_middleware = (req, res, next) => next;
    const resource_parameter_converter = (req, res, next, id) => next;
    const resource_action = (req, res, next) => {};
    const deepAction = (req, res, next) => {};
    const deepMiddleware = (req, res, next) => {};

    before(() => {
      try {
        registry = new RouteRegistry();
        registry.routeBuilder({
          '/test': {
            get: test_action,
          },
          '/foo': {
            get: foo_action,
            middleware: foo_middleware,

            '/bar': {

              '/baz': {
                get: foobarbaz_action
              }
            },

            '/deep': {
              get: {
                action: deepAction,
                name: 'we_gotta_go_deeper',
                middleware: deepMiddleware,
              },
            }
          },
          '/resource': {
            '/:id(\\d+)': {
              param: { id: 'id', parameter_converter: resource_parameter_converter },
              get: resource_action,
            }
          },
          '/': {
            middleware: (req, res, next) => {},
            '/fez': {
              get: function action1(req, res, next) {},
            },
            '/faz': {
              get: function action2(req, res, next) {},
            },
          },
          '/fuzz': {
            get: function action3(req, res, next) {},
          }
        });
      } catch (err) {
        error = err;
      }
    });

    it(`doesn't error`, () => {
      expect(error).to.be.null;
    });

    it('registers routes correctly', () => {
      const r = registry.match('/test');

      expect(r).to.be.an('object');
      expect(r.getName()).to.equal('test_action');
      expect(r.getRouteDestination()).to.equal(test_action);
    });

    it('registers deep routes correctly', () => {
      const r = registry.match('/foo/bar/baz');

      expect(r).to.be.an('object');
      expect(r.getName()).to.equal('foobarbaz_action');
      expect(r.getRouteDestination()).to.equal(foobarbaz_action);
    });

    it('can register a blank deep route', () => {
      const r = registry.match('/fez');

      expect(r).to.be.an('object');
      expect(r.getMiddleware()).to.be.an('array').that.has.length(1);

      const r2 = registry.match('/fez');

      expect(r2).to.be.an('object');
      expect(r2.getMiddleware()).to.be.an('array').that.has.length(1);

      // Even though both routes start on / only the above route inherits the middleware;
      // the below one does not.
      const r3 = registry.match('/fuzz');

      expect(r3).to.be.an('object');
      expect(r3.getMiddleware()).to.be.an('array').that.has.length(0);
    });

    it('deep routes inherit middleware properly', () => {
      const r = registry.match('/foo/bar/baz');

      expect(r).to.be.an('object');
      expect(r.getName()).to.equal('foobarbaz_action');
      expect(r.getMiddleware()).to.deep.equal([foo_middleware]);
    });

    it('deep routes inherit parameter converters properly', () => {
      const r = registry.match('/resource/1');

      expect(r).to.be.an('object');
      expect(r.getName()).to.equal('resource_action');
      expect(r.getParameterConverters()).to.deep.equal([ {id: 'id', parameter_converter: resource_parameter_converter}]);
    });

    it('can explicitly name the registered routes', () => {
      const r = registry.match('/foo/deep');

      expect(r).to.be.an('object');
      expect(r.getName()).to.equal('we_gotta_go_deeper');
    });

    it('can register route-method-specific middleware', () => {
      const r = registry.match('/foo/deep');

      expect(r).to.be.an('object');
      expect(r.getName()).to.equal('we_gotta_go_deeper');
      expect(r.getMiddleware()).to.deep.equal([
        foo_middleware,
        deepMiddleware,
      ]);
    });
  });

  describe('recursive route builder with service ids', () => {
    let registry = null;
    let error = null;

    const container = new ServiceContainer();

    class Controller1 {
      c_action1(req, res, next) {}
    }
    class Controller2 {
      c_action2(req, res, next) {}
    }
    const controller1 = new Controller1();
    const controller2 = new Controller2();

    container.set('controller1', controller1);
    container.set('controller2', controller2);

    const middleware1 = (req, res, next) => next();
    const middleware2 = (req, res, next) => next();
    const middleware3 = (req, res, next) => next();
    const middleware4 = (req, res, next) => next();

    before(() => {
      try {
        registry = new RouteRegistry();
        registry.setContainer(container);
        registry.routeBuilder({
          // First case, passing service ids
          '/top1': {
            get: [ 'controller1', 'c_action1' ],
          },
          '/top2': {
            middleware: [ middleware1, middleware2 ],

            '/middle1': {
              middleware: middleware3,

              '/bottom1': {
                get: {
                  name: 'my_deep_route',
                  middleware: middleware4,
                  service_id: 'controller2',
                  action: 'c_action2',
                }
              }
            },
          },
        });
      } catch (err) {
        error = err;
      }
    });

    it(`doesn't error`, () => {
      expect(error).to.be.null;
    });

    it('can register controller with [ service_id, method_name ] format', () => {
      const r = registry.match('/top1');

      expect(r).to.be.an('object');
      expect(r.getName()).to.equal('controller1_c_action1');
      expect(r.getRouteDestination().name).to.equal('bound c_action1');
    });

    it('can register controller with complex configuration format', () => {
      const r = registry.match('/top2/middle1/bottom1');

      expect(r).to.be.an('object');
      expect(r.getName()).to.equal('my_deep_route');
      expect(r.getMiddleware()).to.deep.equal([middleware1, middleware2, middleware3, middleware4]); // the ordering matters!!
      expect(r.getRouteDestination().name).to.equal('bound c_action2');
    });
  });

  describe('recursive route builder syntax validation features', () => {
    describe('for actions', () => {
      let registry = null;
      beforeEach(() => {
        registry = new RouteRegistry();
      });

      it('registers properly when an action is a function', () => {
        expect(() => {
          registry.routeBuilder({
            '/foo': {
              get: (req, res, next) => {},
            },
          });
        }).to.not.throw();
      });

      it('registers properly when an action is a class static method', () => {
        class AbcClass {
          static get_action(req, res, next) {}
        }
        expect(() => {
          registry.routeBuilder({
            '/foo': {
              get: AbcClass.get_action,
            },
          });
        }).to.not.throw();
      });

      it('registers properly when an action is an object + string of instance method', () => {
        class Controller {
          get_action(req, res, next) {}
        }
        const c = new Controller();
        expect(() => {
          registry.routeBuilder({
            '/foo': {
              get: [ c, 'get_action' ],
            },
          });
        }).to.not.throw();
      });

      it('registers properly when an action is a service id + string of instance method', () => {
        class Controller {
          get_action(req, res, next) {}
        }
        const c = new Controller();
        expect(() => {
          registry.routeBuilder({
            '/foo': {
              get: [ c, 'get_action' ],
            },
          });
        }).to.not.throw();
      });

      it('blows up when an action is not a function', () => {
        expect(() => {
          registry.routeBuilder({
            '/foo': {
              get: 'a',
            },
          });
        }).to.throw('Invalid action specified');
      });

      it('blows up when the action is a function that has the wrong number of accepted arguments', () => {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length
        const action = function(req) {};

        expect(() => {
          registry.routeBuilder({
            '/foo': {
              get: action,
            },
          });
        }).to.throw('Action definition accepts wrong number of arguments: Must be 3 (req, res, next).');
      });
    });

    describe('for middleware', () => {
      let registry = null;
      beforeEach(() => {
        registry = new RouteRegistry();
      });

      it('registers properly when middleware is a function', () => {
        expect(() => {
          registry.routeBuilder({
            '/foo': {
              middleware: (req, res, next) => {},
              get: (req, res, next) => {},
            },
          });
        }).to.not.throw();
      });

      it('registers properly when middleware is an array of functions', () => {
        expect(() => {
          registry.routeBuilder({
            '/foo': {
              middleware: [ (req, res, next) => {}, (req, res, next) => {} ],
              get: (req, res, next) => {},
            },
          });
        }).to.not.throw();
      });

      it('blows up when middleware is not a function', () => {
        expect(() => {
          registry.routeBuilder({
            '/foo': {
              middleware: 'a',
              get: (req, res, next) => {},
            },
          });
        }).to.throw('Middleware at index 0 is invalid.');
      });

      it('blows up when middleware is a function that accepts the wrong number of arguments', () => {
        expect(() => {
          registry.routeBuilder({
            '/foo': {
              middleware: (req) => {},
              get: (req, res, next) => {},
            },
          });
        }).to.throw('Middleware at index 0 accepts the wrong number of arguments');
      });
    });

    describe('for parameter converters', () => {
      let registry = null;
      beforeEach(() => {
        registry = new RouteRegistry();
      });

      it('registers properly for an object with name+parameter_converter keys', () => {
        const func = (req, res, next, id) => {};
        expect(() => {
          registry.routeBuilder({
            '/foo/:id': {
              param: {
                id: 'id',
                parameter_converter: func,
              },
              get: (req, res, next) => {},
            },
          });
        }).to.not.throw();
      });

      it('registers properly for an array of objects with name+parameter_converter keys', () => {
        const func = (req, res, next, id) => {};
        expect(() => {
          registry.routeBuilder({
            '/foo/:id': {
              param: [
                {
                  id: 'id',
                  parameter_converter: func,
                }
              ],
              get: (req, res, next) => {},
            },
          });
        }).to.not.throw();
      });

      it('registers properly for an array with string + function', () => {
        const func = (req, res, next, id) => {};
        expect(() => {
          registry.routeBuilder({
            '/foo/:id': {
              param: [ 'id', func ],
              get: (req, res, next) => {},
            },
          });
        }).to.not.throw();
      });

      it('registers properly for an array of arrays with string + function', () => {
        const func = (req, res, next, id) => {};
        expect(() => {
          registry.routeBuilder({
            '/foo/:id': {
              param: [
                [ 'id', func ],
              ],
              get: (req, res, next) => {},
            },
          });
        }).to.not.throw();
      });

      it('blows up when a parameter converter is not a function', () => {
        expect(() => {
          registry.routeBuilder({
            '/foo/:id': {
              param: 'a',
              get: (req, res, next) => {},
            },
          });
        }).to.throw('Invalid configuration.');
      });
    });
  });
});
