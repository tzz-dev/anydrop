import type { TransferView } from "@/components/TransferProgress";

export type Locale = "zh" | "en" | "ja";

export const LOCALES: readonly Locale[] = ["ja", "zh", "en"];

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "EN",
  ja: "日本語",
};

export interface Dictionary {
  connecting: string;
  youAre: (name: string) => string;
  sectionPeers: string;
  sectionSend: string;
  sectionText: string;
  sectionTransfers: string;
  peersEmptyTitle: string;
  peersEmptyHint: string;
  dropDisabled: string;
  dropIdle: string;
  textPlaceholderDisabled: string;
  textPlaceholder: string;
  textSend: string;
  textFrom: (name: string) => string;
  textCopy: string;
  unknownDevice: string;
  unknownSender: string;
  incomingWantsToSend: (name: string) => string;
  incomingReject: string;
  incomingAccept: string;
  incomingTooLarge: (limit: string) => string;
  transferStatus: Record<TransferView["status"], string>;
  transferSend: string;
  transferReceive: string;
  transferCancel: string;
  transfersClear: string;
  textSendFailed: string;
  textTooLong: string;
  connectionLost: string;
  statusConnected: string;
  peersNotice: string;
  sendTo: (name: string) => string;
  tabFile: string;
  tabText: string;
  dropOverlay: (name: string) => string;
  renameDevice: string;
  renameSave: string;
  renameCancel: string;
  incomingQueued: (count: number) => string;
  incomingAcceptAll: (count: number) => string;
  incomingRejectAll: (count: number) => string;
  sectionReceivedTexts: string;
  textCopied: string;
  textDelete: string;
  transferRemaining: (time: string) => string;
  sectionPeersPrivate: string;
  peersEmptyPrivateTitle: string;
  peersEmptyPrivateHint: string;
  peersNoticePrivate: string;
  privateTitle: string;
  privateIntro: string;
  privateCreate: string;
  privateJoinLabel: string;
  privateJoinPlaceholder: string;
  privateJoin: string;
  privateInvalidCode: string;
  privateActiveIntro: string;
  privateLinkLabel: string;
  privateCopyLink: string;
  privateQrLabel: string;
  privateLeave: string;
}

