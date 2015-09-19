/**
 * @copyright 2015 commenthol@gmail.com
 * @license MIT
 */

'use strict'

/**
 * Safety wrapper around nextTick
 * @api private
 * @param {Function} next - next function on the stack
 * @param {Object} [err] - error value from previous middleware
 */
function nextTick (next, err) {
  return process.nextTick(function () {
    try {
      next(err)
    } catch (e) {
      // istanbul ignore next
      next(e)
    }
  })
}

/**
 * compose a new middleware function from multiple middlewares
 *
 * @param {Function|Array|Object}
 * @return {Function} middleware function
 */
function compose () {
  // the function required by the server
  function middlewareF (req, res, end) {
    var index = 0

    // inject stats middleware
    if (middlewareF.options && middlewareF.options.stats) {
      middlewareF.stack = middlewareF.stack.map(function (mw) {
        var fn
        if (typeof mw === 'object') {
          var key = Object.keys(mw)[0]
          if (!mw[key].stats) {
            fn = {}
            fn[key] = middlewareF.options.stats(mw[key])
          }
        } else {
          if (!mw.stats) {
            fn = middlewareF.options.stats(mw)
          }
        }
        return fn
      })
    }

    // looping over all middleware functions defined by stack
    ;(function next (err) {
      var arity
      var middleware = middlewareF.stack[index++] // obtain the current middleware from the stack

      if (!middleware) {
        // we are at the end of the stack
        end && end(err)
        return
      } else {
        // extract middleware from object
        if (typeof (middleware) === 'object') {
          var name = Object.keys(middleware)[0]
          if (typeof (middleware[name]) === 'function') {
            middleware = middleware[name]
          } else {
            middleware = function (req, res, next) {
              next(new Error('missing middleware'))
            }
          }
        }

        try {
          arity = middleware.length // number of arguments function middleware requires
          // handle errors
          if (err) {
            // If the middleware function contains 4 arguments than this will act as an "error trap"
            if (arity === 4) {
              middleware(err, req, res, function (err) {
                nextTick(next, err)
              })
            } else {
              // otherwise check the next middleware
              next(err)
            }
          } else if (arity < 4) {
            // process non "error trap" stack
            middleware(req, res, function (err) {
              nextTick(next, err)
            })
          } else {
            // loop over "error traps" if no error `err` is set.
            next()
          }
        } catch (e) {
          next(e)
        }
      }
    })()
  }

  middlewareF.stack = []
  middlewareF.options = compose.options || {}

  ;[].slice.call(arguments).forEach(function (a) {
    middlewareF.stack = middlewareF.stack.concat(compose.decompose(a))
  })

  // extends
  ;[ 'before', 'after', 'replace', 'remove', 'push', 'unshift', 'clone' ].forEach(function (p) {
    middlewareF[p] = compose[p]
  })

  // inject stats middleware
  if (compose.options.stats) {
    middlewareF.options = {}
    middlewareF.options.stats = compose.options.stats
  }

  return middlewareF
}

module.exports = compose

/**
 * set global options for compose
 * @example
 * var compose = require('connect-composer')
 * var stats = require('connect-composer-stats')()
 * // set global options
 * compose.options = { stats: stats.from }
 * var middleware = compose(...)
 */
compose.options = {}

/**
 * decompose `obj` into middleware Array
 * Named functions names are used as middleware identifiers
 *
 * @param {Object|Array|Function} middlewares
 * @return {Array} - array of middlewares `{Object|Array}`
 */
compose.decompose = function F (obj) {
  var o

  if (obj) {
    if (typeof (obj) === 'function') {
      if ('stack' in obj) { // reuse a composed middleware
        return F(obj.stack)
      } else if (obj.name) { // use named function name as identifier
        o = {}
        o[obj.name] = obj
        return o
      }
    } else if (typeof (obj) === 'object') {
      var i
      var res
      var array = []

      if (Array.isArray(obj)) {
        for (i = 0; i < obj.length; i++) {
          res = F(obj[i]) // recurse down
          if (Array.isArray(res)) {
            array = array.concat(res)
          } else {
            array.push(res)
          }
        }
      } else {
        for (i in obj) {
          o = {}
          if (typeof (obj[i]) === 'function') {
            o = {}
            o[i] = obj[i]
            array.push(o)
          } else {
            // TODO debuglog('nested objects are not supported')
          }
        }
      }

      return array
    }
  }
  return obj
}

/**
 * clone the middleware for further manipulation
 * @return {Function} cloned middleware function
 */
compose.clone = function () {
  return compose(this)
}

/**
 * No operation middleware - just calls next
 */
compose.noop = function (req, res, next) {
  next && next()
}

/**
 * updates stack with changed middlewares
 *
 * @api private
 * @param {String} cmd - update command
 * @return {Function} `function(selector, middleware, ...)`
 */
compose._update = function (cmd) {
  return function () {
    var selector
    var addStack = []
    var newStack = []

    ;[].slice.call(arguments).forEach(function (a) {
      addStack = addStack.concat(compose.decompose(a))
    })

    if (cmd === 'push') {
      this.stack = this.stack.concat(addStack)
    } else if (cmd === 'unshift') {
      this.stack = addStack.concat(this.stack)
    } else {
      selector = addStack.shift()

      // istanbul ignore else
      if (selector) {
        this.stack.forEach(function (item) {
          // unknown commands are not handled
          // istanbul ignore else
          if (cmd === 'before') {
            if (typeof (item) === 'object' && item[selector]) {
              newStack = newStack.concat(addStack)
            }
            newStack.push(item)
          } else if (cmd === 'after') {
            newStack.push(item)
            if (typeof (item) === 'object' && item[selector]) {
              newStack = newStack.concat(addStack)
            }
          } else if (cmd === 'replace') {
            if (typeof (item) === 'object' && item[selector]) {
              newStack = newStack.concat(addStack)
            } else {
              newStack.push(item)
            }
          } else if (cmd === 'remove') {
            // istanbul ignore else
            if (!(typeof (item) === 'object' && item[selector])) {
              newStack.push(item)
            }
          }
        })
        this.stack = newStack
      }
    }

    return this
  }
}

/**
 * Inserts `middlewares` before each of the named middleware `selector`
 * If `selector` does not match a named middleware the middleware stack stays the same
 *
 * @param {String} selector - selector for named middleware
 * @param {Array|Object} middlewares
 * @return {Function} middleware
 */
compose.before = compose._update('before')

/**
 * Inserts `middlewares` after each of the named middleware `selector`
 * If `selector` does not match a named middleware the middleware stack stays the same
 *
 * @param {String} selector - selector for named middleware
 * @param {Array|Object} middlewares
 * @return {Function} middleware
 */
compose.after = compose._update('after')

/**
 * Replaces the named middleware `selector` with `middlewares`
 * If `selector` does not match a named middleware the middleware stack stays the same
 *
 * @param {String} selector - selector for named middleware
 * @param {Array|Object} middlewares
 * @return {Function} middleware
 */
compose.replace = compose._update('replace')

/**
 * Removes the named middleware `selector` from the stack
 * If `selector` does not match a named middleware the middleware stack stays the same
 *
 * @param {String} selector - selector for named middleware
 * @return {Function} middleware
 */
compose.remove = compose._update('remove')

/**
 * Appends `middlewares` to the stack
 *
 * @param {Array|Object} middlewares
 * @return {Function} middleware
 */
compose.push = compose._update('push')

/**
 * Prepends `middlewares` to the stack
 *
 * @param {Array|Object} middlewares
 * @return {Function} middleware
 */
compose.unshift = compose._update('unshift')

