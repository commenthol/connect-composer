'use strict'

/* global describe, it */

var assert = require('assert')
var compose = require('../lib/compose')

var noop = compose.noop

var mw = function (name) {
  return function (req, res, next) {
    if (!req.test) req.test = []
    req.test.push(name)
    next()
  }
}

describe('compose', function () {
  it('compose middleware is a function', function (done) {
    var middleware = compose()

    assert.strictEqual(typeof (middleware), 'function')

    middleware({}, {}, function () {
      done()
    })
  })

  it('compose middlewares', function (done) {
    var req = {}
    var res = {}
    var exp = { test: [0, 1, 2] }

    compose(
      noop,
      mw(0),
      mw(1),
      noop,
      mw(2)
    )(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })

  it('compose named middlewares', function (done) {
    var req = {}
    var res = {}
    var exp = { test: [1, 2, 3] }

    compose(
      { one: mw(1) },
      { two: mw(2) },
      { three: mw(3) }
    )(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })

  it('stack middlewares together', function (done) {
    var req = {}
    var res = {}
    var middlewares1 = [mw('one'), mw('two')]
    var middlewares2 = [mw('three'), mw('four')]

    compose(middlewares1, middlewares2)(req, res, function () {
      assert.deepStrictEqual(req, { test: ['one', 'two', 'three', 'four'] })
      done()
    })
  })

  it('compose named middlewares from composed middlewares', function (done) {
    var req = {}
    var res = {}

    var comp1 = compose(
      { one: mw('one') },
      { two: mw('two') }
    )
    var comp2 = compose(
      { three: mw('three') },
      { four: mw('four') }
    )
    var comp3 = compose(comp1, comp2)

    assert.strictEqual(comp3.stack.length, 4)

    comp3(req, res, function () {
      assert.deepStrictEqual(req, { test: ['one', 'two', 'three', 'four'] })
      done()
    })
  })

  it('compose named middlewares from named middleware functions', function (done) {
    var req = {}
    var res = {}

    var comp = compose(
      function one (req, res, next) {
        mw(1)(req, res, next)
      },
      function two (req, res, next) {
        mw(2)(req, res, next)
      },
      {
        three2: function three (req, res, next) {
          mw(3)(req, res, next)
        }
      }
    )

    var result = comp.stack.map(function (i) {
      return Object.keys(i)[0]
    })

    assert.deepStrictEqual(result, ['one', 'two', 'three2'])

    comp(req, res, function () {
      assert.deepStrictEqual(req, { test: [1, 2, 3] })
      done()
    })
  })

  it('can clone a composed middleware', function (done) {
    var req = {}
    var res = {}

    var comp = compose(
      { one: mw(1) },
      { two: mw(2) },
      { two: mw(2) }
    )

    var comp2 = comp.clone()

    comp2.remove('two')

    comp(req, res, function () {
      assert.deepStrictEqual(req.test, [1, 2, 2])
      req = {}
      comp2(req, res, function () {
        assert.deepStrictEqual(req.test, [1])
        done()
      })
    })
  })

  it('passes over error', function (done) {
    var req = {}
    var res = {}

    compose(
      mw('one'),
      function (req, res, next) {
        next('error')
      },
      mw('two')
    )(req, res, function (err) {
      assert.strictEqual(err, 'error')
      assert.deepStrictEqual(req, { test: ['one'] })
      done()
    })
  })

  it('loops over error traps', function (done) {
    var req = {}
    var res = {}

    compose(
      mw('one'),
      mw('two'),
      function (e, req, res, next) {
        req.test.push('error trap')
        next()
      },
      mw('three')
    )(req, res, function (err) {
      assert.ok(!err, err + '')
      assert.deepStrictEqual(req, { test: ['one', 'two', 'three'] })
      done()
    })
  })

  it('traps error', function (done) {
    var req = {}
    var res = {}

    compose(
      mw('one'),
      function (req, res, next) {
        next('trap error')
      },
      mw('two'),
      function (err, req, res, next) {
        assert.strictEqual(err, 'trap error')
        next()
      },
      mw('three')
    )(req, res, function (err) {
      assert.ok(!err, err + '')
      assert.deepStrictEqual(req, { test: ['one', 'three'] })
      done()
    })
  })

  it('safely run a middleware throwing an error', function (done) {
    var req = {}
    var res = {}

    compose(
      mw('one'),
      function (req, res, next) {
        throw new Error('arghhhh')
      },
      mw('two')
    )(req, res, function (err) {
      assert.deepStrictEqual(req, { test: ['one'] })
      assert.strictEqual(err.message, 'arghhhh')
      done()
    })
  })

  it('catches error if next middleware is not a function', function (done) {
    var req = {}
    var res = {}

    compose(
      mw('one'),
      function (req, next, res) {
        next()
      },
      mw('two')
    )(req, res, function (err) {
      assert.ok(err, err + 'TypeError: next is not a function')
      assert.deepStrictEqual(req, { test: ['one'] })
      done()
    })
  })

  it('missing named middleware causes error', function (done) {
    var req = {}
    var res = {}
    var c = compose(
      mw('one')
    )

    c.stack.push({ one: { two: 2 } })

    c(req, res, function (err) {
      assert.strictEqual(err.message, 'missing middleware')
      assert.deepStrictEqual(req, { test: ['one'] })
      done()
    })
  })
})

describe('compose.decompose', function () {
  it('empty', function () {
    var res = compose.decompose()
    assert.deepStrictEqual(res, undefined)
  })

  it('single function', function () {
    var res = compose.decompose(noop)
    assert.deepStrictEqual(res, noop)
  })

  it('array of functions', function () {
    var exp = [noop, noop, noop]
    var res = compose.decompose(exp)
    assert.deepStrictEqual(res, exp)
  })

  it('array of array of functions', function () {
    var exp = [noop, noop, noop]
    var res = compose.decompose(exp)
    assert.deepStrictEqual(res, exp)
  })

  it('objects with named functions', function () {
    var arg = { one: noop, two: noop, three: noop }
    var exp = [{ one: noop }, { two: noop }, { three: noop }]
    var res = compose.decompose(arg)
    assert.deepStrictEqual(res, exp)
  })

  it('array of objects with named functions', function () {
    var exp = [{ one: noop }, { two: noop }, { three: noop }]
    var res = compose.decompose(exp)
    assert.deepStrictEqual(res, exp)
  })

  it('mixed array of objects with named functions', function () {
    var arg = [{ one: noop, two: noop }, { three: noop }]
    var exp = [{ one: noop }, { two: noop }, { three: noop }]
    var res = compose.decompose(arg)
    assert.deepStrictEqual(res, exp)
  })

  it('mixed array of nested objects with named functions', function () {
    var arg = [{ one: { oneOne: noop }, two: noop }, { three: noop }]
    var exp = [{ two: noop }, { three: noop }]
    var res = compose.decompose(arg)
    assert.deepStrictEqual(res, exp)
  })
})

describe('compose.before', function () {
  it('add nothing', function (done) {
    var req = {}
    var res = {}
    var mws = [{ one: mw('one') }, { two: mw('two') }]
    var exp = { test: ['one', 'two'] }

    var comp = compose(mws)
    comp.before('two')

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })

  it('adds new middlewares n1, n2 before "two"', function (done) {
    var req = {}
    var res = {}
    var mws = [{ one: mw('one') }, { two: mw('two') }]
    var mwsNew = [{ n1: mw('n1') }, { n2: mw('n2') }]
    var exp = { test: ['one', 'n1', 'n2', 'two'] }

    var comp = compose(mws)
    comp.before('two', mwsNew)

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })

  it('adds new middlewares n1, n2 before "two" multiple times', function (done) {
    var req = {}
    var res = {}
    var mws = [
      { one: mw('one') }, { two: mw('two') },
      { one: mw('one') }, { two: mw('two') }]
    var mwsNew = [{ n1: mw('n1') }, { n2: mw('n2') }]
    var exp = { test: ['one', 'n1', 'n2', 'two', 'one', 'n1', 'n2', 'two'] }

    var comp = compose(mws)
    comp.before('two', mwsNew)

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })

  it('new middlewares n1 can`t get inserted before "three"', function (done) {
    var req = {}
    var res = {}
    var mws = [{ one: mw('one') }, { two: mw('two') }]
    var mwsNew = [{ n1: mw('n1') }]
    var exp = { test: ['one', 'two'] }

    var comp = compose(mws)
    comp.before('three', mwsNew)

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })
})

describe('compose.after', function () {
  it('adds new middlewares n1, n2 after "one"', function (done) {
    var req = {}
    var res = {}
    var mws = [{ one: mw('one') }, { two: mw('two') }]
    var mwsNew = [{ n1: mw('n1') }, { n2: mw('n2') }]
    var exp = { test: ['one', 'n1', 'n2', 'two'] }

    var comp = compose(mws)
    comp.after('one', mwsNew)

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })

  it('adds new middlewares n1, n2 after "one" multiple times', function (done) {
    var req = {}
    var res = {}
    var mws = [
      { one: mw('one') }, { two: mw('two') },
      { one: mw('one') }, { two: mw('two') }]
    var mwsNew = [{ n1: mw('n1') }, { n2: mw('n2') }]
    var exp = { test: ['one', 'n1', 'n2', 'two', 'one', 'n1', 'n2', 'two'] }

    var comp = compose(mws)
    comp.after('one', mwsNew)

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })
})

describe('compose.replace', function () {
  it('replaces "one" with new middlewares n1, n2', function (done) {
    var req = {}
    var res = {}
    var mws = [{ one: mw('one') }, { two: mw('two') }]
    var mwsNew = [{ n1: mw('n1') }, { n2: mw('n2') }]
    var exp = { test: ['n1', 'n2', 'two'] }

    var comp = compose(mws)
    comp.replace('one', mwsNew)

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })

  it('replaces "one" with new middlewares n1, n2 multiple times', function (done) {
    var req = {}
    var res = {}
    var mws = [
      { one: mw('one') }, { two: mw('two') },
      { one: mw('one') }, { two: mw('two') }]
    var mwsNew = [{ n1: mw('n1') }, { n2: mw('n2') }]
    var exp = { test: ['n1', 'n2', 'two', 'n1', 'n2', 'two'] }

    var comp = compose(mws)
    comp.replace('one', mwsNew)

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })
})

describe('compose.remove', function () {
  it('removes "one"', function (done) {
    var req = {}
    var res = {}
    var mws = [{ one: mw('one') }, { two: mw('two') }]
    var exp = { test: ['two'] }

    var comp = compose(mws)
    comp.remove('one')

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })

  it('removes "one" multiple times', function (done) {
    var req = {}
    var res = {}
    var mws = [
      { one: mw('one') }, { two: mw('two') },
      { one: mw('one') }, { two: mw('two') }]
    var exp = { test: ['two', 'two'] }

    var comp = compose(mws)
    comp.remove('one')

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })
})

describe('compose.push', function () {
  it('push nothing to stack', function (done) {
    var req = {}
    var res = {}
    var mws = [{ one: mw('one') }, { two: mw('two') }]
    var exp = { test: ['one', 'two'] }

    var comp = compose(mws)
    comp = comp.push()

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })

  it('push new middlewares to stack', function (done) {
    var req = {}
    var res = {}
    var mws = [{ one: mw('one') }, { two: mw('two') }]
    var mwsNew = [{ n1: mw('n1') }, { n2: mw('n2') }]
    var exp = { test: ['one', 'two', 'n1', 'n2'] }

    var comp = compose(mws)
    comp.push(mwsNew)

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })
})

describe('compose.unshift', function () {
  it('unshift nothing to stack', function (done) {
    var req = {}
    var res = {}
    var mws = [{ one: mw('one') }, { two: mw('two') }]
    var exp = { test: ['one', 'two'] }

    var comp = compose(mws)
    comp = comp.unshift()

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })

  it('unshift new middlewares to stack', function (done) {
    var req = {}
    var res = {}
    var mws = [{ one: mw('one') }, { two: mw('two') }]
    var mwsNew = [{ n1: mw('n1') }, { n2: mw('n2') }]
    var exp = { test: ['n1', 'n2', 'one', 'two'] }

    var comp = compose(mws)
    comp.unshift(mwsNew)

    comp(req, res, function () {
      assert.deepStrictEqual(req, exp)
      done()
    })
  })
})