export const dictionaries: Record<Locale, Dictionary> = {
  zh: {
    connecting: "正在连接…",
    youAre: (name) => `你是 ${name}`,
    sectionPeers: "同网络设备",
    sectionSend: "发送文件",
    sectionText: "文本 / 剪贴板",
    sectionTransfers: "传输进度",
    peersEmptyTitle: "还没有发现同网络下的其他设备",
    peersEmptyHint: "请确认两台设备在同一网络、没有开启 VPN,并在另一台设备上打开同一个页面",
    dropDisabled: "先选择一个设备",
    dropIdle: "拖拽文件到这里,或点击选择",
    textPlaceholderDisabled: "先选择一个设备",
    textPlaceholder: "输入文本或粘贴剪贴板内容",
    textSend: "发送",
    textFrom: (name) => `来自 ${name}`,
    textCopy: "复制",
    unknownDevice: "未知设备",
    unknownSender: "对方设备",
    incomingWantsToSend: (name) => `${name} 想发送文件`,
    incomingReject: "拒绝",
    incomingAccept: "接受",
    incomingTooLarge: (limit) => `文件超过此浏览器可接收的上限(${limit}),请改用桌面版 Chrome / Edge 接收`,
    transferStatus: {
      "awaiting-accept": "等待对方确认",
      "in-progress": "传输中",
      complete: "已完成",
      rejected: "对方已拒绝",
      canceled: "已取消",
      error: "传输失败",
    },
    transferSend: "发送",
    transferReceive: "接收",
    transferCancel: "取消",
    transfersClear: "清除已结束的传输",
    textSendFailed: "发送失败,请重试",
    textTooLong: "文本太长,请缩短或分段发送",
    connectionLost: "与服务器的连接已断开,正在重连…",
    statusConnected: "已连接",
    peersNotice: "同一公网 IP 下的所有设备都会出现在这里,请只接受你认识的人发来的内容",
    sendTo: (name) => `发送给 ${name}`,
    tabFile: "文件",
    tabText: "文本",
    dropOverlay: (name) => `松开即可发送给 ${name}`,
    renameDevice: "修改设备名称",
    renameSave: "保存",
    renameCancel: "取消",
    incomingQueued: (count) => `还有 ${count} 个文件等待确认`,
    incomingAcceptAll: (count) => `全部接受 (${count})`,
    incomingRejectAll: (count) => `全部拒绝 (${count})`,
    sectionReceivedTexts: "收到的文本",
    textCopied: "已复制",
    textDelete: "删除",
    transferRemaining: (time) => `剩余 ${time}`,
    sectionPeersPrivate: "私密房间里的设备",
    peersEmptyPrivateTitle: "房间里还没有其他设备",
    peersEmptyPrivateHint: "把下面的链接或二维码发给想连接的设备,对方打开后会出现在这里",
    peersNoticePrivate: "只有拿到房间链接的人才能加入。不要把它公开发布。",
    privateTitle: "私密房间",
    privateIntro: "创建私密房间后,只有拿到链接或二维码的设备才能加入,不在同一网络也可以。进入后你会从附近设备列表中隐身。",
    privateCreate: "创建私密房间",
    privateJoinLabel: "已有房间码?",
    privateJoinPlaceholder: "输入房间码",
    privateJoin: "加入",
    privateInvalidCode: "房间码无效",
    privateActiveIntro: "你已隐身:附近的陌生设备看不到你。把链接或二维码发给想连接的设备。",
    privateLinkLabel: "房间链接",
    privateCopyLink: "复制链接",
    privateQrLabel: "房间链接二维码",
    privateLeave: "离开私密房间",
  },
  en: {
    connecting: "Connecting…",
    youAre: (name) => `You are ${name}`,
    sectionPeers: "Nearby devices",
    sectionSend: "Send files",
    sectionText: "Text / Clipboard",
    sectionTransfers: "Transfers",
    peersEmptyTitle: "No other devices found on this network yet",
    peersEmptyHint: "Make sure both devices are on the same network with no VPN, and open this page on the other one",
    dropDisabled: "Select a device first",
    dropIdle: "Drag files here, or click to choose",
    textPlaceholderDisabled: "Select a device first",
    textPlaceholder: "Type text or paste from clipboard",
    textSend: "Send",
    textFrom: (name) => `From ${name}`,
    textCopy: "Copy",
    unknownDevice: "Unknown device",
    unknownSender: "The other device",
    incomingWantsToSend: (name) => `${name} wants to send a file`,
    incomingReject: "Decline",
    incomingAccept: "Accept",
    incomingTooLarge: (limit) => `This file is larger than this browser can receive (${limit}). Use desktop Chrome or Edge instead.`,
    transferStatus: {
      "awaiting-accept": "Waiting for approval",
      "in-progress": "In progress",
      complete: "Complete",
      rejected: "Declined",
      canceled: "Canceled",
      error: "Failed",
    },
    transferSend: "Send",
    transferReceive: "Receive",
    transferCancel: "Cancel",
    transfersClear: "Clear finished",
    textSendFailed: "Failed to send, please try again",
    textTooLong: "Text is too long; shorten it or send it in parts",
    connectionLost: "Connection to the server was lost. Reconnecting…",
    statusConnected: "Connected",
    peersNotice: "Everyone behind the same public IP shows up here. Only accept things from people you know.",
    sendTo: (name) => `Send to ${name}`,
    tabFile: "Files",
    tabText: "Text",
    dropOverlay: (name) => `Drop to send to ${name}`,
    renameDevice: "Rename this device",
    renameSave: "Save",
    renameCancel: "Cancel",
    incomingQueued: (count) => `${count} more waiting for your answer`,
    incomingAcceptAll: (count) => `Accept all (${count})`,
    incomingRejectAll: (count) => `Reject all (${count})`,
    sectionReceivedTexts: "Received text",
    textCopied: "Copied",
    textDelete: "Delete",
    transferRemaining: (time) => `${time} left`,
    sectionPeersPrivate: "Devices in the private room",
    peersEmptyPrivateTitle: "No other devices in this room yet",
    peersEmptyPrivateHint: "Send the link or QR code below to the device you want to connect; it appears here once opened",
    peersNoticePrivate: "Only people with the room link can join. Do not post it publicly.",
    privateTitle: "Private room",
    privateIntro: "In a private room only devices with the link or QR code can join, even on a different network. You also disappear from the nearby device list while inside.",
    privateCreate: "Create a private room",
    privateJoinLabel: "Have a room code?",
    privateJoinPlaceholder: "Enter room code",
    privateJoin: "Join",
    privateInvalidCode: "Invalid room code",
    privateActiveIntro: "You are hidden: strangers on your network cannot see you. Send the link or QR code to the devices you want to connect.",
    privateLinkLabel: "Room link",
    privateCopyLink: "Copy link",
    privateQrLabel: "QR code for the room link",
    privateLeave: "Leave private room",
  },
  ja: {
    connecting: "接続中…",
    youAre: (name) => `あなたは ${name} です`,
    sectionPeers: "同じネットワークのデバイス",
    sectionSend: "ファイルを送信",
    sectionText: "テキスト / クリップボード",
    sectionTransfers: "転送状況",
    peersEmptyTitle: "同じネットワーク上に他のデバイスが見つかりません",
    peersEmptyHint: "両方のデバイスが同じネットワークにあり VPN を使っていないことを確認し、もう一方のデバイスで同じページを開いてください",
    dropDisabled: "先にデバイスを選択してください",
    dropIdle: "ここにファイルをドラッグ、またはクリックして選択",
    textPlaceholderDisabled: "先にデバイスを選択してください",
    textPlaceholder: "テキストを入力、またはクリップボードから貼り付け",
    textSend: "送信",
    textFrom: (name) => `${name} から`,
    textCopy: "コピー",
    unknownDevice: "不明なデバイス",
    unknownSender: "相手のデバイス",
    incomingWantsToSend: (name) => `${name} がファイルを送信しようとしています`,
    incomingReject: "拒否",
    incomingAccept: "受け入れる",
    incomingTooLarge: (limit) => `このブラウザで受信できる上限(${limit})を超えています。デスクトップ版の Chrome / Edge をご利用ください`,
    transferStatus: {
      "awaiting-accept": "相手の確認待ち",
      "in-progress": "転送中",
      complete: "完了",
      rejected: "相手が拒否しました",
      canceled: "キャンセル済み",
      error: "転送に失敗しました",
    },
    transferSend: "送信",
    transferReceive: "受信",
    transferCancel: "キャンセル",
    transfersClear: "完了した転送を消去",
    textSendFailed: "送信に失敗しました。もう一度お試しください",
    textTooLong: "テキストが長すぎます。短くするか分けて送信してください",
    connectionLost: "サーバーとの接続が切れました。再接続中…",
    statusConnected: "接続済み",
    peersNotice: "同じグローバル IP を使うデバイスはすべてここに表示されます。知っている相手からのものだけを受け入れてください。",
    sendTo: (name) => `${name} に送信`,
    tabFile: "ファイル",
    tabText: "テキスト",
    dropOverlay: (name) => `ドロップして ${name} に送信`,
    renameDevice: "デバイス名を変更",
    renameSave: "保存",
    renameCancel: "キャンセル",
    incomingQueued: (count) => `ほかに ${count} 件が確認待ちです`,
    incomingAcceptAll: (count) => `すべて承諾 (${count})`,
    incomingRejectAll: (count) => `すべて拒否 (${count})`,
    sectionReceivedTexts: "受信したテキスト",
    textCopied: "コピーしました",
    textDelete: "削除",
    transferRemaining: (time) => `残り ${time}`,
    sectionPeersPrivate: "プライベートルームのデバイス",
    peersEmptyPrivateTitle: "このルームにはまだ他のデバイスがいません",
    peersEmptyPrivateHint: "下のリンクか QR コードを接続したいデバイスに送ってください。開くとここに表示されます",
    peersNoticePrivate: "ルームのリンクを知っている人だけが参加できます。公開しないでください。",
    privateTitle: "プライベートルーム",
    privateIntro: "プライベートルームには、リンクか QR コードを持つデバイスだけが参加でき、別のネットワークからでも接続できます。参加中は近くのデバイス一覧にも表示されません。",
    privateCreate: "プライベートルームを作成",
    privateJoinLabel: "ルームコードをお持ちですか？",
    privateJoinPlaceholder: "ルームコードを入力",
    privateJoin: "参加",
    privateInvalidCode: "ルームコードが正しくありません",
    privateActiveIntro: "非表示になっています。同じネットワークの見知らぬ人からは見えません。リンクか QR コードを接続したいデバイスに送ってください。",
    privateLinkLabel: "ルームのリンク",
    privateCopyLink: "リンクをコピー",
    privateQrLabel: "ルームリンクの QR コード",
    privateLeave: "プライベートルームを退出",
  },
};
