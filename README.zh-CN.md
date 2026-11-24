# anydrop

[English](README.md) | 简体中文 | [日本語](README.ja.md)

在浏览器里实现类似 AirDrop 的同网络设备间文件和文本分享。文件和文本通过 WebRTC 在设备之间直接传输，
一个很小的信令服务器只负责帮助设备互相发现并建立连接。

## 工作原理

- **房间由公网 IP 决定。** 信令 Worker 用保密的盐值对调用方的 IP（IPv6 取 /64 前缀）做哈希，
  以此选出一个 Durable Object 房间，所以连着同一个路由器的设备会自动碰面。这只是一种启发式做法：
  处于运营商级 NAT（CGNAT）、公司代理或 VPN 之后的设备，可能会和陌生人处在同一个房间。
- **私密房间。** 设备也可以创建私密房间：一个随机房间码（放在页面 URL 的 `#room=CODE` 片段里，
  浏览器不会把它发给任何服务器），任何拿到链接或二维码的人都能从任意网络加入。私密房间里的设备
  不在"附近设备"房间中，所以同一网络下的陌生人看不到它们。连接时房间码会以 `?room=` 的形式发给
  Worker（可能出现在它的请求日志里），所以请妥善保管房间链接。
- **信令**（`apps/worker`）：Cloudflare Worker + Durable Object（`partyserver`），通过 WebSocket
  转发 WebRTC 的 offer / answer / ICE candidate。
- **传输**（`apps/web`）：每个对端之间有一条 `control` 数据通道，用来传递 offer / 接受 / 取消和文本；
  每个文件使用各自独立的 `file:<id>` 数据通道，并且只有在用户接受之后才会接收。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `apps/web` | Next.js 前端（界面、WebRTC 对端管理） |
| `apps/worker` | Cloudflare Worker 信令服务器 |
| `packages/protocol` | 两端共用的消息类型 |

## 开发

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local        # 默认值即可用于本地开发
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
pnpm dev          # web 在 :3000，worker 在 :8787
pnpm typecheck
pnpm test
```

在两个标签页里打开页面即可体验（每个标签页相当于一台设备）。

## 配置

**Web**（`apps/web/.env.local`，构建时内联）：

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_SIGNAL_URL` | 已部署 Worker 的 `ws(s)://` 基础地址。**生产构建必须设置。** |
| `NEXT_PUBLIC_ICE_SERVERS` | 可选，`RTCIceServer` 的 JSON 数组；用于添加 TURN 服务器。 |
| `NEXT_PUBLIC_GA_ID` | 可选，Google Analytics 4 的衡量 ID。 |

**Worker：**

| 名称 | 说明 |
| --- | --- |
| `ROOM_SALT` | 用于把 IP 哈希成房间 id 的密钥。本地：`apps/worker/.dev.vars`。生产：`wrangler secret put ROOM_SALT`。缺失时 Worker 会拒绝请求（HTTP 500）。 |
| `ALLOWED_ORIGINS` | 可选，以逗号分隔的精确来源列表（例如 `https://anydrop.example.com`）。设置后，只有来自这些来源的浏览器才能建立信令连接（其他返回 HTTP 403）。请在 `wrangler.jsonc` 的 `vars` 中设置。 |

## 部署

```bash
# 信令 Worker
cd apps/worker
pnpm wrangler secret put ROOM_SALT
pnpm deploy

# Web：把 apps/web 部署到任意支持 Next.js 的平台，
# 并把 NEXT_PUBLIC_SIGNAL_URL 设为已部署 Worker 的 wss:// 地址。
```

## 已知限制

- 接收到的文件默认在内存中拼装。在支持 File System Access API 的浏览器（桌面版 Chrome / Edge）中，
  256 MB 及以上的文件会直接流式写入你选择的文件；在其他浏览器中，超过 512 MB 的文件会被直接拒绝，
  因为内存放不下。
- 文本消息不经确认就会送达，设备名称由设备自行声明（Worker 只会去掉控制字符并限制在 32 个字符以内），
  所以同一房间里的任何人都可以给你发文本，也可以随意起名。每个连接的信令限流（10 秒 100 条消息）、
  每个房间最多 64 台设备、接收端每台设备 10 秒最多 10 条文本，这些措施只能限制滥用，不能杜绝。
- 没有 TURN 服务器时，部分网络（例如对称 NAT）无法建立直连。

## 许可证

[MIT](LICENSE)
