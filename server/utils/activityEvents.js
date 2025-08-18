// server/utils/activityEvents.js

const clients = new Set();

function addClient(res) {
    clients.add(res);
    res.on('close', () => clients.delete(res));
}

function broadcastActivity(activity) {
    const payload = `data: ${JSON.stringify(activity)}\n\n`;
    for (const res of clients) {
        try {
            res.write(payload);
        } catch (_) {
            clients.delete(res);
        }
    }
}

module.exports = { addClient, broadcastActivity };


