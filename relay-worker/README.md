# Cat Sync Relay Worker

无状态中继服务，部署在Cloudflare Workers上。

## 特点
- **零数据存储**：所有数据只在内存中，Worker重启即清空
- **端到端加密**：只转发加密字节流，无法解密用户数据
- **免费额度**：Cloudflare Workers免费10万次请求/天

## 部署
1. 安装wrangler：`npm install`
2. 登录：`npx wrangler login`
3. 部署：`npm run deploy`
4. 部署后得到URL如 `https://cat-sync-relay.your-name.workers.dev`

## 使用
在Cat设置中填入Worker URL作为中继地址即可。

## API

### POST /pair
验证配对码
```json
{
  "code": "837421",
  "device_info": {"type": "verify"}
}
```
返回：
```json
{
  "success": true,
  "hub_info": {"device_id": "...", "device_name": "..."},
  "psk": "..."
}
```

### POST /connect
建立连接
```json
{
  "device_id": "device-uuid"
}
```
返回：
```json
{
  "channel_id": "uuid"
}
```

### POST /send
发送消息
```json
{
  "channel_id": "uuid",
  "from_device": "device-id",
  "to_device": "target-device-id",
  "data": "encrypted-base64-string"
}
```

### GET /receive
接收消息（长轮询）
```
/receive?channel_id=uuid&timeout=30
```
返回：
```json
{
  "messages": [
    {"from_device": "...", "data": "...", "timestamp": 1234567890}
  ]
}
```

### POST /register-code
Hub注册配对码
```json
{
  "code": "837421",
  "psk": "...",
  "hub_info": {"device_id": "...", "device_name": "..."},
  "expires_at": 1234567890
}
```

### GET /health
健康检查
```json
{
  "status": "ok",
  "channels": 5,
  "pendingMessages": 12,
  "pairingCodes": 2
}
```
