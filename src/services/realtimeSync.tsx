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

export function subscribeToSync(topics: SyncTopic[], listener: SyncListener) {
  const subscription = { listener, topics: new Set(topics) };
  listeners.add(subscription);
  return () => {
    listeners.delete(subscription);
  };
}

function topicsForDomain(domain: SyncDomain): SyncTopic[] {
  if (domain === 'inventory') return ['inventory', 'restock', 'notifications', 'home'];
  if (domain === 'cart') return ['cart'];
  if (domain === 'notifications') return ['notifications', 'home'];
  return ['fridge', 'members'];
}

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

export function requestImmediateSyncProbe() {
  heartbeat.probeNow();
}

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
