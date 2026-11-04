import { timingSafeEqual } from 'node:crypto';
import { Server } from 'socket.io';

export const SEARCH_RUN_SOCKET_EVENTS = Object.freeze({
  SUBSCRIBE: 'search-run:subscribe',
  UNSUBSCRIBE: 'search-run:unsubscribe',
  PROGRESS: 'search-run:progress'
});

const SEARCH_RUN_ROOM_PREFIX = 'search-run:';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createSearchRunRoom = runId => `${SEARCH_RUN_ROOM_PREFIX}${runId}`;

const isMatchingApiKey = (providedApiKey, expectedApiKey) => {
  const provided = Buffer.from(providedApiKey || '', 'utf8');
  const expected = Buffer.from(expectedApiKey, 'utf8');

  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
};

const readRunId = payload => {
  const runId = payload?.runId;
  return typeof runId === 'string' && UUID_PATTERN.test(runId) ? runId : null;
};

export const createSearchRunsSocket = ({ apiKey, frontendOrigin }) => {
  const io = new Server({
    cors: {
      origin: frontendOrigin,
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    if (isMatchingApiKey(socket.handshake.auth?.apiKey, apiKey)) {
      return next();
    }

    return next(new Error('unauthorized'));
  });

  io.on('connection', socket => {
    socket.on(
      SEARCH_RUN_SOCKET_EVENTS.SUBSCRIBE,
      async (payload, acknowledge) => {
        const runId = readRunId(payload);

        if (!runId) {
          acknowledge?.({
            success: false,
            error: 'A valid runId is required'
          });
          return;
        }

        await socket.join(createSearchRunRoom(runId));
        acknowledge?.({ success: true, runId });
      }
    );

    socket.on(
      SEARCH_RUN_SOCKET_EVENTS.UNSUBSCRIBE,
      async (payload, acknowledge) => {
        const runId = readRunId(payload);

        if (!runId) {
          acknowledge?.({
            success: false,
            error: 'A valid runId is required'
          });
          return;
        }

        await socket.leave(createSearchRunRoom(runId));
        acknowledge?.({ success: true, runId });
      }
    );
  });

  const attach = httpServer => {
    io.attach(httpServer);
  };

  const publishProgress = progress => {
    io.to(createSearchRunRoom(progress.id)).emit(
      SEARCH_RUN_SOCKET_EVENTS.PROGRESS,
      progress
    );
  };

  const close = () =>
    new Promise(resolve => {
      io.close(resolve);
    });

  return Object.freeze({
    attach,
    publishProgress,
    close
  });
};
