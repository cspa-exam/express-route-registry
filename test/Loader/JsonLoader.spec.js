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
          }
        }
      });

      expect(route_registry.getAll()).to.be.an('Array').that.has.length(1);

      const route = route_registry.getAll()[0];

      console.log(route);
    });
  });
});
