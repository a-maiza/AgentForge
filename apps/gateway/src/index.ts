// Entry point — fully implemented in task 3.3
import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  await fastify.listen({ port: Number(process.env['PORT'] ?? 3002), host: '0.0.0.0' });
};

void start();
