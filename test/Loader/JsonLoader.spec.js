'use strict';

const { expect } = require('chai');
const JsonLoader = require('../../lib/Loader/JsonLoader');
const RouteRegistry = require('../../lib/Routing/RouteRegistry');


describe('JsonLoader', function() {
  describe('without the container', function() {
    it('can load basic documents', function() {
      const route_registry = new RouteRegistry();
      const loader = new JsonLoader(route_registry);

      loader.load({
        '/foo': {
          get: function aaaa(req, res, next) {
            res.render('yes!');
          },
          post: function bbbb(req, res, next) {
            res.render('no!');
          }
        }
      });

      expect(route_registry.getAll()).to.be.an('Array').that.has.length(2);
    });

    it('can load routes with priorities', function() {
      const route_registry = new RouteRegistry();
      const loader = new JsonLoader(route_registry);

      loader.load({
        '/:wildcard1': {
          get: function zzzz(req, res, next) {
            res.render('no!');
          },
        },
        '/:wildcard2': {
          priority: 99,
          get: function aaaa(req, res, next) {
            res.render('yes!');
          },
        },
      });

      expect(route_registry.getAll()).to.be.an('Array').that.has.length(2);

      expect(route_registry.getAll()[0].getPriority()).to.equal(0);
      expect(route_registry.getAll()[1].getPriority()).to.equal(99);


      expect(route_registry.matchAll('/aaa')).to.be.an('Array').that.has.length(2);

      // Normally, wildcard1 would get fired first, due to the order it is registered. But priority 99 makes wildcard2 go first!
      expect(route_registry.match('/aaa').getPattern()).to.equal('/:wildcard2');
    });
  });

  describe('with the service container', function() {
    it('can load controllers with service ids (legacy)', function() {
      const route_registry = new RouteRegistry();
      const service_container = require('../../test_server/container');
      const loader = new JsonLoader(route_registry, service_container);

      loader.load({
        '/foo': {
          get: {
            service_id: 'helloworld_controller',
            action: 'index_action',
          }
        }
      });

      expect(route_registry.getAll()).to.be.an('Array').that.has.length(1);
    });

    it('can load controllers with service ids (@-sign)', function() {
      const route_registry = new RouteRegistry();
      const service_container = require('../../test_server/container');
      const loader = new JsonLoader(route_registry, service_container);

      loader.load({
        '/foo': {
          get: {
            service_id: '@helloworld_controller',
            action: 'index_action',
          }
        }
      });

      expect(route_registry.getAll()).to.be.an('Array').that.has.length(1);
    });

    it('can load middleware, error handlers, and parameter converters as service ids', function() {
      const route_registry = new RouteRegistry();
      const service_container = require('../../test_server/container');
      const loader = new JsonLoader(route_registry, service_container);

      loader.load({
        '/foo/:id': {
          error: '@error.sample',
          param: [ 'id', '@param.sample' ],
          middleware: '@middleware.sample',
          get: {
            service_id: '@helloworld_controller',
            action: 'index_action',
            name: 'aaaaaaaaaa',
          }
        }
      });

      expect(route_registry.getAll()).to.be.an('Array').that.has.length(1);

      const route = route_registry.getAll()[0];

      expect(route.getName()).to.equal('aaaaaaaaaa');
      expect(route.getMethods()).to.deep.equal(['get']);
      expect(route.getMiddleware()).to.be.an('Array').that.has.length(1);
      expect(route.getParameterConverters()).to.be.an('Array').that.has.length(1);
      expect(route.getErrorHandlers()).to.be.an('Array').that.has.length(1);
    });
  });
});
