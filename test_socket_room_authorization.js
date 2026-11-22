/**
 * Isolated regression checks for room membership and metadata forwarding.
 * Uses fake sockets/models: NOT a real-server penetration or end-to-end test.
 * Run with: node test_socket_room_authorization.js
 */
const assert = require('node:assert/strict');
const Module = require('module');
const originalLoad = Module._load;
const fakeConversations = new Map([
  [21, { id: 21, userId: 1 }],
  [22, { id: 22, userId: 2 }]
]);
Module._load = function(request, parent, isMain) {
  if (request === 'socket.io') return { Server: class {} };
  if (request === 'jsonwebtoken') return { verify() { return {}; } };
  if (request === '../db' && parent?.filename.endsWith('socketService.js')) {
    return {
      User: {},
      Conversation: { async findOne({ where }) {
        const item = fakeConversations.get(where.id);
        return item && item.userId === where.userId ? item : null;
      } }
    };
  }
  return originalLoad.apply(this, arguments);
};
const svc = require('./src/services/socketService');
Module._load = originalLoad;
function socket(userId) {
  const notifications = [];
  const rooms = new Set([`user:${userId}`]);
  const forwarded = [];
  return {
    userId, rooms, notifications, forwarded,
    join: room => rooms.add(room),
    leave: room => rooms.delete(room),
    emit: (event, data) => notifications.push({ event, data }),
    to: room => ({ emit: (event, data) => forwarded.push({ room, event, data }) })
  };
}
async function run() {
  const a = socket(1);
  const b = socket(2);
  assert.equal(await svc.handleJoinConversation(a, 21), true);
  assert.equal(a.rooms.has('conversation:21'), true);
  assert.equal(await svc.handleJoinConversation(b, 21), false);
  assert.equal(b.rooms.has('conversation:21'), false);
  assert.equal(b.notifications.at(-1).data.code, 'NOT_AUTHORIZED');
  assert.equal(await svc.handleJoinConversation(b, 'not-a-number'), false);
  assert.equal(await svc.handleJoinConversation(b, -1), false);
  assert.equal(await svc.handleJoinConversation(b, 0), false);
  assert.equal(await svc.handleJoinConversation(b, 21.9), false);
  svc.handleTypingStart(b, { conversationId: 21 });
  svc.handleMessageRead(b, { conversationId: 21, messageId: 10 });
  assert.equal(b.forwarded.length, 0);
  svc.handleTypingStart(a, { conversationId: 21 });
  assert.equal(a.forwarded.length, 1);
  assert.equal(a.forwarded[0].room, 'conversation:21');
  assert.equal('username' in a.forwarded[0].data, false);
  assert.equal('email' in a.forwarded[0].data, false);
  svc.handleMessageRead(a, { conversationId: 21, messageId: 10 });
  assert.equal(a.forwarded.length, 2);
  svc.handleLeaveConversation(a, 21);
  assert.equal(a.rooms.has('conversation:21'), false);
  console.log('Socket room-authorization unit checks passed (mock sockets/models; 17 assertions).');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
