/* ============================================================================
 * store.js — Data access layer
 * ----------------------------------------------------------------------------
 * OWNER: Angelo Andrei P. Sierra
 *
 * The whole front end reads and writes through this object. Right now it is
 * backed by localStorage seeded from mock-data.js, so the prototype survives
 * page navigation without a server.
 *
 * HANDOVER NOTE for the backend developer (J.C. Capuli):
 *   Replace the bodies of these methods with fetch() calls to the real API.
 *   The method names, arguments and return shapes are the contract — if those
 *   stay the same, no page code has to change.
 *
 *     Store.users.list()            ->  GET    /api/users
 *     Store.users.get(id)           ->  GET    /api/users/:id
 *     Store.users.create(data)      ->  POST   /api/users
 *     Store.users.update(id, data)  ->  PATCH  /api/users/:id
 *     Store.users.remove(id)        ->  DELETE /api/users/:id
 *     Store.events.list()           ->  GET    /api/schedule
 *     Store.events.create(data)     ->  POST   /api/schedule
 *     ...and so on.
 * ========================================================================== */
(function (App) {
  'use strict';

  var KEY = 'patvep.prototype.v1';
  var db = null;

  /* --- persistence --------------------------------------------------------- */
  function seed() {
    var m = App.MockData;
    return {
      users:        clone(m.users),
      rooms:        clone(m.rooms),
      reservations: clone(m.reservations),
      events:       clone(m.events),
      inventory:    clone(m.inventory),
      seededOn:     App.Dates.todayIso()
    };
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function load() {
    if (db) return db;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        // Re-seed if the saved data is from a different day, so the demo's
        // relative dates ("today", "tomorrow") never drift out of date.
        if (parsed && parsed.seededOn === App.Dates.todayIso()) {
          db = parsed;
          return db;
        }
      }
    } catch (e) { /* private mode or corrupt data — fall through to seed */ }
    db = seed();
    save();
    return db;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { /* storage unavailable; the session still works in memory */ }
  }

  function nextId(list, prefix, pad) {
    var max = 0;
    list.forEach(function (r) {
      var n = parseInt(String(r.id).replace(/\D+/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return prefix + String(max + 1).padStart(pad || 4, '0');
  }

  /* --- collections --------------------------------------------------------- */
  var Store = {
    reset: function () {
      db = seed();
      save();
      return db;
    },

    users: {
      list: function () { return clone(load().users); },

      get: function (id) {
        var u = load().users.filter(function (x) { return x.id === id; })[0];
        return u ? clone(u) : null;
      },

      byUsername: function (username) {
        var u = load().users.filter(function (x) { return x.username === username; })[0];
        return u ? clone(u) : null;
      },

      create: function (data) {
        var d = load();
        var rec = {
          id: nextId(d.users, 'U-', 4),
          fullName: data.fullName || '',
          username: data.username || '',
          email: data.email || '',
          role: data.role || 'guest',
          status: data.status || 'active',
          department: data.department || '',
          contact: data.contact || '',
          lastLogin: null,
          createdAt: App.Dates.todayIso(),
          grants: data.grants || [],
          revokes: data.revokes || []
        };
        d.users.push(rec);
        save();
        return clone(rec);
      },

      update: function (id, patch) {
        var d = load();
        var u = d.users.filter(function (x) { return x.id === id; })[0];
        if (!u) return null;
        Object.keys(patch).forEach(function (k) { u[k] = patch[k]; });
        save();
        return clone(u);
      },

      remove: function (id) {
        var d = load();
        var i = d.users.findIndex(function (x) { return x.id === id; });
        if (i === -1) return false;
        d.users.splice(i, 1);
        save();
        return true;
      },

      /** username must be unique; `exceptId` lets a user keep their own name */
      usernameTaken: function (username, exceptId) {
        return load().users.some(function (u) {
          return u.username.toLowerCase() === String(username).toLowerCase() &&
                 u.id !== exceptId;
        });
      },

      countByRole: function () {
        var out = { admin: 0, staff: 0, guest: 0 };
        load().users.forEach(function (u) {
          if (out[u.role] !== undefined) out[u.role]++;
        });
        return out;
      }
    },

    rooms: {
      list: function () { return clone(load().rooms); },
      get: function (id) {
        var r = load().rooms.filter(function (x) { return x.id === id; })[0];
        return r ? clone(r) : null;
      },
      /** "R-101S" -> "101S" for compact display */
      codeOf: function (id) {
        var r = this.get(id);
        return r ? r.code : (id || '—');
      }
    },

    reservations: {
      list: function () { return clone(load().reservations); },
      get: function (id) {
        var r = load().reservations.filter(function (x) { return x.id === id; })[0];
        return r ? clone(r) : null;
      },
      byGuest: function (guestId) {
        return clone(load().reservations.filter(function (r) {
          return r.guestId === guestId;
        }));
      },
      /** reservations that actually hold a room (cancelled ones do not) */
      active: function () {
        return clone(load().reservations.filter(function (r) {
          return r.status !== 'cancelled';
        }));
      }
    },

    events: {
      list: function () { return clone(load().events); },

      get: function (id) {
        var e = load().events.filter(function (x) { return x.id === id; })[0];
        return e ? clone(e) : null;
      },

      create: function (data) {
        var d = load();
        var rec = {
          id: nextId(d.events, 'EVT-', 3),
          title: data.title || 'Untitled entry',
          type: data.type || 'other',
          roomId: data.roomId || null,
          start: data.start,
          end: data.end || data.start,
          notes: data.notes || '',
          createdBy: data.createdBy || null
        };
        d.events.push(rec);
        save();
        return clone(rec);
      },

      update: function (id, patch) {
        var d = load();
        var e = d.events.filter(function (x) { return x.id === id; })[0];
        if (!e) return null;
        Object.keys(patch).forEach(function (k) { e[k] = patch[k]; });
        save();
        return clone(e);
      },

      remove: function (id) {
        var d = load();
        var i = d.events.findIndex(function (x) { return x.id === id; });
        if (i === -1) return false;
        d.events.splice(i, 1);
        save();
        return true;
      }
    },

    inventory: {
      list: function () { return clone(load().inventory); },
      lowStock: function () {
        return clone(load().inventory.filter(function (i) {
          return i.stock <= i.reorder;
        }));
      },
      outOfStock: function () {
        return clone(load().inventory.filter(function (i) { return i.stock <= 0; }));
      },
      totalValue: function () {
        return load().inventory.reduce(function (sum, i) {
          return sum + (i.stock * i.unitCost);
        }, 0);
      }
    }
  };

  App.Store = Store;
})(window.App = window.App || {});
