# connect-composer

> Connect and reuse connect/ express middlewares

[![NPM version](https://badge.fury.io/js/connect-composer.svg)](https://www.npmjs.com/package/connect-composer/)
[![Build Status](https://secure.travis-ci.org/commenthol/connect-composer.svg?branch=master)](https://travis-ci.org/commenthol/connect-composer)

Compose connect/ express compatible middlewares and reuse or extend them.

Features:

* Stack middlewares
* Use connect middlewares without or with [connect][], [express][]
* Trap errors within middlewares using `function (err, req, res, next)` functions
* Safely catch errors within middlewares
* Modify and reuse existing middlewares

## Table of Contents

<!-- !toc (minlevel=2 omit="Table of Contents") -->

* [Description](#description)
  * [Stack Middlewares](#stack-middlewares)
  * [Stack composed middlewares](#stack-composed-middlewares)
  * [Trap and catch errors](#trap-and-catch-errors)
  * [Manipulate and reuse middlewares](#manipulate-and-reuse-middlewares)
* [Example](#example)
* [Methods](#methods)
* [compose() ⇒ <code>function</code>](#compose)
  * [compose.before ⇒ <code>function</code>](#compose.before)
  * [compose.after ⇒ <code>function</code>](#compose.after)
  * [compose.replace ⇒ <code>function</code>](#compose.replace)
  * [compose.remove ⇒ <code>function</code>](#compose.remove)
  * [compose.push ⇒ <code>function</code>](#compose.push)
  * [compose.unshift ⇒ <code>function</code>](#compose.unshift)
  * [compose.decompose(middlewares) ⇒ <code>Array</code>](#compose.decompose)
  * [compose.clone() ⇒ <code>function</code>](#compose.clone)
  * [compose.noop()](#compose.noop)
* [Contribution and License Agreement](#contribution-and-license-agreement)
* [License](#license)
* [References](#references)

<!-- toc! -->

## Description

### Stack Middlewares

This module allows to join middlewares together:

````javascript
var compose = require('connect-composer')
var req = { test: [] }
var res = {}
var middlewares1 = [
  function (req, res, next) { req.test.push('one'); next() },
  function (req, res, next) { req.test.push('two'); next() }
]
var middlewares2 = [
  function (req, res, next) { req.test.push('three'); next() },
  function (req, res, next) { req.test.push('four'); next() }
]
// create a new middleware
var newMiddlewares = compose(middlewares1, middlewares2)
// run new composed middleware
newMiddlewares(req, res, function () {
  console.log(req.test) // < [ 'one', 'two', 'three', 'four' ]
})
````

### Stack composed middlewares

You can also stack composed middlewares:

````javascript
var compose = require('connect-composer')
var req = { test: [] }
var res = {}
// pass as Array
var middlewares1 = compose([
  function (req, res, next) { req.test.push('one'); next() },
  function (req, res, next) { req.test.push('two'); next() }
])
// or by Argument
var newMiddlewares = compose(
  middlewares1,
  function (req, res, next) { req.test.push('three'); next() },
  function (req, res, next) { req.test.push('four'); next() }
)
// run new composed middleware
newMiddlewares(req, res, function () {
  console.log(req.test) // < [ 'one', 'two', 'three', 'four' ]
})
````

### Trap and catch errors

Traps errors and catches errors within middlewares (prevents server from crashing)

````javascript
var compose = require('connect-composer')
var req = { test: [] }
var res = {}
var middlewares = compose(
  function (req, res, next) { req.test.push('one'); next() },
  function (req, res, next) {
    next('badly')           // middleware calls `next` with error parameter
  },
  function (req, res, next) {
    req.test.push('two')    // is never called
    next()
  },
  function (err, req, res, next) { // error is trapped here; function has arity 4
    console.log(err + ' trapped')  // < badly trapped
    next()                  // continue with the processing
  },
  function (req, res, next) { req.test.push('three'); next() },
  function (req, res, next) {
    if (1) throw new Error('another error') // middleware calls `next` with error parameter
    next()
  },
  function (req, res, next) {
    req.test.push('four')   // is never called
    next()
  }
)
// run new composed middleware
middlewares(req, res, function (err) {
  console.log(err)      // < [Error: another error] is catched
  console.log(req.test) // < [ 'one', 'three' ]
})
````

### Manipulate and reuse middlewares

Use the following methods to change an existing composed middleware

* `unshift(middlewares)` prepend middlewares to the front of the stack
* `push(middlewares)` push middlewares to the end of the stack
* `before(selector, middlewares)` insert middlewares before `selector`
* `after(selector, middlewares)` insert middlewares after `selector`
* `replace(selector, middlewares)` replace middlewares with name `selector` with `middlewares`
* `remove(selector)` remove middlewares with name `selector`
* `clone()` clone composed middlewares

````javascript
var compose = require('connect-composer')
var res = {}
var initial = {
  two: function (req, res, next) { req.test.push('two'); next() },
  four: function (req, res, next) { req.test.push('four'); next() }
}
var others = {
  one: function one (req, res, next) { req.test.push('one'); next() },
  three: function three (req, res, next) { req.test.push('three'); next() },
  five: function othersFive (req, res, next) { req.test.push('five'); next() },
  six: function six (req, res, next) { req.test.push('six'); next() },
  seven: { seven: function (req, res, next) { req.test.push('seven'); next() } },
  eight: function (req, res, next) { req.test.push('eight'); next() }
}
// create a composed middleware
var composed = compose(initial)

// do some manipulation
composed.unshift(others.one)              // prepend
composed.push(others.five)                // append
composed.before('four', others.three)     // insert before
composed.after('othersFive', others.six)  // insert after
composed.after('six', others.seven)

// named functions become named middleware functions
console.log(composed.stack) // [ { one: [Function: one] },
                            //   { two: [Function] },
                            //   { three: [Function: three] },
                            //   { four: [Function] },
                            //   { othersFive: [Function: othersFive] },
                            //   { six: [Function: six] },
                            //   { seven: [Function] } ]

// lets clone the middlewares
var composed2 = composed.clone() // clone the middlewares; same as `compose(composed)`
composed2.remove('six').remove('two').remove('four') // remove middlewares

// do some more manipulation
composed.replace('seven', others.eight)   // replace middleware seven with eight

// run new composed middleware
var req = { test: [] }
composed(req, res, function () {
  console.log(4, req.test) // < [ 'one', 'two', 'three', 'four', 'five', 'six', 'eight' ]
})

// run the other composed middleware (with a different request)
var req2 = { test: [] }
composed2(req2, res, function () {
  console.log(5, req2.test) // < [ 'one', 'three', 'five', 'seven' ]
})
````

## Example

Run the examples above with [node test/sample.js](test/sample.js).


## Methods

<a name="compose"/>
## compose() ⇒ <code>function</code>
compose a new middleware function from multiple middlewares

**Returns**: <code>function</code> - middleware function

| Param | Type |
| --- | --- |
|  | <code>function</code> &#124; <code>Array</code> &#124; <code>Object</code> |

* [compose()](#compose) ⇒ <code>function</code>
  * [.before](#compose.before) ⇒ <code>function</code>
  * [.after](#compose.after) ⇒ <code>function</code>
  * [.replace](#compose.replace) ⇒ <code>function</code>
  * [.remove](#compose.remove) ⇒ <code>function</code>
  * [.push](#compose.push) ⇒ <code>function</code>
  * [.unshift](#compose.unshift) ⇒ <code>function</code>
  * [.decompose(middlewares)](#compose.decompose) ⇒ <code>Array</code>
  * [.clone()](#compose.clone) ⇒ <code>function</code>
  * [.noop()](#compose.noop)

<a name="compose.before"/>
### compose.before ⇒ <code>function</code>
Inserts `middlewares` before each of the named middleware `selector`
If `selector` does not match a named middleware the middleware stack stays the same

**Kind**: static property of <code>[compose](#compose)</code>
**Returns**: <code>function</code> - middleware

| Param | Type | Description |
| --- | --- | --- |
| selector | <code>String</code> | selector for named middleware |
| middlewares | <code>Array</code> &#124; <code>Object</code> |  |

<a name="compose.after"/>
### compose.after ⇒ <code>function</code>
Inserts `middlewares` after each of the named middleware `selector`
If `selector` does not match a named middleware the middleware stack stays the same

**Kind**: static property of <code>[compose](#compose)</code>
**Returns**: <code>function</code> - middleware

| Param | Type | Description |
| --- | --- | --- |
| selector | <code>String</code> | selector for named middleware |
| middlewares | <code>Array</code> &#124; <code>Object</code> |  |

<a name="compose.replace"/>
### compose.replace ⇒ <code>function</code>
Replaces the named middleware `selector` with `middlewares`
If `selector` does not match a named middleware the middleware stack stays the same

**Kind**: static property of <code>[compose](#compose)</code>
**Returns**: <code>function</code> - middleware

| Param | Type | Description |
| --- | --- | --- |
| selector | <code>String</code> | selector for named middleware |
| middlewares | <code>Array</code> &#124; <code>Object</code> |  |

<a name="compose.remove"/>
### compose.remove ⇒ <code>function</code>
Removes the named middleware `selector` from the stack
If `selector` does not match a named middleware the middleware stack stays the same

**Kind**: static property of <code>[compose](#compose)</code>
**Returns**: <code>function</code> - middleware

| Param | Type | Description |
| --- | --- | --- |
| selector | <code>String</code> | selector for named middleware |

<a name="compose.push"/>
### compose.push ⇒ <code>function</code>
Appends `middlewares` to the stack

**Kind**: static property of <code>[compose](#compose)</code>
**Returns**: <code>function</code> - middleware

| Param | Type |
| --- | --- |
| middlewares | <code>Array</code> &#124; <code>Object</code> |

<a name="compose.unshift"/>
### compose.unshift ⇒ <code>function</code>
Prepends `middlewares` to the stack

**Kind**: static property of <code>[compose](#compose)</code>
**Returns**: <code>function</code> - middleware

| Param | Type |
| --- | --- |
| middlewares | <code>Array</code> &#124; <code>Object</code> |

<a name="compose.decompose"/>
### compose.decompose(middlewares) ⇒ <code>Array</code>
decompose `obj` into middleware Array
Named functions names are used as middleware identifiers

**Kind**: static method of <code>[compose](#compose)</code>
**Returns**: <code>Array</code> - - array of middlewares `{Object|Array}`

| Param | Type |
| --- | --- |
| middlewares | <code>Object</code> &#124; <code>Array</code> &#124; <code>function</code> |

<a name="compose.clone"/>
### compose.clone() ⇒ <code>function</code>
clone the middleware for further manipulation

**Kind**: static method of <code>[compose](#compose)</code>
**Returns**: <code>function</code> - cloned middleware function
<a name="compose.noop"/>
### compose.noop()
No operation middleware - just calls next

**Kind**: static method of <code>[compose](#compose)</code>


## Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your
code to be distributed under the MIT license. You are also implicitly
verifying that all code is your original work or correctly attributed
with the source of its origin and licence.

## License

Copyright (c) 2015 commenthol (MIT License)

See [LICENSE][] for more info.

## References

<!-- !ref -->

* [connect][connect]
* [express][express]
* [LICENSE][LICENSE]

<!-- ref! -->

[LICENSE]: ./LICENSE
[connect]: https://github.com/senchalabs/connect#readme
[express]: http://expressjs.com/
