const db = require('../persistence');

const TIMEOUT_MS = 2000;

function live(req, res) {
    res.status(200).send({ status: 'alive' });
}

async function ready(req, res) {
    let timer;

    try {
        await Promise.race([
            Promise.resolve().then(() => db.checkHealth()),
            new Promise((resolve, reject) => {
                timer = setTimeout(
                    () => reject(new Error('Database check timed out')),
                    TIMEOUT_MS,
                );
            }),
        ]);

        res.status(200).send({ status: 'ready' });
    } catch {
        res.status(503).send({ status: 'unavailable' });
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { live, ready };