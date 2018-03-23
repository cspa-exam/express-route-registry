# Routing Framework

## Overview
Documents how to use the routing framework and its various features.


## Motivations

### ExpressJS is hard to use for large applications
Particularly, it's really hard to tell which middleware is hit for which route. ExpressJS recommends
nesting routers on top of each other, which is hard to do correctly as it is really easy to accidentally
nest them in a manner that bleeds Middleware into unintended routes.


### Make Controller Management easy
ExpressJS's official documentation recommends the use of anonymous functions

```javascript
app.get((req, res, next) => {
  // ...
});
```

This sucks (in my opinion) as it tangles your Express App with application code, which is all an amalgamation
of anonymous functions. This is hard to trace and super hard to read and even harder to test.

Better is to write Controller classes that are compatible with IoC principles and are decoupled from ExpressJS
classes entirely. Test and bulletproof the controllers, then mount them on the ExpressJS router for ease of 
understanding and ease of flexibility.


### It's really hard to figure out where a route goes
ExpressJS doesn't really have a way for you to determine where a route goes... (wtf why?)


### Name and Generate Routes
It's annoying to maintain a bunch of hard-coded routes in your application. Much better is to name routes
and generate the URLs dynamically. That way, you can change URLs without messing up your entire application.


### Symfony was pretty great when I used it
PHP had its problems but SensioLabs's Symfony Framework was rock solid.


