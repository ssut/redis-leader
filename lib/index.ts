import * as crypto from 'crypto';
import * as util from 'util';
import * as uuid from 'uuid';
import { EventEmitter } from 'events';
import { RedisClient } from 'redis';
import { IHandyRedis, createHandyClient } from 'handy-redis';

export interface LeaderOptions {
  key?: string;
  ttl?: number;
  wait?: number;
}

interface RedisLeaderEventObj {
  error: Error;
  elected: void;
  revoked: void;
}

const hashKey = (key: string) => `leader:${crypto.createHash('sha1').update(key).digest('hex')}`;

export interface Leader {
  elect(): void;

  isLeader(done: (err: Error | null, ok: boolean) => void): void;

  stop(): void;

  on<K extends keyof RedisLeaderEventObj>(
    eventName: K,
    handler: (e: RedisLeaderEventObj[K], ...args: any[]) => void
  ): this;

  once<K extends keyof RedisLeaderEventObj>(
    eventName: K,
    handler: (e: RedisLeaderEventObj[K], ...args: any[]) => void
  ): this;
}

export class Leader extends EventEmitter {
  private readonly client: IHandyRedis;
  public renewId!: NodeJS.Timer;
  public electId!: NodeJS.Timer;

  public readonly id = uuid.v4();
  public readonly options: Required<LeaderOptions>;

  public get redis() {
    return this.client.redis;
  }

  public constructor(redis: RedisClient, options: LeaderOptions = {}) {
    super();

    this.client = createHandyClient(redis);
    this.options = Object.assign({
      key: hashKey(options.key || 'default'),
      ttl: 10000,
      wait: 1000,
    }, options);
  }

  public get key() {
    return this.options.key;
  }

  private async renew() {
    if (await this.isLeader()) {
      try {
        await this.client.pexpire(this.key, this.options.ttl);
      } catch (e) {
        this.emit('error', e);
      }
    } else {
      this.renewId && clearInterval(this.renewId);
      this.electId = setTimeout(() => this.elect, this.options.wait);
      this.emit('revoked');
    }
  }

  public async elect() {
    try {
      const res = await this.client.set(this.key, this.id, 'PX' as any, this.options.ttl as any, 'NX');

      if (res !== null) {
        this.emit('elected');
        this.renewId = setInterval(() => this.renew(), this.options.ttl / 2);
      } else {
        this.electId = setTimeout(() => this.elect(), this.options.wait);
      }
    } catch (e) {
      this.emit('error', e);
    }
  }

  public async isLeader() {
    const id = await this.client.get(this.key);

    return id === this.id;
  }

  public async stop() {
    if (await this.isLeader()) {
      try {
        await this.client.del(this.key);
        this.emit('revoked');
      } catch (e) {
        return this.emit('error', e);
      } finally {
        this.renewId && clearInterval(this.renewId);
        this.electId && clearTimeout(this.electId);
      }
    }
  }
}

export default Leader;
