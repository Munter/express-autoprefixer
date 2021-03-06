require('express-hijackresponse');
var autoprefixer = require('autoprefixer');

module.exports = function () {
    var args = Array.prototype.slice.call(arguments);

    return function (req, res, next) {
        // Prevent If-None-Match revalidation with the downstream middleware with ETags that aren't suffixed with "-autoprefixer":
        var ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch) {
            var validIfNoneMatchTokens = ifNoneMatch.split(" ").filter(function (etag) {
                return (/-autoprefixer\"$/).test(etag);
            });
            if (validIfNoneMatchTokens.length > 0) {
                req.headers['if-none-match'] = validIfNoneMatchTokens.join(" ");
            } else {
                delete req.headers['if-none-match'];
            }
        }
        delete req.headers['if-modified-since']; // Prevent false positive conditional GETs after enabling autoprefixer
        res.hijack(function (err, res) {
            var contentType = res.getHeader('Content-Type'),
            matchContentType = contentType && contentType.match(/^text\/css(?:;\s*charset=([a-z0-9\-]+))?$/i);
            // The mime module doesn't support less yet, so we fall back:
            if (matchContentType) {
                var chunks = [];
                res.on('error', function () {
                    res.unhijack();
                    next();
                }).on('data', function (chunk) {
                    chunks.push(chunk);
                }).on('end', function () {
                    if (!chunks.length) {
                        return res.send(res.statusCode);
                    }
                    var cssText = Buffer.concat(chunks).toString('utf-8'); // No other charsets are really relevant, right?

                    cssText = autoprefixer.apply(null, args).process(cssText).css;

                    res.setHeader('Content-Type', 'text/css');
                    res.setHeader('Content-Length', Buffer.byteLength(cssText));
                    res.end(cssText);
                });
            } else {
                res.unhijack(true);
            }
        });
        next();
    };
};
