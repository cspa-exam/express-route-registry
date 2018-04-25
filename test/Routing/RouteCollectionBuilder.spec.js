'use strict';

const { expect } = require('chai');
const { RouteBuilder, RouteRegistry } = require('../../index.js');

const RouteCollectionBuilder = require('../../lib/Routing/RouteCollectionBuilder');
const RouteCollection = require('../../lib/Routing/RouteCollection');
const Route = require('../../lib/Routing/Route');

const { ServiceContainer } = require('service-container');


describe('RouteCollectionBuilder', () => {

  describe('#build()', () => {
    it('builds the route collection on a happy case', () => {
      const configuration = {
        '/foo': {
          get: (req, res, next) => {},
        }
      };
      const builder = new RouteCollectionBuilder(configuration);
      const routes = builder.build();

      expect(routes).to.be.an.instanceof(RouteCollection);
      expect(routes.get('get')).to.be.an.instanceof(Route);
      expect(routes.get('get').getPattern()).to.equal('/foo');
    });
  });

  describe('named routes', () => {
    it('can build named routes', () => {
      const configuration = {
        '/foo': {
          get: { name: 'foo_get', action: (req, res, next) => {} },
          post: { name: 'foo_post', action: (req, res, next) => {} },
        }
      };
      const builder = new RouteCollectionBuilder(configuration);
      const routes = builder.build();

      expect(routes).to.be.an.instanceof(RouteCollection);
      expect(routes.get('foo_get')).to.be.an.instanceof(Route);
      expect(routes.get('foo_post')).to.be.an.instanceof(Route);
      expect(routes.get('foo_post').getPattern()).to.equal('/foo');
    });
  });

  describe('#_extractTraits()', () => {
    it('correctly extracts top-level traits', () => {
      const configuration = {
        traits: {
          secure: {
            middleware: (req, res, next) => {}
          }
        },
        '/foo': {
          get: (req, res, next) => {},
        }
      };
      const builder = new RouteCollectionBuilder(configuration);
      builder._extractTraits(configuration);

      expect(builder.traits).to.be.an('object').that.has.all.keys('secure');
    });

    it('errors when traits are registered at non-top-level configuration nodes', () => {
      const configuration = {
        '/foo': {
          traits: {
            secure: {
              middleware: (req, res, next) => {}
            }
          },
          get: (req, res, next) => {},
        }
      };
      const builder = new RouteCollectionBuilder(configuration);

      expect(() => builder._extractTraits(configuration['/foo'])).to.throw();
    });
  });

  describe('#_extractInheritedTraits()', () => {
    it('correctly inherits traits', () => {
      const configuration = {
        traits: {
          secure: {
            middleware: (req, res, next) => {}
          }
        },
        '/foo': {
          is: [ 'secure' ],
          get: { name: 'foo', action: (req, res, next) => {}},
        }
      };
      const builder = new RouteCollectionBuilder(configuration);
      const routes = builder.build(configuration);

      expect(routes.get('foo').getMiddleware()).to.be.an('array').that.has.length(1);
    });

    it('inherits traits after explicitly defined middleware', () => {
      const m1 = (req, res, next) => {};
      const m2 = (req, res, next) => {};
      const m3 = (req, res, next) => {};
      const m4 = (req, res, next) => {};
      const m5 = (req, res, next) => {};
      const m6 = (req, res, next) => {};

      const configuration = {
        traits: {
          secure: {
            middleware: [ m3, m4 ],
          }
        },
        middleware: [ m1, m2 ],
        '/foo': {
          is: [ 'secure' ],
          middleware: [ m5, m6 ],
          get: { name: 'foo', action: (req, res, next) => {}},
        }
      };
      const builder = new RouteCollectionBuilder(configuration);
      const routes = builder.build(configuration);

      expect(routes.get('foo').getMiddleware()).to.be.an('array').that.has.length(6);
      expect(routes.get('foo').getMiddleware()[0]).to.equal(m1);
      expect(routes.get('foo').getMiddleware()[1]).to.equal(m2);
      expect(routes.get('foo').getMiddleware()[2]).to.equal(m3);
      expect(routes.get('foo').getMiddleware()[3]).to.equal(m4);
      expect(routes.get('foo').getMiddleware()[4]).to.equal(m5);
      expect(routes.get('foo').getMiddleware()[5]).to.equal(m6);
    });
  });
});
