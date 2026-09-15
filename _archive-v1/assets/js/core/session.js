/* ============================================================================
 * session.js — STUB, stands in for WBS 2.2 (Authentication Logic)
 * ----------------------------------------------------------------------------
 * WBS 2.2 is NOT assigned to this developer. No password hashing, no credential
 * verification, no real session token is implemented here and none should be
 * read as implemented.
 *
 * Role-Based Access Control (WBS 2.3) needs to know *who is signed in* before
 * it can decide what they may do. This file supplies exactly that one fact and
 * nothing more: it holds a chosen user id and hands back the matching record.
 *
 * The header role selector swaps the active user so the RBAC rules can be
 * demonstrated from an Administrator, Staff and Guest point of view without a
 * login screen existing yet.
 *
 * WHEN WBS 2.2 LANDS:
 *   Delete the role selector, keep this interface. current() should return the
 *   user decoded from the real session; signOut() should hit the logout
 *   endpoint. Nothing else in the codebase needs to change.
 * ========================================================================== */
(function (App) {
  'use strict';

  var KEY = 'patvep.session.userId';
  var DEFAULT_USER = 'U-1001';   // Angelo Sierra, Administrator

  function readId() {
    try { return localStorage.getItem(KEY) || DEFAULT_USER; }
    catch (e) { return DEFAULT_USER; }
  }

  function writeId(id) {
    try { localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
  }

  var Session = {
    /** The signed-in user record, or null. */
    current: function () {
      var u = App.Store.users.get(readId());
      if (!u) {                      // account was deleted mid-session
        writeId(DEFAULT_USER);
        u = App.Store.users.get(DEFAULT_USER);
      }
      return u;
    },

    currentId: function () { return readId(); },

    /** STUB: switch the active user. Replaced by real login in WBS 2.2. */
    switchTo: function (userId) {
      var u = App.Store.users.get(userId);
      if (!u) return null;
      writeId(userId);
      return u;
    },

    /** STUB: first active user holding the given role. */
    switchToRole: function (role) {
      var match = App.Store.users.list().filter(function (u) {
        return u.role === role && u.status === 'active';
      })[0];
      return match ? this.switchTo(match.id) : null;
    },

    signOut: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },

    isSelf: function (userId) { return userId === readId(); }
  };

  App.Session = Session;
})(window.App = window.App || {});
