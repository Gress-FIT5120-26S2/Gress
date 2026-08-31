import { useEffect, type PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeClient,
  type RealtimeChannel,
} from '@supabase/realtime-js';
import { requestApi } from './apiClient';

export type SyncTopic = 'cart' | 'fridge' | 'home' | 'inventory' | 'members' | 'notifications' | 'restock';
type SyncListener = (topics: ReadonlySet<SyncTopic>) => void;
type SyncState = {
  broadcast: {
    endpoint: string;
    publishableKey: string;
    topic: string;
  } | null;
  fridgeUid: string;
  mode: 'personal' | 'shared';
  versions: {
    cart: string;
    fridge: string;
    inventory: string;
    notifications: string;
  };
};

const ALL_TOPICS: SyncTopic[] = ['cart', 'fridge', 'home', 'inventory', 'members', 'notifications', 'restock'];
const listeners = new Set<{ listener: SyncListener; topics: Set<SyncTopic> }>();
const SHARED_POLL_MS = 6_000;
const FALLBACK_POLL_MS = 30_000;
const MAX_RETRY_MS = 60_000;
const EVENT_COALESCE_MS = 180;

type SyncDomain = keyof SyncState['versions'];

let pendingTopics = new Set<SyncTopic>();
let dispatchTimer: ReturnType<typeof setTimeout> | null = null;

// Arthur: NarIyirm
// 中文：Broadcast 或版本探针先进入 180ms 合并窗口，再只通知相关页面，避免一笔事务触发重复重拉。
// EN: Broadcasts and probes enter a 180ms window before notifying relevant screens, preventing duplicate reloads from one transaction.
function dispatchTopics(topics: SyncTopic[]) {
  for (const topic of topics) pendingTopics.add(topic);
  if (dispatchTimer) return;
  dispatchTimer = setTimeout(() => {
    const changed = pendingTopics;
    pendingTopics = new Set();
    dispatchTimer = null;
    for (const subscription of listeners) {
      if ([...changed].some((topic) => subscription.topics.has(topic))) subscription.listener(changed);
    }
  }, EVENT_COALESCE_MS);
}

// Arthur: NarIyirm
// 中文：页面在这里声明同步主题；回调只重跑原业务 API，不直接把 Broadcast payload 当成业务数据。
// EN: Screens declare sync topics here; callbacks rerun domain APIs instead of treating Broadcast payloads as business data.
export function subscribeToSync(topics: SyncTopic[], listener: SyncListener) {
  const subscription = { listener, topics: new Set(topics) };
  listeners.add(subscription);
  return () => {
    listeners.delete(subscription);
  };
}

// Arthur: NarIyirm
// 中文：数据库四个版本域映射到页面主题；inventory 变化还需要刷新补货、通知和首页摘要。
// EN: Four database version domains map to screen topics; inventory changes also refresh restock, notifications, and home summaries.
function topicsForDomain(domain: SyncDomain): SyncTopic[] {
  if (domain === 'inventory') return ['inventory', 'restock', 'notifications', 'home'];
  if (domain === 'cart') return ['cart'];
  if (domain === 'notifications') return ['notifications', 'home'];
  return ['fridge', 'members'];
}

// Arthur: NarIyirm
// 中文：版本以字符串传输以避开安全整数上限；优先用 BigInt 判断是否确实出现更高版本。
// EN: Versions travel as strings to avoid safe-integer limits; BigInt is preferred when deciding whether an incoming version is newer.
function isNewerVersion(current: string, incoming: string) {
  try {
    return BigInt(incoming) > BigInt(current);
  } catch {
    return incoming !== current;
  }
}

class SyncHeartbeat {
  private active = false;
  private broadcastChannel: RealtimeChannel | null = null;
  private broadcastClient: RealtimeClient | null = null;
  private broadcastConnected = false;
  private broadcastGeneration = 0;
  private broadcastSignature: string | null = null;
  private failures = 0;
  private inFlight = false;
  private lastState: SyncState | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  start(refreshAfterResume = false) {
    this.active = true;
    if (refreshAfterResume) dispatchTopics(ALL_TOPICS);
    this.schedule(0);
  }

  pause() {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.stopBroadcast();
  }

  probeNow() {
    if (!this.active) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.schedule(0);
  }

