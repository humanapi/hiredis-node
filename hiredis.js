const net = require('net'),
    hiredis = require('bindings')('hiredis.node');

const BUFFER_ENCODING = 'ascii';

const bufStar = Buffer.from('*', BUFFER_ENCODING);
const bufDollar = Buffer.from('$', BUFFER_ENCODING);
const bufCrlf = Buffer.from('\r\n', BUFFER_ENCODING);

exports.Reader = hiredis.Reader;

exports.writeCommand = function () {
    let args = arguments,
        bufLen = Buffer.from(String(args.length), BUFFER_ENCODING),
        parts = [bufStar, bufLen, bufCrlf],
        size = 3 + bufLen.length;

    for (let i = 0; i < args.length; i++) {
        var arg = args[i];
        if (!Buffer.isBuffer(arg)) {
            arg = Buffer.from(String(arg));
        }

        bufLen = Buffer.from(String(arg.length), BUFFER_ENCODING);
        parts = parts.concat([bufDollar, bufLen, bufCrlf, arg, bufCrlf]);
        size += 5 + bufLen.length + arg.length;
    }

    return Buffer.concat(parts, size);
};

exports.createConnection = function (port, host) {
    var socket = net.createConnection(port || 6379, host);
    var reader = new hiredis.Reader();
    var _write = socket.write;

    socket.write = function () {
        const data = exports.writeCommand.apply(this, arguments);
        return _write.call(socket, data);
    };

    socket.on('data', function (data) {
        var reply;
        reader.feed(data);
        try {
            while ((reply = reader.get()) !== undefined) {
                socket.emit('reply', reply);
            }
        } catch (err) {
            reader = null;
            socket.emit('error', err);
            socket.destroy();
        }
    });

    return socket;
};
