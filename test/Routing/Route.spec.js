'use strict';

const { expect } = require('chai');
const { RouteBuilder, Route } = require('../../index.js');

describe('Route', () => {
  const dummy_action = (req, res, next) => res.send('hello');

  describe('canonical route path', () => {
    it('generates the correct canonical path for simple routes', () => {
      const route = RouteBuilder.get('/foo').to(dummy_action);

      expect(route.getCanonicalRoutePath()).to.equal('/foo');
    });

    it('generates the correct canonical path for routes with named parameters', () => {
      const route = RouteBuilder.get('/foo/:slug').to(dummy_action);

      expect(route.getCanonicalRoutePath()).to.equal('/foo/:slug');
    });

    it('generates the correct canonical path for routes with multiple named parameters within single directory', () => {
      const route = RouteBuilder.get('/foo/:from([a-z])-:to([a-z])').to(dummy_action);

      expect(route.getCanonicalRoutePath()).to.equal('/foo/:from-:to');
    });

    it('generates the correct canonical path for routes with unnamed parameters', () => {
      const route = RouteBuilder.get('/foo/(\\d+)/bar/([a-zA-Z]+)').to(dummy_action);

      expect(route.getCanonicalRoutePath()).to.equal('/foo/:0/bar/:1');
    });

    it('generates the correct canonical path for routes with optional parameters', () => {
      const route = RouteBuilder.get('/foo/:id(\\d+)/bar(/:slug(\\s+))?').to(dummy_action);

      expect(route.getCanonicalRoutePath()).to.equal('/foo/:id/bar(/:slug)?');
    });

    it('generates the correct canonical path for routes with multiple named parameters', () => {
      const route = RouteBuilder.get('/foo/:slug/bar/:slag').to(dummy_action);

      expect(route.getCanonicalRoutePath()).to.equal('/foo/:slug/bar/:slag');
    });

    it('generates the correct canonical path for routes with named parameters with requirements', () => {
      const route = RouteBuilder.get('/foo/:id(\\d+)/bar/:slug(\\s+)').to(dummy_action);

      expect(route.getCanonicalRoutePath()).to.equal('/foo/:id/bar/:slug');
    });

    // pathToRegexp actually doesnt support regexp at all; only strings
    it.skip('generates the correct canonical path for regexp expressions', () => {
      const route = RouteBuilder.get(/^\/exam\/?/).to(dummy_action);
    });
  });

  describe('route naming', () => {
    it('generates the correct name for anonymous routes', () => {
      const r = RouteBuilder.post('/foo/bar').to((req, res, next) => res.send('Hello'));

      expect(r.getName()).to.equal('post_foobar');
    });

    it('generates the correct name for anonymous routes with parameters', () => {
      const r = RouteBuilder.post('/foo/bar/:id/:other(\\d+)').to((req, res, next) => res.send('!!!'));

      expect(r.getName()).to.equal('post_foobar_id_other');
    });

    it('generates the correct name for function actions', () => {
      const action = function that_action(req, res, next) { res.send('Hello') };
      const r = RouteBuilder.post('/foo/bar').to(action);

      expect(r.getName()).to.equal('that_action');
    });

    it('generates the correct name for static controller actions', () => {
      class OldController {
        static that_action(req, res, next) {
          res.send('Hello');
        }
      }
      const r = RouteBuilder.post('/foo/bar').to(OldController.that_action);

      expect(r.getName()).to.equal('that_action');
    });

    it('generates the correct name for named routes', () => {
      const r = RouteBuilder.post('/foo/bar/:id/:other(\\d+)')
        .named('hello_world')
        .to(dummy_action);

      expect(r.getName()).to.equal('hello_world');
    });

    it('generates the correct name for controller actions', () => {
      class Controller {
        that_action(req, res, next) {
          res.send('Hello');
        }
      }
      const controller = new Controller();
      const action = 'that_action';
      const r = RouteBuilder.post('/foo/bar').to(controller, action);

      expect(r.getName()).to.equal('controller_that_action');
    });
  });

  describe('expressjs registration', () => {
    it('registers properly', () => {
      const action = (req, res, next) => res.send('Hello');
      const r = RouteBuilder.post('/foo/bar').to(action);
      const express = {
        get: () => expect.fail('WRONG!'),
        post: function() { // use function() to bind 'arguments'
          // Note arguments is not an array; only array-like
          expect(arguments).to.have.all.keys(0, 1); // Path + action
          expect(arguments[0]).to.equal('/foo/bar');
          expect(arguments[1]).to.equal(action);
        },
      };

      r.register(express);
    });

    it('registers with controller', () => {
      class Controller {
        that_action(req, res, next) {
          res.send('Hello');
        }
      }
      const controller = new Controller();
      const action = 'that_action';
      const r = RouteBuilder.post('/foo/bar').to(controller, action);
      const express = {
        get: () => expect.fail('WRONG!'),
        post: function() { // use function() to bind 'arguments'
          // Note arguments is not an array; only array-like
          expect(arguments).to.have.all.keys(0, 1); // Path + action
          expect(arguments[0]).to.equal('/foo/bar');

          // They're not actually the function anymore since the Route re-binds the controller action
          // expect(arguments[1]).to.equal(controller.that_action);
        },
      };

      r.register(express);
    });

    it('registers properly with middleware', () => {
      const middle1 = (req, res, next) => { return 'yay' };
      const middle2 = (req, res, next) => { return 'yay2' };
      const middle3 = (req, res, next) => { return 'yay2' };
      const action = (req, res, next) => res.send('Hello');

      const r = RouteBuilder.post('/foo/bar')
        .with(middle1)
        .with(middle2, middle3)
        .to(action);
      const express = {
        get: () => expect.fail('WRONG!'),
        post: function() { // use function() to bind 'arguments'
          // Note arguments is not an array; only array-like
          expect(arguments).to.have.all.keys(0, 1, 2, 3, 4); // Path + 3 middleware + action
          expect(arguments[0]).to.equal('/foo/bar');
          expect(arguments[1]).to.equal(middle1);
          expect(arguments[2]).to.equal(middle2);
          expect(arguments[3]).to.equal(middle3); // Ordering here matters!!!
          expect(arguments[4]).to.equal(action);
        },
      };

      r.register(express);
    });

    it.skip('registers properly with parameter converter', () => {
      // It is currently not easy to test this as it has an internal dependency on express
    });
  });

  describe('route generation', () => {
    it('can generate parameterless routes', () => {
      const r = RouteBuilder.get('/foo/bar').to(dummy_action);

      expect(r.generate()).to.equal('/foo/bar');
    });

    it('can generate routes with named parameters', () => {
      const r = RouteBuilder.get('/foo/:id/bar/:baz').to(dummy_action);

      expect(r.generate({id:1, baz:2})).to.equal('/foo/1/bar/2');
    });

    it('can generate routes with unnamed parameters', () => {
      const r = RouteBuilder.get('/foo/(\\d+)/bar/(\\d+)').to(dummy_action);

      expect(r.generate({'0': 1, '1': 2})).to.equal('/foo/1/bar/2');
    });

    it('can generate routes with optional parameters', () => {
      const r = RouteBuilder.get('/foo/:id/bar/:baz?').to(dummy_action);

      expect(r.generate({id:1})).to.equal('/foo/1/bar');
      expect(r.generate({id:1, baz:2})).to.equal('/foo/1/bar/2');
    });

    it('can generate routes with optional, unnamed parameters', () => {
      const r = RouteBuilder.get('/foo/(\\d+)/bar/(\\d+)?').to(dummy_action);

      expect(r.generate({'0': 1})).to.equal('/foo/1/bar');
      expect(r.generate({'0': 1, '1': 2})).to.equal('/foo/1/bar/2');
    });

    it('can generate routes with optional parameters', () => {
      const r = RouteBuilder.get('/foo/:id/bar(/:baz)?').to(dummy_action);

      expect(r.generate({id:1})).to.equal('/foo/1/bar');
    });

    it('throws exception when missing parameters', () => {
      const r = RouteBuilder.get('/foo/:id/bar/:baz').to(dummy_action);

      expect(() => r.generate({id:1})).to.throw('Expected "baz" to be a string');
    });

    it('throws exception on parameter violations', () => {
      const r = RouteBuilder.get('/foo/:id(\\d+)').to(dummy_action);

      expect(() => r.generate({id: 'a'})).to.throw('Expected "id" to match "\\d+", but got "a"');
    });
  });

  describe('route matching', () => {
    it('can match', () => {
      const r = RouteBuilder.get('/foo/:id(\\d+)').to(dummy_action);

      expect(r.isMatch('/foo/3')).to.be.true;
      expect(r.isMatch('/foo/a')).to.be.false;
      expect(r.isMatch('/bar/3')).to.be.false;
    });
  });
});
