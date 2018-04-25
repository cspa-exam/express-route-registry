'use strict';

const RouteRegistryError = require('./RouteRegistryError');
const RouteBuilder = require('./RouteBuilder');
const RouteCollection = require('./RouteCollection');

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
    const root = new RouteCollection();
    this._recursiveRouteBuilder_new(configuration, root);
    return root;
  }

  /**
   * Uses the given configuration to create a new RouteCollection which is mounted on the given root_collection,
   * with the given routing prefix.
   */
  _recursiveRouteBuilder_new(configuration, root_collection, prefix = '') {
    const this_collection = new RouteCollection();

    // First, add all of the routes to this collection
    ['get', 'post', 'delete', 'put', 'patch'].forEach(method => {
      if (method in configuration) {
        const route_destination = configuration[method];
        const route_builder = RouteBuilder[method](''); // FIXME (derek) we probably do not need the RouteBuilder anymore

        const route = (() => {
          // Type 1: Simple. We just specify a controller function with (req, res, next) as args.
          if ('function' === typeof route_destination) {
            return route_builder.toAction(route_destination);
          }

          // Type 2: It's an array with 2 elements.
          else if (Array.isArray(route_destination)) {
            if ('string' === typeof route_destination[0]) {
              if (!this.container) {
                throw new RouteRegistryError('route_registry_container_missing_array', 'Container not yet initialized.');
              }
              const service = this.container.get(route_destination[0]);
              return route_builder.toServiceAction(service, route_destination[1], route_destination[0]);
            } else {
              return route_builder.toControllerAction(route_destination[0], route_destination[1]);
            }
          }

          // Type 3: It's a configuration object with keys
          else if ('object' === typeof route_destination) {
            if ('name' in route_destination) {
              route_builder.named(route_destination.name);
            }
            if ('middleware' in route_destination) {
              route_builder.with(route_destination.middleware);
            }

            if ('service_id' in route_destination) {
              if (!this.container) {
               throw new RouteRegistryError('route_registry_container_missing_id', 'Container not yet initialized.');
              }
              const service = this.container.get(route_destination.service_id);
              return route_builder.toServiceAction(service, route_destination.action, route_destination.service_id);
            }
            else if ('controller' in route_destination) {
              return route_builder.toControllerAction(route_destination.controller, route_destination.action);
            } else {
              return route_builder.toAction(route_destination.action);
            }
          }

          // Else we don't know what it is
          else {
            throw new RouteRegistryError('route_registry_invalid_action', 'Invalid action specified.');
          }
        })();

        this_collection.add(route.getName(), route);
      }
    });

    // Next, recursively construct and add all sub-collections
    // This is done BEFORE middleware/parameter converters are set so that the sub-routes can properly
    // inherit middleware.
    Object.keys(configuration).forEach(_key => {
      if (_key.startsWith('/')) {
        const next_configuration = configuration[_key];
        this._recursiveRouteBuilder_new(next_configuration, this_collection, _key);
      }
    });

    // We have all the routes registered by this point. Here we begin to add features that are common to
    // or inherited by all routes in and below this current route collection.

    // Route prefix
    this_collection.addPrefix(prefix);

    // Middleware
    if ('middleware' in configuration) {
      // Middleware has to be PREPENDED, because middleware that is higher up no the recursion chain is fired FIRST,
      // with middleware that is more specific to each individual route being fired LAST (because such middleware may
      // depend on generalized contexts set up by the upper-level middleware.
      if (Array.isArray(configuration.middleware)) {
        this_collection.prependAllMiddleware(configuration.middleware);
      } else {
        this_collection.prependMiddleware(configuration.middleware);
      }
    }

    // Parameter converters
    if ('param' in configuration) {
      /**
       * Helper function
       */
      const addParameterConverter = (param, collection) => {
        // Case 1; it's [ id, func ]
        if (Array.isArray(param)
          && typeof param[0] === 'string'
          && typeof param[1] === 'function') {
          const id = param[0];
          const parameter_converter = param[1];
          collection.addParameterConverter(id, parameter_converter);
        }
        // Case 2; it's { id, parameter_converter }
        else if ((typeof param === 'object') && ('id' in param) && ('parameter_converter' in param)) {
          collection.addParameterConverter(param.id, param.parameter_converter);
        }
        else {
          throw new RouteRegistryError('route_registry_invalid_configuration', 'Invalid configuration.');
        }
      };

      const param = configuration.param;
      // param can either be a single parameter converter or an array of them
      if (Array.isArray(param) && !(typeof param[0] === 'string' && typeof param[1] === 'function')) {
        param.forEach(_param => addParameterConverter(_param, this_collection));
      } else {
        addParameterConverter(param, this_collection);
      }
    }

    // Error handlers
    if ('error' in configuration) {
      const error = configuration.error;
      // error can either be a single error handler or an array of them
      // Error handlers are fired in the OPPOSITE order of middleware. Bottom-level route-specific error handlers
      // should be fired first as specific routes may opt to override the more general top-level error handling.
      if (Array.isArray(error)) {
        this_collection.addAllErrorHandlers(error);
      } else {
        this_collection.addErrorHandler(error);
      }
    }

    // Great, we're done constructing this route collection; append it to the parent
    root_collection.addCollection(this_collection);
  }
}

module.exports = RouteRegistry;
