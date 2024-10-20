import Redis from 'ioredis';

const redisMaster = new Redis({
	host: '127.0.0.1', // replace with your Redis master host
	port: 6379, // replace with your Redis master port
	// password: 'ZoTJ0qhnjiD49ou6aYoftVODxdTEsQFt', // replace with your Redis master password
});

const redisReplica = new Redis({
	host: '127.0.0.1', // replace with your Redis master host
	port: 6379, // replace with your Redis master port
	// password: 'ZoTJ0qhnjiD49ou6aYoftVODxdTEsQFt', // replace with your Redis master password
});

redisMaster.on('connect', () => {
	console.log('Connected to Redis master');
});

redisReplica.on('connect', () => {
	console.log('Connected to Redis replica');
});

redisMaster.on('error', err => {
	console.error('Redis master error:', err);
});

redisReplica.on('error', err => {
	console.error('Redis replica error:', err);
});

export const getFromCache = async key => {
	try {
		const data = await redisReplica.get(key);
		return data ? JSON.parse(data) : null;
	} catch (error) {
		console.error('Error getting data from Redis:', error);
		return null;
	}
};

export const setInCache = async (key, value) => {
	try {
		await redisMaster.set(key, JSON.stringify(value));
	} catch (error) {
		console.error('Error setting data in Redis:', error);
	}
};

export { redisMaster, redisReplica };
