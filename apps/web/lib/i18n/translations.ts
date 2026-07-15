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
  selected: (name: string) => string;
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
  transferStatus: Record<TransferView["status"], string>;
  transferSend: string;
  transferReceive: string;
  transferCancel: string;
}

export const dictionaries: Record<Locale, Dictionary> = {
  zh: {
    connecting: "正在连接…",
    youAre: (name) => `你是 ${name}`,
    selected: (name) => `已选中 ${name}`,
    sectionPeers: "同网络设备",
    sectionSend: "发送文件",
    sectionText: "文本 / 剪贴板",
    sectionTransfers: "传输进度",
    peersEmptyTitle: "还没有发现同网络下的其他设备",
    peersEmptyHint: "让另一台设备打开同一个页面试试",
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
  },
  en: {
    connecting: "Connecting…",
    youAre: (name) => `You are ${name}`,
    selected: (name) => `Selected ${name}`,
    sectionPeers: "Nearby devices",
    sectionSend: "Send files",
    sectionText: "Text / Clipboard",
    sectionTransfers: "Transfers",
    peersEmptyTitle: "No other devices found on this network yet",
    peersEmptyHint: "Open this page on another device to test it",
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
  },
  ja: {
    connecting: "接続中…",
    youAre: (name) => `あなたは ${name} です`,
    selected: (name) => `${name} を選択中`,
    sectionPeers: "同じネットワークのデバイス",
    sectionSend: "ファイルを送信",
    sectionText: "テキスト / クリップボード",
    sectionTransfers: "転送状況",
    peersEmptyTitle: "同じネットワーク上に他のデバイスが見つかりません",
    peersEmptyHint: "別のデバイスで同じページを開いてみてください",
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
  },
};
