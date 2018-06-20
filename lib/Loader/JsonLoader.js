'use strict';

const RouteCollectionBuilder = require('../Routing/RouteCollectionBuilder');

class JsonLoader {
  constructor(route_registry, container = null) {
    this.route_registry = route_registry;
    this.container = container;
  }

  load(json_document) {
    const route_collection = this._routeCollectionBuilder(json_document);
    Object.keys(route_collection.all()).forEach(route_name => {
      const route = route_collection.get(route_name);
      this.route_registry.addRoute(route);
    });
  }

  _routeCollectionBuilder(configuration) {
    const builder = new RouteCollectionBuilder(configuration);
    if (this.container) {
      builder.setContainer(this.container);
    }

    return builder.build();
  }
}
module.exports = JsonLoader;