### The RAML Spec is a great way to conceptualize URLs and resources
[The RAML Spec](https://github.com/raml-org/raml-spec/blob/master/versions/raml-10/raml-10.md/)

^-- In my opinion.


# How to use

## The RouteRegistry
The RouteRegistry is a single point where all routing configurations are stored.

```javascript
const { RouteRegistry } = require('express-route-registry');
```

## The RouteBuilder
While there are a few ways of registering routes, the recommended method is to use the RouteBuilder. 
This is a method on the RouteRegistry:

```javascript
RouteRegistry.routeBuilder({
  /* .. configuration .. */
});
```

## Registering your first Route
Simple! The syntax looks very similar to the RAML spec:

```javascript
RouteRegistry.routeBuilder({
  '/route': {
    get: (req, res, next) => { /* ... */ },
  }
});
```

THe `/route` node is called a "routing prefix". Under routing prefixes, keys of any lower-cased HTTP method 
(i.e. "get", "post", "delete", "put", "patch") are associated with the respective Express route method.

Thus, the above code will attach the given request handler to `GET /route`, exactly like doing this:

```javascript
expressApp.get('/route', (req, res, next) => { /* ... */ });
```

## Middleware
Adding middleware

```javascript
RouteRegistry.routeBuilder({
  '/route': {
    get: {
      middleware: myMiddleware,
      action: (req, res, next) => { /* ... */ },
    },
  }
});
```

Is the same as...

```javascript
expressApp.get('/route', myMiddleware, (req, res, next) => { /* ... */ });
```

Hm, but this seems to be more code than before? Isn't this harder to maintain? Well, read on... 


## Parameter Converters
Parameter converters are where things get interesting. The default ExpressJS `.param()` function is useful 
but is super hard to understand and use correctly without bleeding. Consider the following case (as recommemnded
by the [Express Documentation](http://expressjs.com/en/api.html#app.param)):

```javascript
app.param('id', function (req, res, next, id) {
  /* ... */
});
 
app.get('/user/:id', function (req, res, next) {
  /* ... */
});
```

What if you added the following route below?

```javascript
app.get('/order/:id', (req, res, next) => {
  /* ... */
})
```

The issue with the `.param()` method is the same with middleware; it can _bleed_ into unintended routes. The 
workaround for this is super annoying:

```javascript
const router1 = express.Router();
router1.param('id', function() { /* ... */ });
router1.get('/user/:id', () => { /* ... */ });
 
const router2 = express.router();
router2.get('/order/:id', () => { /* ... */ });
 
app.use(router1);
app.use(router2);
```

Using the routeBuilder, we can do the same thing much more simply (and in a manner that is easier to understand).

```javascript
RouteRegistry.routeBuilder({
  '/user/:id': {
    param: [ 'id', (req, res, next) => { /* ... */ }],
    get: (req, res, next) => { /* ... */ }
  },
  '/order/:id': {
    get: (req, res, next) => { /* ... */ }
  },
});
```

It becomes clear that the parameter converter applies **only** to routes under the `/user/:id` prefix. This 
improves even more as we are introduced to nesting routes...

## Nesting Routes
Commonly, clusters of routes with similar requirements will be gathered under similar resources. 
Consider the following example:

```javascript
GET     /api/index
GET     /api/users
GET     /api/users/:id
POST    /api/users/:id/orders
DELETE  /api/users/:id/orders
PATCH   /api/users/:id/orders
GET     /api/users/:id/orders
GET     /api/orders/:id
GET     /api/orders/:id/products
GET     /api/products/:id
```

All of these routes would (probably) be subject to some common authentication middleware. Additionally, all 
routes under `/users` may benefit from a parameter converter, as well as an authorization middleware. The
routes under `/orders`, however, would need a different parameter converter, but with a similar authorization
middleware.

Managing this in vanilla ExpressJS would be a huge pain. I'd illustrate it but it's too much of a pain :)

However, modelling this using our RAML-like syntax is easy to do, and easy to understand!

```javascript
RouteRegistry.routeBuilder({
  '/api': {
    middleware: [ apiAuthenticationMiddleware ],
    '/users': {
      get: [ '...' ],
      
      '/:id': {
        param: [ 'id', userParameterTrigger ],
        middleware: [ isUserAuthorizedMiddleware ],
        
        get: [ '...' ],
        
        '/orders': {
          get: [ '...' ],
          post: [ '...' ],
          delete: [ '...' ],
          patch: [ '...' ],  
        },
      },
    },
    
    '/orders': {
      '/:id': {
        param: [ 'id', orderParameterTrigger ],
        middleware: [ isUserAuthorizedMiddleware ],
        
        get: [ '...' ],
        
        '/products': {
          get: [ '...' ],
        }
      },
    },
    
    '/products': {
      '/:id': {
        param: [ 'id', productParameterTrigger ],
        
        get: [ '...' ],
      }
    }
  },
});
```


## Understanding Middleware and Parameter Converter Inheritance
In our previous example, notice the specific placement of the `middleware` and `param` nodes.

By default, all routes (that is, the targets of `get`, `post`, `patch`, `put`, or `delete` notes), inherit
the following attributes from their direct parent configurations:

* Route Prefixes
* Middleware
* Parameter Converters


The inheritance **ordering** is notably important. Parent values are accepted first. In other words, middleware
on parents is fired before middleware on children. 

This pattern is highly useful for creating global middleware that is shared across many routes (even an entire
application!).


## Opting to Not Inherit Middleware
Sometimes you will have a black sheep route that needs slightly different route configurations. Consider
this example:

```javascript
GET   /user/profile
PUT   /user/profile
GET   /user/image
PUT   /user/image
GET   /user/info
PUT   /user/info
POST  /user/logout
POST  /user/login
```

All of the above routes require a user to be logged in. Using the RAML-like syntax this is easy!

... except when it isn't. It does not make sense for the `POST /user/login` route to require a logged in user.
Never fear, as the syntax still supports it!

```javascript
RouteRegistry.routeBuilder({
  '/user': {
    middleware: requiresLoggedIn, // You can pass either a single middleware OR array of middlewares!
    '/profile': { /* ... */ },
    '/image': { /* ... */ },
    '/info': { /* ... */ },
    '/logout': { /* ... */ },
  },
  
  '/user/login': {
    middleware: [], 
    
    '/login': { /* ... */ },
  },
});
```

In the event you find yourself in an even more corner-case-y situation like this:

```javascript
GET  /user/login
POST /user/login
```

You can use entirely separate routeBuilder configurations:

```javascript
RouteRegistry.routeBuilder({
  '/user/login': {
    get: {
      middleware: requiresLoggedIn,
      action: '...',
    }
  }
});
  
RouteRegistry.routeBuilder({
  '/user/login': {
    post: '...',
  },
});
```


## Avoiding Route Collisions
ExpressJS [condones the overloading of route actions](http://expressjs.com/en/api.html#path-examples) as it
does not enforce a distinction between **middleware** and **route actions**.

This framework enforces the distinction to improve understandability of the code. It does so by **restricting
each route method to at most a single action**.

When configuring using the `routeBuilder`, it will error when the canonical route of two configurations are 
identical:

```javascript
RouteRegistry.routeBuilder({
  '/foo': {
    get: { /* ... */ }
  }
});
  
RouteRegistry.routeBuilder({
  '/foo': {
    get: { /* ... */ }
  }
});
```

The above will crash with an error "Collision on canonical route: GET /foo"

**NOTE:** This collision detection is not perfect and is fooled by route requirements. It cannot tell that
`GET /orders/:id(\\d+)` and `GET /orders/:id[0-9]+` are basically the same.


## Using Controllers
You can attach a controller + action to routes too!

```javascript
class HelloController {
  hello_world_action(req, res, next) { /* ... */ }
}

const controller = new HelloController();
 
RouteRegistry.routeBuilder({
  '/hello-world': {
    get: [ controller, 'hello_world_action' ],
  }
});
```

OR like this:

```javascript
RouteRegistry.routeBuilder({
  '/hello-world': {
    get: { 
      controller: controller,
      action: 'hello_world_action',
    }
  }
});
```

Worried about javascript `this` bindings? No problem; the routeBuilder automatically binds the given 
action to the given controller instance! Nice!


## Using Service Ids
Are you using the `DependencyInjection` component? Even better! You can register an entire dependency-injected
controller simply by using its service id:

```javascript
service_container.autowire('controller_service_id', HelloController);
RouteRegistry.setContainer(service_container);
 
RouteRegistry.routeBuilder({
  '/hello-world': {
    get: [ 'controller_service_id', 'hello_world_action' ],
  }
});
```

OR like this:

```javascript
RouteRegistry.routeBuilder({
  '/hello-world': {
    get: { 
      service_id: 'controller_service_id',
      action: 'hello_world_action',
    }
  }
});
```


## Naming Routes and Generating Urls
Now for even more good stuff. You can name individual routes and then use these unique names to 
dynamically generate URL paths!


```javascript
RouteRegistry.routeBuilder({
  '/foo/:foo_id(\\d+)': {
    get: { 
      name: 'foo_route',
      service_id: 'foobar_controller',
      action: 'foo_action',
    },
    '/bar/:bar_id(\\d+)': {
      post: {
        name: 'foobar_route',
        service_id: 'foobar_controller',
        action: 'foobar_action',
      },
    } 
  }
});

RouteRegistry.generate('foo_route', { foo_id: 4 }); // returns /foo/4
RouteRegistry.generate('foobar_route', { foo_id: 7, bar_id: 99 }); // returns /foo/7/bar/99
RouteRegistry.generate('foobar_route', { }); // Errors: "Missing argument"
```


### Using the Abstract Controller
The above features are exceptionally useful in Controllers when you need to perform redirections or to set 
form actions or what not. The abstract `Controller` class combines the `DependencyInjection` component and 
this `Routing` component to make this super easy.

This is what a your controllers would look like:
```javascript
class MyController extends Controller {
  my_action(req, res, next) {
    this.generateUrl('some_other_route', { foo: 1, bar: 2 }); 
    // etc...
  }
}
```

And how you would register them:
```javascript
service_container.autowire('MyController', MyController).addTag('controller');
```

And you will need one compiler pass:
```javascript
service_container.addCompilerPass(new ControllerCompilerPass());
```
