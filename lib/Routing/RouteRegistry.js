'use strict';

const RouteRegistryError = require('./RouteRegistryError');

class RouteRegistry {
  constructor() {
    this.routes = [];
    this.routes_by_name = {};
    this.routes_by_canonical_path = {};
  }

  // HACK TEMPORARY
  setContainer(container) {
    this.container = container;
  }

  add(route_name, route) {
    const methods = route.getMethods();
    const canonical_path = route.getCanonicalRoutePath();

    methods.forEach(method => {
      const method_path = `${method} ${canonical_path}`;
      // A method path collision warns when two routes have the exact same method + canonical path. This is
      // dangerous as it may be unclear which of the two routes an inbound path will match.
      //
      // NOTE: There is a valid use case for this; when two paths have the same canonical parameters but
      //       different requirements (such as \\d+ or string1|string2 or other regexp). My suggestion
      //       for this is to simply name the parameters different things, e.g:
      //       '/foo/:id(\\d+)' vs '/foo/:slug([a-zA-z]+)'
      if (method_path in this.routes_by_canonical_path) {
        throw new RouteRegistryError(
          'route_registry_path_collision',
          `Route canonical path collision on: "${method_path}".`
        );
      }
      this.routes_by_canonical_path[method_path] = route;
    });

    // A route name collision happens when two routes share the same name. This most often occurs when two
    // routes share the exact same controller action. The route builder cannot name method-paths yet so the
    // workaround is to point them at different controller methods that call common code.
    if (route_name in this.routes_by_name) {
      throw new RouteRegistryError('route_registry_name_collision', `Route name collision on: "${route_name}".`);
    }
    this.routes_by_name[route_name] = route;

    this.routes.push(route);
  }

  addRoute(route) {
    // FIXME; Right now a "route collision" will happen if multiple routes point at the
    //        same action. Maybe could also use a canonicalized route path as the key
    //        instead of the route name?
    //        maybe use the canonical route path to generate the route name?
    const route_name = route.getName();

    this.add(route_name, route);
  }

  /**
   * Returns all routes
   */
  getAll() {
    return this.routes;
  }

  generate(route_name, parameters) {
    if (!(route_name in this.routes_by_name)) {
      throw new RouteRegistryError('route_registry_generate_no_such_route', `No such route exists: ${route_name}.`);
    }
    return this.routes_by_name[route_name].generate(parameters);
  }

  registerAll(express_router) {
    this.routes.forEach(route => {
      route.register(express_router);
    });
  }

  match(path) {
    return this.routes.find(route => {
      return route.isMatch(path);
    });
  }

  /**
   * FIXME; additional features:
   *
   * 1) Ability to send an Object to a GET/POST/PATCH... in order to send controller/action and name and method-specific
   * middleware.
   *
   * 2) Detect unused configuration keys and warn
   *
   * 3) Register controller service ids to GET/POST/PATCH
   *
   * 4) Register a controller at top level and inherit to descendants so they only need to provide the action
   *
   * 5) Register error handlers
   */
  routeBuilder(configuration) {
    const route_collection = this.routeCollectionBuilder(configuration);
    Object.keys(route_collection.all()).forEach(route_name => {
      const route = route_collection.get(route_name);
      this.addRoute(route);
    });
  }

  routeCollectionBuilder(configuration) {
    // const root = new RouteCollection();
    // this._recursiveRouteBuilder_new(configuration, root);
    // return root;
    const builder = new (require('./RouteCollectionBuilder'))(configuration);
    if (this.container) {
      builder.setContainer(this.container);
    }

    return builder.build();
  }
}

module.exports = RouteRegistry;
