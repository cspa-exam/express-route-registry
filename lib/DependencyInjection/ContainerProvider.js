'use strict';

const RouteRegistryError = require('../Routing/RouteRegistryError');

class ContainerProvider {

  constructor() {
    this.service_container_library = false;
  }

  use(service_container_lib) {
    if (!('ServiceContainer' in service_container_lib)) {
      throw new RouteRegistryError(
        'container_provider_invalid_arg',
        `Are you sure you use()'d the 'service-container' lib?`
      );
    }
    this.service_container_library = service_container_lib;
  }

  getAll() {
    if (!this.service_container_library) {
      throw new RouteRegistryError(
        'container_not_linked',
        'Cannot use this feature as no service-container library has been linked'
      );
    }
    return this.service_container_library;
  }

  get(definition) {
    const all = this.getAll();
    if (!(definition in all)) {
      throw new RouteRegistryError(
        'container_missing_definition',
        `The linked container library seems to be missing the ${definition} class definition`
      );
    }
    return all[definition];
  }
}
module.exports = new ContainerProvider();