  private schedule(delay: number) {
    if (!this.active || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.poll();
    }, delay);
  }

  private changedTopics(previous: SyncState, next: SyncState) {
    if (previous.fridgeUid !== next.fridgeUid) return ALL_TOPICS;
    const topics = new Set<SyncTopic>();
    if (previous.versions.inventory !== next.versions.inventory) {
      ['inventory', 'restock', 'notifications', 'home'].forEach((topic) => topics.add(topic as SyncTopic));
    }
    if (previous.versions.cart !== next.versions.cart) topics.add('cart');
    if (previous.versions.notifications !== next.versions.notifications) {
      topics.add('notifications');
      topics.add('home');
    }
    if (previous.versions.fridge !== next.versions.fridge || previous.mode !== next.mode) {
      topics.add('fridge');
      topics.add('members');
    }
    return [...topics];
  }

  private nextPollDelay(state: SyncState | null) {
    if (state?.mode === 'shared' && !this.broadcastConnected) return SHARED_POLL_MS;
    return FALLBACK_POLL_MS;
  }

  private async stopBroadcast() {
    const client = this.broadcastClient;
    const channel = this.broadcastChannel;
    this.broadcastGeneration += 1;
    this.broadcastClient = null;
    this.broadcastChannel = null;
    this.broadcastConnected = false;
    this.broadcastSignature = null;
    if (client && channel) await client.removeChannel(channel).catch(() => undefined);
    if (client) await client.disconnect().catch(() => undefined);
  }

  private handleBroadcast(payload: unknown) {
    if (!this.active || !this.lastState || !payload || typeof payload !== 'object') return;
    const event = payload as { domain?: unknown; version?: unknown };
    if (!['inventory', 'cart', 'fridge', 'notifications'].includes(String(event.domain))) return;
    if (typeof event.version !== 'string') return;
    const domain = event.domain as SyncDomain;
    if (!isNewerVersion(this.lastState.versions[domain], event.version)) return;

    this.lastState = {
      ...this.lastState,
      versions: { ...this.lastState.versions, [domain]: event.version },
    };
    dispatchTopics(topicsForDomain(domain));
    // Arthur: NarIyirm
    // 中文：共享/成员变化可能让设备切换到另一冰箱，因此此领域事件会立即重新获取频道会话；其它领域直接静默刷新页面即可。
    // EN: Sharing or membership changes can move a device to another fridge, so this domain immediately refreshes the channel session; other domains can refresh screens directly.
    if (domain === 'fridge') this.probeNow();
  }

  private async configureBroadcast(state: SyncState) {
    const config = state.broadcast;
    const signature = config ? `${config.endpoint}|${config.publishableKey}|${config.topic}` : null;
    if (signature === this.broadcastSignature && this.broadcastClient) return;

    await this.stopBroadcast();
    if (!this.active || !config) return;

    const generation = this.broadcastGeneration;
    const client = new RealtimeClient(config.endpoint, {
      params: { apikey: config.publishableKey },
      reconnectAfterMs: (tries) => [1_000, 2_000, 5_000, 10_000][Math.min(tries - 1, 3)],
    });
    const channel = client
      .channel(config.topic, { config: { broadcast: { ack: false, self: false }, private: false } })
      .on('broadcast', { event: 'sync_invalidated' }, ({ payload }) => this.handleBroadcast(payload));

    this.broadcastClient = client;
    this.broadcastChannel = channel;
    this.broadcastSignature = signature;
    channel.subscribe((status) => {
      if (generation !== this.broadcastGeneration || this.broadcastChannel !== channel) return;
      const wasConnected = this.broadcastConnected;
      this.broadcastConnected = status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED;
      if (wasConnected && !this.broadcastConnected && this.active) this.probeNow();
    });
  }

  private async poll() {
    if (!this.active || this.inFlight) return;
    this.inFlight = true;
    let nextDelay = this.nextPollDelay(this.lastState);
    try {
      const nextState = await requestApi<SyncState>('/api/sync/state');
      if (!this.active) return;
      if (this.lastState) dispatchTopics(this.changedTopics(this.lastState, nextState));
      this.lastState = nextState;
      this.failures = 0;
      void this.configureBroadcast(nextState);
      nextDelay = this.nextPollDelay(nextState);
    } catch {
      this.failures += 1;
      nextDelay = Math.min(FALLBACK_POLL_MS * (2 ** Math.min(this.failures - 1, 1)), MAX_RETRY_MS);
    } finally {
      this.inFlight = false;
      this.schedule(nextDelay);
    }
  }
}

const heartbeat = new SyncHeartbeat();

// Arthur: NarIyirm
// 中文：共享操作后立即重新读取 /api/sync/state，用于切换 fridgeUid 或频道能力值。
// EN: Sharing operations immediately reread /api/sync/state here when fridgeUid or the channel capability may have changed.
export function requestImmediateSyncProbe() {
  heartbeat.probeNow();
}

// Arthur: NarIyirm
// 中文：App 根节点挂载此 Provider；前台维护心跳和共享频道，后台断开，恢复时主动全域对账。
// EN: The app root mounts this Provider to keep a foreground heartbeat and shared channel, disconnect in background, and reconcile on resume.
export function RealtimeSyncProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    let previousState: AppStateStatus = AppState.currentState;
    heartbeat.start(false);
    const subscription = AppState.addEventListener('change', (nextState) => {
      const returnedToForeground = previousState !== 'active' && nextState === 'active';
      previousState = nextState;
      if (nextState === 'active') heartbeat.start(returnedToForeground);
      else heartbeat.pause();
    });
    return () => {
      subscription.remove();
      heartbeat.pause();
    };
  }, []);

  return children;
}
