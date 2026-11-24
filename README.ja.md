# anydrop

[English](README.md) | [简体中文](README.zh-CN.md) | 日本語

同じネットワーク上のデバイス間で、ブラウザだけでファイルやテキストを共有する AirDrop 風のアプリです。
ファイルとテキストは WebRTC でデバイス同士が直接やり取りし、小さなシグナリングサーバーは
デバイスが互いを見つけて接続を確立する手助けだけを行います。

## 仕組み

- **ルームはグローバル IP から決まります。** シグナリング用 Worker が、接続元の IP（IPv6 は /64 プレフィックス）を
  秘密のソルトでハッシュして Durable Object のルームを選ぶため、同じルーターにつながったデバイスは自動的に
  同じルームに入ります。これはあくまで経験則による方法で、CGNAT・社内プロキシ・VPN の背後にあるデバイスは、
  見知らぬ人と同じルームになる可能性があります。
- **プライベートルーム。** デバイスはプライベートルームを作成することもできます。ランダムなルームコード
  （ページ URL のフラグメント `#room=CODE` に入り、ブラウザはこれをどのサーバーにも送りません）を使い、
  リンクか QR コードを持つ人なら誰でも、どのネットワークからでも参加できます。プライベートルームの
  デバイスは「近くのデバイス」のルームには入らないため、同じネットワークの見知らぬ人からは見えません。
  接続時にはルームコードが `?room=` として Worker に送られる（リクエストログに残る可能性がある）ので、
  ルームのリンクは公開しないでください。
- **シグナリング**（`apps/worker`）：Cloudflare Worker + Durable Object（`partyserver`）が、WebSocket 経由で
  WebRTC の offer / answer / ICE candidate を中継します。
- **転送**（`apps/web`）：相手ごとに `control` データチャネルがあり、オファー・承諾・キャンセル・テキストを
  やり取りします。ファイルはそれぞれ専用の `file:<id>` データチャネルを使い、ユーザーが承諾した後にだけ
  受信されます。

## ディレクトリ構成

| パス | 内容 |
| --- | --- |
| `apps/web` | Next.js フロントエンド（UI、WebRTC ピア管理） |
| `apps/worker` | Cloudflare Worker のシグナリングサーバー |
| `packages/protocol` | 双方で共有するメッセージ型 |

## 開発

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local        # ローカル開発ならデフォルト値のままで動作します
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
pnpm dev          # web は :3000、worker は :8787
pnpm typecheck
pnpm test
```

2 つのタブでページを開くと試せます（各タブが 1 台のデバイスとして扱われます）。

## 設定

**Web**（`apps/web/.env.local`、ビルド時に埋め込まれます）：

| 変数 | 説明 |
| --- | --- |
| `NEXT_PUBLIC_SIGNAL_URL` | デプロイ済み Worker の `ws(s)://` ベース URL。**本番ビルドでは必須です。** |
| `NEXT_PUBLIC_ICE_SERVERS` | 任意。`RTCIceServer` の JSON 配列。TURN サーバーを追加するときに設定します。 |
| `NEXT_PUBLIC_GA_ID` | 任意。Google Analytics 4 の測定 ID。 |

**Worker：**

| 名前 | 説明 |
| --- | --- |
| `ROOM_SALT` | IP をルーム ID にハッシュするための秘密値。ローカルでは `apps/worker/.dev.vars`、本番では `wrangler secret put ROOM_SALT` で設定します。未設定の場合、Worker はリクエストを拒否します（HTTP 500）。 |
| `ALLOWED_ORIGINS` | 任意。カンマ区切りで指定する正確なオリジンの一覧（例：`https://anydrop.example.com`）。設定すると、そのオリジンのブラウザだけがシグナリング接続を開けます（それ以外は HTTP 403）。`wrangler.jsonc` の `vars` に設定します。 |

## デプロイ

```bash
# シグナリング Worker
cd apps/worker
pnpm wrangler secret put ROOM_SALT
pnpm deploy

# Web：apps/web を任意の Next.js 対応ホストにデプロイし、
# NEXT_PUBLIC_SIGNAL_URL をデプロイ済み Worker の wss:// URL に設定します。
```

## 既知の制限

- 受信したファイルはメモリ上で組み立てられます。File System Access API が使えるブラウザ
  （デスクトップ版 Chrome / Edge）では、256 MB 以上のファイルは選択したファイルへ直接ストリーミングして
  保存します。それ以外のブラウザでは、メモリに収まらないため 512 MB を超えるファイルは最初から拒否されます。
- テキストメッセージは確認なしで届き、デバイス名は自己申告です（Worker は制御文字を取り除き 32 文字までに
  制限するだけです）。そのため、同じルームにいる人は誰でもあなたにテキストを送れ、好きな名前を名乗れます。
  接続ごとのシグナリングのレート制限（10 秒あたり 100 メッセージ）、ルームあたり最大 64 デバイス、
  受信側でのデバイスごとの制限（10 秒あたり 10 件のテキスト）は悪用を抑えるものであって、防ぐものではありません。
- TURN サーバーがないと、一部のネットワーク（対称 NAT など）では直接接続を確立できません。

## ライセンス

[MIT](LICENSE)
