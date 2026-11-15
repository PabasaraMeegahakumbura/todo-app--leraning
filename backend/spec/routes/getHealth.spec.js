jest.mock('../../src/persistence', () => ({
    checkHealth: jest.fn(),
}));

const db = require('../../src/persistence');
const { live, ready } = require('../../src/routes/getHealth');

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
    };
}

beforeEach(() => {
    jest.resetAllMocks();
});

afterEach(() => {
    jest.useRealTimers();
});

test('liveness succeeds without checking the database', () => {
    const res = createResponse();

    live({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ status: 'alive' });
    expect(db.checkHealth).not.toHaveBeenCalled();
});

test('readiness succeeds when the database responds', async () => {
    db.checkHealth.mockResolvedValue();
    const res = createResponse();

    await ready({}, res);

    expect(db.checkHealth).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ status: 'ready' });
});

test('readiness fails when the database check fails', async () => {
    db.checkHealth.mockRejectedValue(new Error('Connection failed'));
    const res = createResponse();

    await ready({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith({ status: 'unavailable' });
});

test('readiness times out when the database does not respond', async () => {
    jest.useFakeTimers();
    db.checkHealth.mockImplementation(() => new Promise(() => {}));
    const res = createResponse();

    const response = ready({}, res);
    await jest.advanceTimersByTimeAsync(2000);
    await response;

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith({ status: 'unavailable' });
    expect(jest.getTimerCount()).toBe(0);
});