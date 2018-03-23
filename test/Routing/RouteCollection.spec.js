'use strict';

const { expect } = require('chai');
const { RouteCollection, Route } = require('../../index.js');

describe('RouteCollection', () => {


  it('can add and retrieve routes', () => {
    const route1 = new Route('/foo');
    const route2 = new Route('/bar');

    const routes = new RouteCollection();
    routes.add('foo_index', route1);
    routes.add('bar_index', route2);

    expect(routes.all()).to.be.an('object').that.has.all.keys('foo_index', 'bar_index');
    expect(routes.all().foo_index.getPattern()).to.equal('/foo');
    expect(routes.get('foo_index').getPattern()).to.equal('/foo');
  });

  it('can add routes from other collections', () => {
    const route1 = new Route('/foo');
    const route2 = new Route('/bar');
    const route3 = new Route('/baz');

    const routes = new RouteCollection();
    routes.add('foo_index', route1);
    routes.add('bar_index', route2);

    const routes2 = new RouteCollection();
    routes2.add('baz_index', route3);

    routes.addCollection(routes2);

    expect(routes.all()).to.be.an('object').that.has.all.keys('foo_index', 'bar_index', 'baz_index');
    expect(routes.all().baz_index.getPattern()).to.equal('/baz');
  });

  it('can add a route prefix', () => {
    const route1 = new Route('/foo');
    const route2 = new Route('/bar');

    const routes = new RouteCollection();
    routes.add('foo_index', route1);
    routes.add('bar_index', route2);

    routes.addPrefix('/base');

    expect(routes.all()).to.be.an('object').that.has.all.keys('foo_index', 'bar_index');
    expect(routes.all().foo_index.getPattern()).to.equal('/base/foo');
  });

  it('can add middleware', () => {
    const route1 = new Route('/foo');
    const route2 = new Route('/bar');

    const routes = new RouteCollection();
    routes.add('foo_index', route1);
    routes.add('bar_index', route2);

    const thismiddleware = (req, res, next) => {};
    function thatmiddleware(req, res, next) {}

    routes.addMiddleware(thismiddleware);
    routes.addMiddleware(thatmiddleware);

    expect(routes.get('bar_index').getMiddleware()[0]).to.equal(thismiddleware);
    expect(routes.get('foo_index').getMiddleware()[1]).to.equal(thatmiddleware);
  });

  it('can add all middleware', () => {
    const route1 = new Route('/foo');
    const route2 = new Route('/bar');

    const routes = new RouteCollection();
    routes.add('foo_index', route1);
    routes.add('bar_index', route2);

    const thismiddleware = (req, res, next) => {};
    function thatmiddleware(req, res, next) {}

    routes.addAllMiddleware([thismiddleware, thatmiddleware]);

    expect(routes.get('bar_index').getMiddleware()[0]).to.equal(thismiddleware);
    expect(routes.get('foo_index').getMiddleware()[1]).to.equal(thatmiddleware);
  });

  it('can prepend middleware', () => {
    const route1 = new Route('/foo');
    const route2 = new Route('/bar');

    const routes = new RouteCollection();
    routes.add('foo_index', route1);
    routes.add('bar_index', route2);

    const thismiddleware = (req, res, next) => {};
    function thatmiddleware(req, res, next) {}
    function theremiddleware(req, res, next) {}

    routes.addMiddleware(thismiddleware);
    routes.addMiddleware(thatmiddleware);
    routes.prependMiddleware(theremiddleware);

    expect(routes.get('foo_index').getMiddleware()[0]).to.equal(theremiddleware);
    expect(routes.get('bar_index').getMiddleware()[1]).to.equal(thismiddleware);
    expect(routes.get('foo_index').getMiddleware()[2]).to.equal(thatmiddleware);
  });

  it('can prepend all middleware', () => {
    const route1 = new Route('/foo');
    const route2 = new Route('/bar');

    const routes = new RouteCollection();
    routes.add('foo_index', route1);
    routes.add('bar_index', route2);

    const thismiddleware = (req, res, next) => {};
    function thatmiddleware(req, res, next) {}
    function theremiddleware(req, res, next) {}
    function thosemiddleware(req, res, next) {}

    routes.addAllMiddleware([thismiddleware, thatmiddleware]);
    routes.prependAllMiddleware([theremiddleware, thosemiddleware]);

    expect(routes.get('foo_index').getMiddleware()[0]).to.equal(theremiddleware);
    expect(routes.get('bar_index').getMiddleware()[1]).to.equal(thosemiddleware);
    expect(routes.get('foo_index').getMiddleware()[2]).to.equal(thismiddleware);
    expect(routes.get('foo_index').getMiddleware()[3]).to.equal(thatmiddleware);
  });

  it('can add parameter converters', () => {
    const route1 = new Route('/foo');
    const route2 = new Route('/bar');

    const routes = new RouteCollection();
    routes.add('foo_index', route1);
    routes.add('bar_index', route2);

    const thisparameterconverter = (req, res, next, id) => {};
    function thatparameterconverter(req, res, next, id) {}

    routes.addParameterConverter('this', thisparameterconverter);
    routes.addParameterConverter('that', thatparameterconverter);

    expect(routes.get('bar_index').getParameterConverters()[0].parameter_converter).to.equal(thisparameterconverter);
    expect(routes.get('foo_index').getParameterConverters()[1].parameter_converter).to.equal(thatparameterconverter);
  });

  it('inherits prefixes, middleware, and parameter converters from added route-collections', () => {
    const route1 = new Route('/foo');
    const route2 = new Route('/bar');
    const route3 = new Route('/baz');

    const middle1 = (req, res, next) => {};
    const middle2 = (req, res, next) => {};

    const param1 = (req, res, next, id) => {};
    const param2 = (req, res, next, id) => {};

    const route_collection1 = new RouteCollection();
    route_collection1.add('route1', route1);
    route_collection1.add('route2', route2);

    const route_collection2 = new RouteCollection();
    route_collection2.add('route3', route3);
  });

});
