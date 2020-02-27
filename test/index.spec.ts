'use strict';

import { assert } from 'chai';
import Leader from '../lib';
import redisMock from 'redis-mock';
import { RedisClient } from 'redis';

let redis: RedisClient;

beforeEach(() => {
  redis = redisMock.createClient();
});

describe('Leader', function() {
  describe('constructor', function() {
    it('should override default options with given one', function() {
      var leader = new Leader(redisMock, {
        key: 'lead',
        ttl: 2000,
        wait: 100
      });
      assert.isObject(leader.options);
      assert.equal(leader.options.ttl, 2000);
      assert.equal(leader.options.wait, 100);
    });
    it('should compute an id', function() {
      var leader = new Leader(redis);
      assert.isString(leader.id);
    });
    it('should compute a lock key', function() {
      var leader = new Leader(redis);
      assert.isString(leader.key);
    });
  });

  describe('prototype', function() {

    describe('elect', function() {
      it.skip('should elect a leader', function(done) {
        var redisMock = {
          elected: false,
          set: function(key, value) {
            var cb = arguments[arguments.length - 1];
            if(this.elected) {
              return cb(null, null);
            }
            this.elected = value;
            return cb(null, true);
          },
          get: function() {
            var cb = arguments[arguments.length - 1];
            cb(null, this.elected);
          }
        };

        var options = {
          ttl: 1000,
          wait: 100
        };
        var leader1 = {
          id: 1,
          redis: redisMock,
          key: 'testkey',
          options: options,
          emit: function() {
            this.elected = true;
          }
        } as any;
        Leader.prototype.elect.call(leader1);

        var leader2 = {
          id: 2,
          redis: redisMock,
          key: 'testkey',
          options: options,
        } as any;

        Leader.prototype.elect.call(leader2);

        assert.equal(redisMock.elected, true);
        assert.isTrue(leader1.elected);
        assert.isUndefined(leader1.electId);
        assert.isNotNull(leader1.renewId);
        assert.isNotNull(leader2.electId);
        assert.isUndefined(leader2.renewId);
      });

      describe('stop', function() {
        it.skip('should not delete the lock if he isnt leader');
        it.skip('should delete the lock if hes the leader');
      });

      describe('renew', function() {
        it.skip('should not renew lock if hes not leader');
        it.skip('should renew lock if hes leader');
      });
    });
  });
});
