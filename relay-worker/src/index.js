/**
 * Cat Sync Relay Worker - 无状态中继
 * 
 * 只做两件事：
 * 1. 转发加密消息（不存储、不解密）
 * 2. 验证配对码（临时存储，2分钟过期）
 * 
 * 数据结构（全部在内存中，Worker重启后清空，设备自动重连）：
 * - pendingMessages: {channelId: [message, ...]}  - 待投递消息
 * - pairingCodes: {code: {hubInfo, createdAt}}  - 配对码
 * - channels: {channelId: {deviceId, createdAt}}  - 连接通道
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // 内存存储（Worker实例生命周期内有效）
    if (!globalThis.catState) {
      globalThis.catState = {
        pendingMessages: {},
        pairingCodes: {},
        channels: {},
      };
    }
    const state = globalThis.catState;

    try {
      // POST /pair - 配对验证
      if (url.pathname === '/pair' && request.method === 'POST') {
        const { code, device_info } = await request.json();
        const pairing = state.pairingCodes[code];
        if (!pairing || Date.now() > pairing.expiresAt) {
          delete state.pairingCodes[code];
          return new Response(JSON.stringify({ error: 'Invalid or expired code' }), { status: 400, headers });
        }
        return new Response(JSON.stringify({ 
          success: true, 
          hub_info: pairing.hubInfo,
          psk: pairing.psk 
        }), { headers });
      }

      // POST /connect - 建立连接
      if (url.pathname === '/connect' && request.method === 'POST') {
        const { device_id } = await request.json();
        const channelId = crypto.randomUUID();
        state.channels[channelId] = { deviceId: device_id, createdAt: Date.now() };
        state.pendingMessages[channelId] = [];
        return new Response(JSON.stringify({ channel_id: channelId }), { headers });
      }

      // POST /send - 发送消息
      if (url.pathname === '/send' && request.method === 'POST') {
        const { channel_id, from_device, to_device, data } = await request.json();
        // 找到目标设备的channel
        let found = false;
        for (const [cid, channel] of Object.entries(state.channels)) {
          if (channel.deviceId === to_device) {
            if (!state.pendingMessages[cid]) state.pendingMessages[cid] = [];
            state.pendingMessages[cid].push({
              from_device,
              data,
              timestamp: Date.now()
            });
            // 只保留最近100条消息
            if (state.pendingMessages[cid].length > 100) {
              state.pendingMessages[cid] = state.pendingMessages[cid].slice(-100);
            }
            found = true;
          }
        }
        return new Response(JSON.stringify({ success: true, found }), { headers });
      }

      // GET /receive - 接收消息（长轮询）
      if (url.pathname === '/receive' && request.method === 'GET') {
        const channelId = url.searchParams.get('channel_id');
        const timeout = parseInt(url.searchParams.get('timeout') || '30') * 1000;
        
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
          const messages = state.pendingMessages[channelId];
          if (messages && messages.length > 0) {
            state.pendingMessages[channelId] = [];
            return new Response(JSON.stringify({ messages }), { headers });
          }
          // 短暂等待（长轮询模拟）
          await new Promise(r => setTimeout(r, 1000));
        }
        return new Response(JSON.stringify({ messages: [] }), { headers });
      }

      // POST /register-code - Hub注册配对码到中继
      if (url.pathname === '/register-code' && request.method === 'POST') {
        const { code, psk, hub_info, expires_at } = await request.json();
        state.pairingCodes[code] = {
          psk,
          hubInfo: hub_info,
          expiresAt: expires_at * 1000, // 转毫秒
          createdAt: Date.now()
        };
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // GET /health - 健康检查
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ 
          status: 'ok',
          channels: Object.keys(state.channels).length,
          pendingMessages: Object.values(state.pendingMessages).reduce((a, b) => a + b.length, 0),
          pairingCodes: Object.keys(state.pairingCodes).length,
        }), { headers });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
  }
};
