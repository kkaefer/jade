
/*!
 * Jade
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Parser = require('./parser');

/**
 * Library version.
 */

exports.version = '0.4.1';

/**
 * Module dependencies.
 */

var sys = require('sys'),
    fs = require('fs');

/**
 * Intermediate JavaScript cache.
 * 
 * @type Object
 */

var cache = exports.cache = {};

/**
 * Expose self closing tags.
 * 
 * @type Object
 */

exports.selfClosing = require('./self-closing');

/**
 * Default supported doctypes.
 * 
 * @type Object
 */

exports.doctypes = require('./doctypes');

/**
 * Text filters.
 * 
 * @type Object
 */

exports.filters = require('./filters');

/**
 * Render the given attributes object.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function attrs(obj){
    var buf = [],
        html5 = obj.html5;
    delete obj.html5;
    var keys = Object.keys(obj),
        len = keys.length;
    if (len) {
        buf.push('');
        for (var i = 0; i < len; ++i) {
            var key = keys[i],
                val = obj[key];
            if (typeof val === 'boolean' || val === '' || val == null) {
                if (val) {
                    html5
                        ? buf.push(key)
                        : buf.push(key + '="' + key + '"');
                }
            } else {
                buf.push(key + '="' + escape(val) + '"');
            }
        }
    }
    return buf.join(' ');
}

/**
 * Escape the given string of `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */

function escape(html){
    return String(html)
        .replace(/&(?!\w+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Re-throw the given `err` in context to the
 * `str` of jade, `filename`, and `lineno`.
 *
 * @param {Error} err
 * @param {String} str
 * @param {String} filename
 * @param {String} lineno
 * @api private
 */

function rethrow(err, str, filename, lineno){
    var start = lineno - 3 > 0
        ? lineno - 3
        : 0;
    // Error context
    var context = str.split('\n').slice(start, lineno).map(function(line, i){
        return '    ' + (i + start + 1) + '. ' + sys.inspect(line);
    }).join('\n');

    // Alter exception message
    err.path = filename;
    err.message = (filename || 'Jade') + ':' + lineno 
        + '\n' + context + '\n\n' + err.message;
    throw err;
}

/**
 * Parse the given `str` of jade and return a `Function`.
 *
 * @param {String} str
 * @param {Object} options
 * @return {Function}
 * @api private
 */

function parse(str, options){
    var filename = options.filename;
    try {
        var parser = new Parser(str, filename);
        if (options.debug) {
            parser.debug();
            parser = new Parser(str, filename);
        }
        var js = parser.parse();
        if (options.debug) sys.puts('\nfunction:', js.replace(/^/gm, '  '));
        try {
            return new Function('locals', 'with (locals) {' + js + '}');
        } catch (err) {
            process.compile(js, filename || 'Jade');
            return;
        }
    } catch (err) {
        rethrow(err, str, filename, parser.lexer.lineno);
    }
}

/**
 * Render the given `str` of jade.
 *
 * Options:
 *
 *   - `scope`     Evaluation scope (`this`). Also referred to as `context`
 *   - `locals`    Local variable object
 *   - `filename`  Used in exceptions, and required by `cache`
 *   - `cache`     Cache intermediate JavaScript in memory keyed by `filename`
 *
 * @param {String|Buffer} str
 * @param {Object} options
 * @return {String}
 * @api public
 */

exports.render = function(str, options){
    var fn,
        options = options || {},
        filename = options.filename;

    // Accept Buffers
    str = String(str);

    // Cache support
    if (options.cache) {
        if (filename) {
            if (cache[filename]) {
                fn = cache[filename];
            } else {
                fn = cache[filename] = parse(str, options);
            }
        } else {
            throw new Error('filename is required when using the cache option');
        }
    } else {
        fn = parse(str, options);
    }

    // Render the template
    try {
        var scope = options.scope || options.context,
            locals = options.locals || {},
            _ = { lineno: 1 };
        locals._ = _;
        locals.attrs = attrs;
        locals.escape = escape;
        return fn.call(scope, locals); 
    } catch (err) {
        rethrow(err, str, filename, _.lineno);
    }
};

/**
 * Render jade template at the given `path`.
 *
 * @param {String} path
 * @param {Object} options
 * @param {Function} fn
 * @api public
 */

exports.renderFile = function(path, options, fn){
    if (typeof options === 'function') {
        fn = options;
        options = {};
    }
    options.filename = path;

    // Primed cache
    if (options.cache && cache[path]) {
        try {
            fn(null, exports.render('', options));
        } catch (err) {
            fn(err);
        }
    } else {
        fs.readFile(path, 'utf8', function(err, str){
            if (err) return fn(err);
            try {
                fn(null, exports.render(str, options));
            } catch (err) {
                fn(err);
            }
        });
    }
};