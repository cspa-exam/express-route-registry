'use strict';

const { ContainerAware } = require('service-container');

/**
 * The generic application controller. It is ContainerAware so the service container will automatically
 * inject itself.
 */
class Controller extends ContainerAware {
  generateUrl(route_name, parameters = {}) {
    return this.get('app.route_registry').generate(route_name, parameters);
  }

  get(service_id) {
    return this.container.get(service_id);
  }
}

module.exports = Controller;
